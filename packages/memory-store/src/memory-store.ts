import { mapValues, merge } from "lodash-es";
import { Query, RootQuery, ensureValidQuery } from "./query.js";
import { LooseSchema, compileSchema } from "./schema.js";
import { evaluateId } from "./query.js";
import { Result } from "./result.js";
import { runOperations } from "./operations.js";

export type Store = {
	compileQuery: (query: RootQuery) => (args?: object) => Promise<Result>;
	get: (query: RootQuery, args?: object) => Promise<Result>;
	seed: (seedData: object) => void;
};

type MemoryStoreOptions = {
	initialData: any;
};

export function createMemoryStore(
	looseSchema: LooseSchema,
	options?: MemoryStoreOptions,
): Store {
	const schema = compileSchema(looseSchema);
	const data = mapValues(schema.resources, () => ({}));

	const seed = (seedData) => {
		merge(data, seedData); // mutates
	};

	const compileQuery = (rootQuery: RootQuery) => {
		ensureValidQuery(schema, rootQuery);

		// create a function that takes in the various parts of a query and returns a
		// function that takes query arguments and returns the result
		return (args) => {
			const compileQuery = (resType: string, subquery: Query) => {
				const resDef = schema.resources[resType];

				const getProperties = (res) => {
					const props = subquery.properties ?? { [resDef.idField]: {} as Query };
					return mapValues(props, (propQuery, propName) => {
						if (propName in resDef.relationships) {
							const relDef = resDef.relationships[propName];

							return relDef.cardinality === "one"
								? res[propName]
									? compileQuery(relDef.resource, { ...propQuery, id: res[propName] })
									: null
								: res[propName].map((id) =>
									compileQuery(relDef.resource, { ...propQuery, id }),
								  );
						}

						return res[propName];
					});
				};

				if ("id" in subquery) {
					const id = evaluateId(subquery.id, args);
					const res = data[resType][id];

					return res ? getProperties(res) : null;
				}

				const initResults = Object.values(data[resType]).map(getProperties);
				return runOperations(subquery, initResults);
			};

			return compileQuery(rootQuery.type, rootQuery);
		};
	};

	const get = (rootQuery: RootQuery, args = {}) => {
		return compileQuery(rootQuery)(args);
	};

	return { compileQuery, get, seed };
}
