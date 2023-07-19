import { mapValues, orderBy } from "lodash-es";
import { applyOrMap } from "@data-prism/utils";
import { createExpressionEngine } from "@data-prism/expressions";
import { MultiResult, Result } from "../result.js";
import { Schema } from "../schema.js";
import { RootQuery } from "../query.js";

type GetOperation = (results: MultiResult) => MultiResult;

const evaluator = createExpressionEngine({});

export function runTreeQuery<S extends Schema, Q extends RootQuery<S>>(
	query: Q,
	context: { schema: S; data: { [k: string]: { [k: string]: any } } },
): Result<Q> {
	const { schema, data } = context;
	const resDef = schema.resources[query.type];

	if (query.id && !data[query.type][query.id]) return null;

	const getPropertyPath = (path, resType, result) => {
		const [head, ...tail] = path;

		if (tail.length === 0) return result[head];

		const relResDef = schema.resources[resType].relationships[head];
		const relResType = relResDef.resource;

		return applyOrMap(result[head], (relResId) =>
			getPropertyPath(tail, relResType, data[relResType][relResId]),
		);
	};

	// these are in order of execution
	const operationDefinitions: { [k: string]: GetOperation } = {
		where(results: MultiResult): MultiResult {
			const filter = evaluator.distribute(query.where);
			const filterFn = evaluator.compile(filter);

			return results.filter((result) => filterFn(result));
		},
		order(results: MultiResult): MultiResult {
			return orderBy(
				results,
				query.order?.map((o) => o.property),
				query.order?.map((o) => o.direction),
			);
		},
		limit(results: MultiResult): MultiResult {
			const { limit = 0, offset = 0 } = query;
			if (limit <= 0) throw new Error("`limit` must be at least 1");

			return results.slice(offset, limit + offset);
		},
		offset(results: MultiResult): MultiResult {
			if ((query.offset ?? 0) < 0) throw new Error("`offset` must be at least 0");
			return query.limit ? results : results.slice(query.offset);
		},
		first(results) {
			return [results[0]];
		},
		properties(results) {
			if (!query.properties) {
				return results.map((result) => ({
					type: query.type,
					id: result[resDef.idField ?? "id"],
				}));
			}

			const { properties } = query;
			return results.map((result) =>
				mapValues(properties, (propQuery, propName) => {
					// possibilities: (1) property (2) nested property (3) subquery (4) ref (5) expression
					if (typeof propQuery === "string") {
						// relationship name -- return ref
						if (propQuery in resDef.relationships) {
							const relDef = resDef.relationships[propName];
							return result[propQuery] === null
								? null
								: { type: relDef.resource, id: result[propQuery] };
						}

						// nested / shallow property
						return getPropertyPath(propQuery.split("."), query.type, result);
					}

					// subquery
					const relDef = resDef.relationships[propName];
					return relDef.cardinality === "one"
						? result[propName]
							? runTreeQuery(
								{ ...propQuery, type: relDef.resource, id: result[propName] },
								context,
							  )
							: null
						: result[propName]
							.map((id) =>
								runTreeQuery({ ...propQuery, id, type: relDef.resource }, context),
							)
							.filter(Boolean);
				}),
			);
		},
	};

	const results = query.id
		? [data[query.type][query.id]]
		: Object.values(data[query.type]);

	const processed = Object.entries(operationDefinitions).reduce(
		(acc, [opName, fn]) => (opName in query || opName === "properties" ? fn(acc) : acc),
		results,
	);

	return query.id ? processed[0] : processed;
}
