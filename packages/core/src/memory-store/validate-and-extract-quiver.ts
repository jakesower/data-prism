/* eslint-disable no-restricted-syntax, no-loop-func */

import { mapObj } from "@polygraph/utils";
import {
  ExpandedSchema,
  NormalStore,
  NormalResource,
  Schema,
  ResourceRef,
} from "../types";
import { ResourceQuiverResult } from "../data-structures/resource-quiver";
import { asArray, cardinalize, denormalizeResource } from "../utils";
import { defaultResources as getDefaultResources } from "./default-resources";
import { PolygraphError, PolygraphToOneValidationError } from "../validations/errors";
import { makeRefKey } from "../utils/make-ref-key";

function getReferencingResources<S extends Schema>(
  quiver: ResourceQuiverResult<S>,
  resRef: ResourceRef<S, any>,
) {
  const targetKey = makeRefKey(resRef);
  const output = [];

  for (const [referencingRef, referencingRes] of quiver.getResources()) {
    const updatedRels = quiver.getRelationshipChanges(referencingRef);

    Object.values(updatedRels).forEach((arrowChanges) => {
      const referencedRefs = ("present" in arrowChanges)
        ? arrowChanges.present
        : [...(arrowChanges.asserted ?? []), ...(arrowChanges.retracted ?? [])];

      referencedRefs.forEach((referencedRef) => {
        const refKey = makeRefKey(referencedRef);
        if (refKey === targetKey) {
          output.push(denormalizeResource(referencingRes as any));
        }
      });
    });
  }

  return output;
}

function makeEmptyUpdatesObj<S extends Schema>(schema: S): NormalStore<S> {
  const output = {} as NormalStore<S>;
  Object.keys(schema.resources).forEach((resType: keyof S["resources"]) => {
    output[resType] = {};
  });

  return output;
}

function makeNewResource<S extends Schema, RT extends keyof S["resources"]>(
  schema: S,
  type: RT & string,
  id: string,
): NormalResource<S, RT> {
  const expandedSchema = schema as ExpandedSchema<S>;
  const resDef = expandedSchema.resources[type];
  const properties = mapObj(
    resDef.properties,
    (prop) => prop.default ?? undefined,
  );
  const relationships = mapObj(resDef.relationships, (relDef) => cardinalize([], relDef));

  return {
    type,
    id,
    properties,
    relationships,
  } as NormalResource<S, RT>;
}

export async function validateAndExtractQuiver<S extends Schema>(
  schema: S,
  store: NormalStore<S>,
  quiver: ResourceQuiverResult<S>,
  resourceValidations,
): Promise<NormalStore<S>> {
  const updatedResources: any = makeEmptyUpdatesObj(schema);
  const defaultResources = getDefaultResources(schema);

  for (const [ref, value] of quiver.getResources()) {
    const { type, id } = ref;
    const isReferenceOnly = !quiver.explicitResources.has(makeRefKey(ref));

    if (isReferenceOnly && !(id in store[type])) {
      throw new PolygraphError(
        "resource references must already be present in the store to be used", {
          ref,
          referencingResources: getReferencingResources(quiver, ref),
        },
      );
    }

    if (value == null) {
      updatedResources[type][id] = null;
      continue; // eslint-disable-line no-continue
    }

    const resDef = schema.resources[type];
    const existingOrNewRes = store[type][id] ?? makeNewResource(schema, type, id);
    const existingOrNewProps = existingOrNewRes.properties;
    const existingOrNewRels = existingOrNewRes.relationships;

    const properties = ("properties" in value)
      ? mapObj(
        existingOrNewProps,
        (existingProp, propKey) => value.properties[propKey] ?? existingProp,
      )
      : defaultResources[type].properties;

    // console.log({ ref, properties, value, existingOrNewProps })

    // need a way to detect resources that were merely referenced rather than asserted

    const relationships = {};
    const updatedRels = quiver.getRelationshipChanges(ref);
    Object.entries(existingOrNewRels).forEach(([relType, existingRels]) => {
      if (relType in updatedRels) {
        const relDef = resDef.relationships[relType];
        const updatedRel = updatedRels[relType];

        if ("present" in updatedRel) {
          relationships[relType] = cardinalize(updatedRel.present, relDef);
        } else {
          const existingRelsOfType = asArray(existingRels);
          const updatedRelIds = new Set(existingRelsOfType.map((r) => r.id));
          (updatedRel.retracted ?? []).forEach((r) => updatedRelIds.delete(r.id));
          (updatedRel.asserted ?? []).forEach((r) => updatedRelIds.add(r.id));

          if (relDef.cardinality === "one" && updatedRelIds.size > 1) {
            throw new PolygraphToOneValidationError(updatedRel, relType, updatedRelIds);
          }

          relationships[relType] = cardinalize(
            [...updatedRelIds].map((relId) => ({ type: relDef.relatedType, id: relId })),
            relDef,
          );
        }
      } else {
        relationships[relType] = existingOrNewRes.relationships[relType];
      }
    });

    const nextRes = {
      type, id, properties, relationships,
    };

    const validations = resourceValidations[type] ?? [];
    // eslint-disable-next-line no-await-in-loop
    await Promise.all(validations.map(
      ({ validateResource }) => validateResource(nextRes, store[type][id], { schema }),
    ));

    updatedResources[type][id] = nextRes;
  }

  return updatedResources;
}
