import { mapValues, merge } from "lodash-es";
import {
	compileSchema,
	ensureValidQuery,
	project,
	QueryOfType,
	RootQuery,
	Schema,
	Result,
} from "@data-prism/store-core";
import { runQuery } from "./operations.js";

export type InternalStore = { [k: string]: { [k: string]: any } };

// TODO: get this bugger working
type GetQueryOfType<S extends Schema> = RootQuery<S> extends { type: infer ResType }
	? ResType extends string
		? ResType extends keyof S["resources"]
			? QueryOfType<S, ResType>
			: never
		: never
	: never;

export type Store<S extends Schema> = {
	compileQuery: <Q extends RootQuery<S>>(
		query: RootQuery<S>,
	) => (args?: object) => Promise<Result<Q>>;
	get: <Q extends RootQuery<S>>(query: Q, args?: object) => Promise<Result<Q>>;
	getProjection: (
		query: GetQueryOfType<S>,
		projection: object,
		args?: object,
	) => Promise<{ [k: string]: any }[]>;
	seed: (seedData: object) => void;
	setState: (data: object) => void;
};

export function createMemoryStore<S extends Schema>(schema: S): Store<S> {
	const compiledSchema = compileSchema(schema);
	const store: InternalStore = mapValues(schema.resources, () => ({}));

	const seed = (seedData) => {
		merge(store, seedData); // mutates
	};

	const setState = (data) => {
		Object.keys(schema.resources).forEach((k) => {
			store[k] = data[k] ?? {};
		});
	};

	const get = (query: RootQuery<S>, args = {}) => {
		ensureValidQuery(compiledSchema, { ...query, ...args });
		return Promise.resolve(
			runQuery({ ...query, ...args }, { schema: compiledSchema, store }),
		);
	};

	const getProjection = (query: RootQuery<S>, projection: object, args = {}) => {
		ensureValidQuery(compiledSchema, query);

		const results = runQuery(query, { schema: compiledSchema, store });
		return Promise.resolve(project(results, projection));
	};

	const compileQuery = (query: RootQuery<S>) => {
		ensureValidQuery(compiledSchema, query);
		return (args = {}) =>
			Promise.resolve(runQuery({ ...query, ...args }, { schema: compiledSchema, store }));
	};

	return { compileQuery, get, getProjection, seed, setState };
}
