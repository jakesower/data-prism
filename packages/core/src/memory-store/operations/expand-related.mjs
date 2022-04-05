import { mapObj } from "@polygraph/utils";
import { multiApply } from "../../utils/multi-apply.mjs";
import { processResults } from "./run-query.mjs"; // eslint-disable-line import/no-cycle

export function expandRelated(getFromStore) {
  return function (resources, context) {
    const { query } = context;

    if (!query.relationships) return resources;

    return multiApply(resources, (resource) => {
      const relationships = mapObj(query.relationships,
        (subQuery, relKey) => {
          const relResOrRess = multiApply(resource[relKey], getFromStore);
          return processResults(relResOrRess, getFromStore, { ...context, query: subQuery });
        },
      );

      return {
        ...resource,
        ...relationships,
      };
    });
  };
}