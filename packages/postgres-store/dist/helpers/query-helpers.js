import { partition, pick } from "lodash-es";
export function flattenQuery(schema, rootQuery) {
    const go = (query, type, path, parent = null, parentRelationship = null) => {
        const resDef = schema.resources[type];
        const [attributesEntries, relationshipsEntries] = partition(Object.entries(query.select ?? {}), ([, propVal]) => typeof propVal === "string" && (propVal in resDef.attributes || propVal === "id"));
        const attributes = attributesEntries.map((pe) => pe[1]);
        const relationshipKeys = relationshipsEntries.map((pe) => pe[0]);
        const level = {
            parent,
            parentQuery: parent?.query ?? null,
            parentRelationship,
            path,
            attributes,
            query,
            ref: !query.select,
            relationships: pick(query.select, relationshipKeys),
            type,
        };
        return [
            level,
            ...relationshipKeys.flatMap((relKey) => {
                const relDef = resDef.relationships[relKey];
                const subquery = query.select[relKey];
                return go(subquery, relDef.type, [...path, relKey], level, relKey);
            }),
        ];
    };
    return go(rootQuery, rootQuery.type, []);
}