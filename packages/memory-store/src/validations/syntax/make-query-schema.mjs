import { mapObj, partitionObj } from "@polygraph/utils/objects";
import { constraintDefinitions } from "../../memory-store/operations/constraints/constraint-definitions.mjs";

const constraintDefs = {
  boolean: { type: "boolean" },
  number: { type: "number" },
  string: { type: "string" },
};

const sharedConstraints = mapObj(constraintDefinitions, () => ({}));

export function makeQuerySchema(schema, allowRelProps) {
  const resourceQuery = (resDef) => {
    const [relProps, nonRelProps] = partitionObj(
      resDef.properties,
      ({ type }) => type === "relationship",
    );

    const resourceProperties = {
      type: "array",
      items: {
        enum: [
          ...Object.keys(nonRelProps),
          ...(allowRelProps ? Object.keys(relProps) : []),
        ],
      },
    };

    const resourceRelationships = {
      type: "object",
      additionalProperties: false,
      properties: mapObj(relProps, (relDef) => ({
        $ref: `#/$defs/${relDef.relatedType}`,
      })),
    };

    const resourceConstraints = {
      type: "object",
      additionalProperties: false,
      properties: {
        // ...mapObj(resDef.properties, (prop) => ({ $ref: `#/$defs/constraints/${prop.type}` })),
        ...mapObj(nonRelProps, () => ({})),
        ...sharedConstraints,
      },
    };

    return {
      type: "object",
      additionalProperties: false,
      properties: {
        allNonRefProps: { type: "boolean" },
        allNonReferenceProperties: { type: "boolean" },
        allRefProps: { type: "boolean" },
        allReferenceProperties: { type: "boolean" },
        constraints: resourceConstraints,
        excludedProps: resourceProperties,
        excludedProperties: resourceProperties,
        first: { type: "boolean" },
        properties: resourceProperties,
        props: resourceProperties,
        relationships: resourceRelationships,
        rels: resourceRelationships,
      },
    };
  };

  const resourceQueries = mapObj(schema.resources, resourceQuery);
  const topResources = mapObj(resourceQueries, (resQuery, resKey) => ({
    ...resQuery,
    required: ["type"],
    properties: {
      ...resQuery.properties,
      type: { const: resKey },
      id: { type: "string" },
    },
  }));

  return {
    $id: `schemas/${schema.urlName}/query-schema${
      allowRelProps ? "-with-rel-props" : ""
    }`,
    $schema: "http://json-schema.org/draft-07/schema",
    title: `${schema.title ?? "Polygraph"} Query`,
    description: "Validations for queries.",
    type: "object",
    oneOf: Object.values(topResources),
    $defs: {
      ...mapObj(schema.resources, resourceQuery),
      constraints: constraintDefs,
    },
  };
}
