import { preQueryRelationships } from "./relationships.js";
import { flattenQuery } from "../helpers/query-helpers.js";
import { snakeCase, uniq } from "lodash-es";
import { whereExpressionEngine } from "../helpers/sql-expressions.js";
const hasToManyRelationship = (schema, query) => {
    const flatQueries = flattenQuery(schema, query);
    return flatQueries.some((flatQuery) => Object.keys(flatQuery.relationships).some((relKey) => schema.resources[query.type].attributes[relKey].cardinality === "many"));
};
const operations = {
    id: {
        preQuery: {
            apply: (id, { config, schema, query }) => {
                const { idAttribute = "id" } = schema.resources[query.type];
                const { table } = config.resources[query.type];
                return {
                    where: [`${table}.${snakeCase(idAttribute)} = ?`],
                    vars: [id],
                };
            },
        },
        postQuery: {
            apply: (_, resources) => {
                return resources[0] ?? null;
            },
        },
    },
    where: {
        preQuery: {
            apply: (where, context) => {
                const { table } = context;
                // // an expression has been passed as the constraint value
                // if (isExpression(where, expressionDefinitions)) {
                // 	return compileExpression(where, expressionDefinitions, context)();
                // }
                // an object of attributes has been passed in
                const propExprs = Object.entries(where).map(([propKey, propValOrExpr]) => {
                    if (whereExpressionEngine.isExpression(where)) {
                        // TODO
                        const [operation, args] = Object.entries(where)[0];
                        return whereExpressionEngine.evaluate(where);
                    }
                    if (whereExpressionEngine.isExpression(propValOrExpr)) {
                        const [operation, args] = Object.entries(propValOrExpr)[0];
                        return { [operation]: [`${table}.${snakeCase(propKey)}`, args] };
                    }
                    return { $eq: [`${table}.${snakeCase(propKey)}`, propValOrExpr] };
                });
                const expr = { $and: propExprs };
                return { where: [expr], vars: [expr] };
            },
        },
    },
    order: {
        preQuery: {
            apply: (order, context) => [
                {
                    orderBy: (Array.isArray(order) ? order : [order]).map((orderEntry) => {
                        const k = Object.keys(orderEntry)[0];
                        return {
                            property: k,
                            direction: orderEntry[k],
                            table: context.table,
                        };
                    }),
                },
            ],
        },
    },
    limit: {
        preQuery: {
            apply: (limit, { query, queryPath, schema }) => {
                if (limit < 0) {
                    throw new Error("`limit` must be at least 0");
                }
                return queryPath.length > 0 || hasToManyRelationship(schema, query)
                    ? []
                    : [{ limit, offset: query.offset ?? 0 }];
            },
        },
    },
    offset: {
        preQuery: {
            apply: (offset, { query }) => {
                if (offset < 0) {
                    throw new Error("`offset` must be at least 0");
                }
                if (!query.limit) {
                    return [{ offset }];
                }
                return [];
            },
        },
    },
    select: {
        preQuery: {
            apply: (select, context) => {
                const { schema, flatQuery, table } = context;
                const { type } = flatQuery;
                const { idAttribute = "id" } = schema.resources[type];
                const attributeProps = Object.values(select).filter((p) => typeof p === "string");
                const relationshipsModifiers = preQueryRelationships(context);
                return {
                    select: uniq([idAttribute, ...attributeProps]).map((col) => `${table}.${snakeCase(col)}`),
                    ...relationshipsModifiers,
                };
            },
        },
    },
};
// helpful: split query up into props, refs, and subqueries
const gatherPreOperations = (query, context) => {
    const { config, schema } = context;
    const flatQueries = flattenQuery(schema, query);
    const queryParts = flatQueries.flatMap((flatQuery) => {
        const table = [config.resources[query.type].table, ...flatQuery.path].join("$");
        const argContext = {
            ...context,
            flatQuery,
            query: flatQuery.query,
            queryPath: flatQuery.path,
            table,
            rootQuery: query,
        };
        const partSchema = schema.resources[flatQuery.type];
        const { idAttribute = "id" } = partSchema;
        const operationParts = Object.entries(flatQuery.query).flatMap(([operationKey, operationArg]) => {
            const operation = operations[operationKey]?.preQuery?.apply;
            if (!operation)
                return [];
            return operation(operationArg, argContext);
        });
        const refPart = flatQuery.ref && flatQuery.parentQuery
            ? [preQueryRelationships(argContext)]
            : [];
        return [
            { select: [`${table}.${snakeCase(idAttribute)}`] },
            ...operationParts,
            ...refPart,
        ];
    });
    return queryParts;
};
export async function runQuery(query, context, run) {
    const queryModifierPromises = gatherPreOperations(query, context);
    const queryModifiers = await Promise.all(queryModifierPromises);
    return run(queryModifiers);
}