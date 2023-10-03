import { mapValues } from "lodash-es";
import { Schema, compileSchema } from "./schema.js";
import { MultiRootQuery, SingleRootQuery, ensureValidQuery } from "./query.js";
import { Result } from "./result.js";
import { runTreeQuery } from "./graph/graph-query-operations.js";
import { ExpressionEngine, defaultExpressionEngine } from "@data-prism/expressions";

export type Graph<S extends Schema> = {
	data: { [k: string]: { [k: string]: any } };
	getTree: <Q extends SingleRootQuery<S>>(query: Q) => Result<Q>;
	getTrees: <Q extends MultiRootQuery<S>>(query: Q) => Result<Q>;
};

export type GraphConfig = {
	expressionEngine: ExpressionEngine;
	omittedOperations: string[];
};

const defaultConfig: GraphConfig = {
	expressionEngine: defaultExpressionEngine,
	omittedOperations: [],
};

export const ID = Symbol("id");
export const TYPE = Symbol("type");

export function createGraph<S extends Schema>(
	schema: S,
	resources,
	config: Partial<GraphConfig> = {},
) {
	const compiledSchema = compileSchema(schema);
	const fullConfig = { ...defaultConfig, ...config };
	const { expressionEngine } = fullConfig;

	const data = structuredClone({
		...mapValues(schema.resources, (_, resType) => resources[resType] ?? {}),
	});

	Object.entries(data).forEach(([resType, ressById]) => {
		Object.entries(ressById).forEach(([resId, res]) => {
			res[TYPE] = resType;
			res[ID] = resId;

			const resDef = schema.resources[resType];
			Object.entries(resDef.relationships).forEach(([relName, relDef]) => {
				relDef.cardinality === "many"
					? (res[relName] = res[relName].map((relId) => data[relDef.resource][relId]))
					: (res[relName] = data[relDef.resource][res[relName]] ?? null);
			});
		});
	});

	return {
		data,
		getTree<Q extends SingleRootQuery<S>>(query: Q, args = {}) {
			const fullQuery = { ...query, ...args };
			ensureValidQuery(fullQuery, { schema: compiledSchema, expressionEngine });
			return runTreeQuery(fullQuery, { config: fullConfig, schema, data });
		},
		getTrees<Q extends MultiRootQuery<S>>(query: Q, args = {}) {
			const fullQuery = { ...query, ...args };
			ensureValidQuery(fullQuery, { schema: compiledSchema, expressionEngine });
			return runTreeQuery(fullQuery, { config: fullConfig, schema, data });
		},
		setResource(type, id, value) {
			// TODO: handle inverses?
			const existing = data[type][id] ?? {};

			data[type][id] = { ...existing, ...value };
		},
	};
}
