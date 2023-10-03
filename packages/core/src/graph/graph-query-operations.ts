import { mapValues, omit, orderBy } from "lodash-es";
import { applyOrMap } from "@data-prism/utils";
import { MultiResult, Result } from "../result.js";
import { Schema } from "../schema.js";
import { RootQuery } from "../query.js";
import { GraphConfig, ID } from "../graph.js";
import { createExpressionProjector } from "./select-helpers.js";
import { buildWhereExpression } from "./where-helpers.js";

type GetOperation = (results: MultiResult) => MultiResult;

export function runTreeQuery<S extends Schema, Q extends RootQuery<S>>(
	query: Q,
	context: {
		schema: S;
		data: { [k: string]: { [k: string]: any } };
		config: GraphConfig;
	},
): Result<Q> {
	const { schema, data, config } = context;
	const { expressionEngine } = config;

	const resDef = schema.resources[query.type];

	if (query.id && !data[query.type][query.id]) return null;

	const getPropertyPath = (path, resType, result) => {
		const [head, ...tail] = path;

		if (tail.length === 0) return result[head];

		const relResDef = schema.resources[resType].relationships[head];
		const relResType = relResDef.resource;

		return applyOrMap(result[head], (relRes) =>
			getPropertyPath(tail, relResType, relRes),
		);
	};

	// these are in order of execution
	const operationDefinitions: { [k: string]: GetOperation } = {
		where(results: MultiResult): MultiResult {
			const whereExpression = buildWhereExpression(query.where, expressionEngine);
			return results.filter((result) => expressionEngine.apply(whereExpression, result));
		},
		order(results: MultiResult): MultiResult {
			const order = Array.isArray(query.order) ? query.order : [query.order];
			const properties = order.flatMap((o) => Object.keys(o));
			const dirs = order.flatMap((o) => Object.values(o));

			return orderBy(results, properties, dirs);
		},
		limit(results: MultiResult): MultiResult {
			const { limit, offset = 0 } = query;
			if (limit < 1) throw new Error("`limit` must be at least 1");

			return results.slice(offset, limit + offset);
		},
		offset(results: MultiResult): MultiResult {
			if (query.offset < 0) throw new Error("`offset` must be at least 0");
			return query.limit ? results : results.slice(query.offset);
		},
		select(results) {
			const select = query.select ?? query.properties;
			if (!select) {
				return results.map((result) => ({
					type: query.type,
					id: result[resDef.idField ?? "id"],
				}));
			}

			const projectors = mapValues(select, (propQuery, propName) => {
				// possibilities: (1) property (2) nested property (3) subquery (4) ref (5) expression
				if (typeof propQuery === "string") {
					// relationship name -- return ref
					if (propQuery in resDef.relationships) {
						const relDef = resDef.relationships[propName];
						return (result) =>
							result[propQuery] === null
								? null
								: { type: relDef.resource, id: result[propQuery][ID] };
					}

					// nested / shallow property
					return (result) => getPropertyPath(propQuery.split("."), query.type, result);
				}

				// expression
				if (expressionEngine.isExpression(propQuery)) {
					return createExpressionProjector(propQuery, expressionEngine);
				}

				// subquery
				const relDef = resDef.relationships[propName];
				return (result) =>
					relDef.cardinality === "one"
						? result[propName]
							? runTreeQuery(
								{ ...propQuery, type: relDef.resource, id: result[propName][ID] },
								context,
							  )
							: null
						: result[propName]
							.map((res) =>
								runTreeQuery(
									{ ...propQuery, id: res[ID], type: relDef.resource },
									context,
								),
							)
							.filter(Boolean);
			});

			return results.map((result) => mapValues(projectors, (project) => project(result)));
		},
		properties(results) {
			console.warn("properties is a deprecated query key; use select instead");
			return results;
		},
	};

	const usedOperationDefinitions = omit(operationDefinitions, config.omittedOperations);

	const results = query.id
		? [data[query.type][query.id]]
		: Object.values(data[query.type]);

	const processed = Object.entries(usedOperationDefinitions).reduce(
		(acc, [opName, fn]) => (opName in query || opName === "select" ? fn(acc) : acc),
		results,
	);

	return query.id ? processed[0] : processed;
}
