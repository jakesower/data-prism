import { mapValues } from "lodash-es";
import { buildSql, composeClauses } from "./sql.js";
import { runQuery } from "../operations/operations.js";
import { castValToDb } from "./sql.js";

export function get(query, context) {
	const { schema, db, config, rootClauses = [] } = context;

	const initModifiers = {
		from: config.resources[query.type].table,
	};

	return runQuery(query, context, (queryModifiers) => {
		const composedModifiers = composeClauses([
			initModifiers,
			...rootClauses,
			...queryModifiers,
		]);

		const sql = buildSql(composedModifiers);
		const vars = composedModifiers.vars.map(castValToDb);
		const statement = db.prepare(sql).raw();
		const allResults = statement.all(vars) ?? null;

		const chunkInto = (items, chunkSizes) => {
			let offset = 0;
			const chunks = [];

			for (let i = 0; i < chunkSizes.length; i += 1) {
				chunks.push(items.slice(offset, chunkSizes[i] + offset));
				offset += chunkSizes[i];
			}

			return chunks;
		};

		const getQueryChunkSize = (subquery) =>
			Object.values(subquery.relationships).reduce(
				(sum, relQuery) => sum + getQueryChunkSize(relQuery),
				subquery.properties.length + 1,
			);

		const buildExtractor = (subquery) => {
			const relKeys = Object.keys(subquery.relationships);
			const relValues = Object.values(subquery.relationships);
			const relResDef = schema.resources[subquery.type];

			const castProp = (val, prop) =>
				relResDef.properties[prop].type === "boolean"
					? val === 0
						? false
						: val === 1
							? true
							: undefined
					: val === null
						? undefined
						: val;

			const chunkSizes = [
				1,
				subquery.properties.length,
				...relValues.map(getQueryChunkSize),
			];

			// TODO: this needs to map the obj into a `new Map()` to preserve numeric key order
			const relExtractors = mapValues(subquery.relationships, buildExtractor);

			return (row, out) => {
				const chunks = chunkInto(row, chunkSizes);
				const [, props, ...relChunks] = chunks;
				const [id] = row;

				if (!id) return;

				if (!out.get(id)) {
					// eslint-disable-next-line no-param-reassign
					out.set(id, {
						id,
						properties: zipObjWith(subquery.properties, props, castProp),
						relationships: mapValues(subquery.relationships, () => new Map()),
					});
				}

				relKeys.forEach((relKey, idx) => {
					relExtractors[relKey](relChunks[idx], out.get(id).relationships[relKey]);
				});
			};
		};

		const finalizer = (subquery, objResTree) => {
			const subResDef = schema.resources[subquery.type];

			return [...objResTree.values()].map(({ id, properties, relationships }) => ({
				id,
				...properties,
				...mapValues(relationships, (rel, relName) => {
					const vals = finalizer(subquery.relationships[relName], rel);
					return subResDef.properties[relName].cardinality === "one"
						? vals[0] ?? null
						: vals;
				}),
			}));
		};

		const structuredResults = new Map();
		const rootExtractor = buildExtractor(query);
		allResults.forEach((row) => rootExtractor(row, structuredResults));

		return finalizer(query, structuredResults);
	});
}
