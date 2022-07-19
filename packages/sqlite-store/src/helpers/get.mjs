import { zipObjWith } from "@polygraph/utils/arrays";
import { mapObj } from "@polygraph/utils/objects";
import { buildSql } from "../build-sql.mjs";
import { composeClauses } from "../compose-clauses.mjs";
import { runQuery } from "../operations/operations.mjs";
import { columnsToSelect, joinClauses } from "./get-clauses.mjs";

export function get(schema, db, query, rootClauses = []) {
  const queryParts = {
    select: columnsToSelect(schema, query),
    from: schema.resources[query.type].store.table,
    join: joinClauses(schema, query),
  };

  const context = { schema, query };
  return runQuery([queryParts, ...rootClauses], context, (queryModifiers) => {
    const composedModifiers = composeClauses(queryModifiers);
    const sql = buildSql(composedModifiers);
    const statement = db.prepare(sql).raw();
    const allResults = statement.all(composedModifiers.vars) ?? null;

    const chunkInto = (items, chunkSizes) => {
      let offset = 0;
      const chunks = [];

      for (let i = 0; i < chunkSizes.length; i += 1) {
        chunks.push(items.slice(offset, chunkSizes[i] + offset));
        offset += chunkSizes[i];
      }

      return chunks;
    };

    const getQueryChunkSize = (subQuery) =>
      Object.values(subQuery.relationships).reduce(
        (sum, relQuery) => sum + getQueryChunkSize(relQuery),
        subQuery.properties.length + 1,
      );

    const buildExtractor = (subQuery) => {
      const relKeys = Object.keys(subQuery.relationships);
      const relValues = Object.values(subQuery.relationships);
      const relResDef = schema.resources[subQuery.type];

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
        subQuery.properties.length,
        ...relValues.map(getQueryChunkSize),
      ];

      const relExtractors = mapObj(subQuery.relationships, buildExtractor);

      return (row, obj) => {
        const chunks = chunkInto(row, chunkSizes);
        const [, props, ...relChunks] = chunks;
        const [id] = row;

        if (!id) return;

        // eslint-disable-next-line no-param-reassign
        obj[id] = obj[id] ?? {
          id,
          properties: zipObjWith(subQuery.properties, props, castProp),
          relationships: mapObj(subQuery.relationships, () => ({})),
        };

        relKeys.forEach((relKey, idx) => {
          relExtractors[relKey](relChunks[idx], obj[id].relationships[relKey]);
        });
      };
    };

    const finalizer = (subQuery, objResTree) => {
      const subResDef = schema.resources[subQuery.type];

      return Object.values(objResTree).map(({ id, properties, relationships }) => ({
        id,
        ...properties,
        ...mapObj(relationships, (rel, relName) => {
          const vals = finalizer(subQuery.relationships[relName], rel);
          return subResDef.properties[relName].cardinality === "one"
            ? vals[0] ?? null
            : vals;
        }),
      }));
    };

    const structuredResults = {};
    const rootExtractor = buildExtractor(query);
    allResults.forEach((row) => rootExtractor(row, structuredResults));

    return finalizer(query, structuredResults);
  });
}
