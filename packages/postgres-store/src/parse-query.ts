import { snakeCase, uniq } from "lodash-es";
import { whereExpressionEngine } from "./helpers/sql-expressions.js";
import { forEachQuery, someQuery } from "./helpers/query-helpers.js";
import { preQueryRelationships } from "./relationships.js";
import { RootQuery } from "data-prism";
import { StoreContext } from "./query.js";

const hasToManyRelationship = (schema, query) => {
	return someQuery(schema, query, (_, info) =>
		Object.keys(info.relationships).some(
			(relName) =>
				schema.resources[info.type].relationships[relName].cardinality ===
				"many",
		),
	);
};

const QUERY_CLAUSE_EXTRACTORS = {
	id: (id, { config, queryInfo, schema }) => {
		if (!id) return {};

		const { idAttribute = "id" } = schema.resources[queryInfo.type];
		const { table } = config.resources[queryInfo.type];

		return {
			where: [`${table}.${snakeCase(idAttribute)} = ?`],
			vars: [id],
		};
	},
	where: (where, { table }) => {
		const propExprs = Object.entries(where).map(([propKey, propValOrExpr]) => {
			if (whereExpressionEngine.isExpression(where)) {
				// TODO
				const [operation, args] = Object.entries(where)[0];
				return whereExpressionEngine.evaluate(where);
			}

			if (whereExpressionEngine.isExpression(propValOrExpr as object)) {
				const [operation, args] = Object.entries(propValOrExpr)[0];
				return { [operation]: [`${table}.${snakeCase(propKey)}`, args] };
			}

			return { $eq: [`${table}.${snakeCase(propKey)}`, propValOrExpr] };
		});

		const expr = { $and: propExprs };

		return { where: [expr], vars: [expr] };
	},
	order: (order, { table }) => {
		return {
			orderBy: (Array.isArray(order) ? order : [order]).map((orderEntry) => {
				const k = Object.keys(orderEntry)[0];
				return {
					property: k,
					direction: orderEntry[k],
					table,
				};
			}),
		};
	},
	limit: (limit, { query, queryInfo, schema }) => {
		if (limit < 0) {
			throw new Error("`limit` must be at least 0");
		}

		return queryInfo.path.length > 0 || hasToManyRelationship(schema, query)
			? {}
			: { limit, offset: query.offset ?? 0 };
	},
	offset: (offset, { query }) => {
		if (offset < 0) {
			throw new Error("`offset` must be at least 0");
		}

		if (!query.limit) {
			return { offset };
		}
		return [];
	},
	select: (select, context) => {
		const { config, schema, table, queryInfo } = context;
		const { type } = queryInfo;
		const { idAttribute = "id" } = schema.resources[type];
		const resConfig = config.resources[type];

		const attributeProps = Object.values(select).filter(
			(p) => typeof p === "string",
		);

		const relationshipsModifiers = preQueryRelationships(context);

		return {
			select: uniq([idAttribute, ...attributeProps]).map((col) => {
				const selectFn = resConfig.columns?.[col]?.select;
				const value = `${table}.${snakeCase(col)}`;
				return {
					value,
					sql: selectFn ? selectFn(table, col) : value,
				};
			}),
			...relationshipsModifiers,
		};
	},
};

export function parseQuery(
	query: RootQuery,
	context: StoreContext,
): { [k: string]: object }[] {
	const { config, schema } = context;
	const rootTable = config.resources[query.type].table;

	const clauses = [];

	forEachQuery(schema, query, (subquery, queryInfo) => {
		const table = [rootTable, ...queryInfo.path].join("$");

		Object.entries(subquery).forEach(([key, val]) => {
			if (QUERY_CLAUSE_EXTRACTORS[key]) {
				clauses.push(
					QUERY_CLAUSE_EXTRACTORS[key](val, {
						...context,
						queryInfo,
						rootQuery: query,
						query: subquery,
						table,
					}),
				);
			}
		});
	});

	return clauses;
}
