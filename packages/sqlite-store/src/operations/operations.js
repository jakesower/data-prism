import { applyOrMap } from "@data-prism/utils";
import { preQueryRelationships } from "./relationships.js";
import { flattenQuery } from "../helpers/query-helpers.ts";
import { uniq } from "lodash-es";
import {
	varsExpressionEngine,
	whereExpressionEngine,
} from "../helpers/sql-expressions.js";

const hasToManyRelationship = (schema, query) => {
	const flatQueries = flattenQuery(schema, query);

	return flatQueries.some((flatQuery) =>
		Object.keys(flatQuery.relationships).some(
			(relKey) => schema.resources[query.type].properties[relKey].cardinality === "many",
		),
	);
};

const operations = {
	id: {
		preQuery: {
			apply: (id, { config, query }) => {
				const { table, idProperty = "id" } = config.resources[query.type];
				return { where: [`${table}.${idProperty} = ?`], vars: [id] };
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

				// an object of properties has been passed in
				const propExprs = Object.entries(where).map(([propKey, propValOrExpr]) => {
					if (whereExpressionEngine.isExpression(propValOrExpr)) {
						const [operation, args] = Object.entries(propValOrExpr)[0];
						return { [operation]: [`${table}.${propKey}`, args] };
					}

					return { $eq: [`${table}.${propKey}`, propValOrExpr] };
				});

				const expr = { $and: propExprs };

				return { where: [expr], vars: [expr] };
			},
		},
	},
	order: {
		preQuery: {
			apply: (order, context) => [
				{ orderBy: order.map((o) => ({ ...o, table: context.table })) },
			],
		},
	},
	limit: {
		preQuery: {
			apply: (limit, { query, queryPath, schema }) => {
				if (limit < 0) {
					throw new Error("`offset` must be at least 0");
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
					return [{ limit: -1, offset }];
				}
				return [];
			},
		},
	},
	properties: {
		preQuery: {
			apply: (properties, context) => {
				const { config, flatQuery, table } = context;
				const { type } = flatQuery;
				const { idProperty = "id" } = config.resources[type];

				const propertyProps = Object.values(properties).filter(
					(p) => typeof p === "string",
				);

				const relationshipsModifiers = preQueryRelationships(context);

				return {
					select: uniq([idProperty, ...propertyProps]).map((col) => `${table}.${col}`),
					...relationshipsModifiers,
				};
			},
		},
	},
};

const applyOverPaths = (resources, path, fn) => {
	if (path.length === 0) return fn(resources);

	const [head, ...tail] = path;
	return applyOrMap(resources, (resource) => ({
		...resource,
		[head]: applyOverPaths(resource[head], tail, fn),
	}));
};

// helpful: split query up into props, refs, and subqueries

const gatherPreOperations = (query, context) => {
	const { config, schema } = context;

	const flatQueries = flattenQuery(schema, query);
	const queryParts = flatQueries.flatMap((flatQuery) => {
		const table = [query.type, ...flatQuery.path].join("$");
		const argContext = {
			...context,
			flatQuery,
			query: flatQuery.query,
			queryPath: flatQuery.path,
			table: [query.type, ...flatQuery.path].join("$"),
			rootQuery: query,
		};

		const partConfig = config.resources[flatQuery.type];
		const { idProperty = "id" } = partConfig;

		const operationParts = Object.entries(flatQuery.query).flatMap(
			([operationKey, operationArg]) => {
				const operation = operations[operationKey]?.preQuery?.apply;

				if (!operation) return [];

				return operation(operationArg, argContext);
			},
		);

		const refPart =
			flatQuery.ref && flatQuery.parentQuery ? [preQueryRelationships(argContext)] : [];

		return [{ select: [`${table}.${idProperty}`] }, ...operationParts, ...refPart];
	});

	return queryParts;
};

export async function runQuery(query, context, run) {
	const queryModifierPromises = gatherPreOperations(query, context);
	const queryModifiers = await Promise.all(queryModifierPromises);

	return run(queryModifiers);
}
