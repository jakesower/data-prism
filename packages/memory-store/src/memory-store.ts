import { mapValues, merge } from "lodash-es";
import { QueryOfType, RootQuery, ensureValidQuery } from "./query.js";
import { Schema } from "./schema.js";
import { Result } from "./result.js";
import { runQuery } from "./operations.js";

export type InternalStore = { [k: string]: { [k: string]: any } };

type GetQueryOfType<S extends Schema> = RootQuery<S> extends { type: infer ResType }
	? ResType extends string
		? QueryOfType<S, ResType>
		: never
	: never;

export type Store<S extends Schema> = {
	compileQuery: (query: RootQuery<S>) => (args?: object) => Promise<Result>;
	get: (query: GetQueryOfType<S>, args?: object) => Promise<Result>;
	seed: (seedData: object) => void;
};

export function createMemoryStore<S extends Schema>(schema: S): Store<S> {
	const store: InternalStore = mapValues(schema.resources, () => ({}));

	const seed = (seedData) => {
		merge(store, seedData); // mutates
	};

	const get = (query: RootQuery<S>, args = {}) => {
		ensureValidQuery(schema, query);
		return Promise.resolve(runQuery(query, { schema: schema, store }));
	};

	const compileQuery = (query: RootQuery<S>) => {
		ensureValidQuery(schema, query);
		return (args) => get(query, args);
	};

	return { compileQuery, get, seed };
}
