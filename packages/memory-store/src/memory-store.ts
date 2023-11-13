import { merge } from "lodash-es";
import {
	compileSchema,
	ensureValidQuery,
	RootQuery,
	SingleRootQuery,
	Schema,
	Result,
	createGraph,
} from "@data-prism/core";
import { defaultExpressionEngine } from "@data-prism/expressions";

export type InternalStore = { [k: string]: { [k: string]: any } };

export type Store<S extends Schema> = {
	compileQuery: <Q extends RootQuery<S>>(
		query: RootQuery<S>,
	) => (args?: object) => Promise<Result<Q>>;
	get: <Q extends RootQuery<S>>(query: Q, args?: object) => Promise<Result<Q>>;
	schema: S;
	seed: (seedData: object) => void;
	setState: (data: object) => void;
};

type StoreOptions = {
	initialData?: object;
};

export function createMemoryStore<S extends Schema>(
	schema: S,
	options: StoreOptions = {},
): Store<S> {
	const compiledSchema = compileSchema(schema);
	const expressionEngine = defaultExpressionEngine;

	let graph = createGraph(compiledSchema, options.initialData ?? {}, {
		expressionEngine,
	});

	// mutates
	const seed = (seedData) => {
		graph = createGraph(compiledSchema, merge(graph.data, seedData), {
			expressionEngine,
		});
	};

	const setState = (data) => {
		graph = createGraph(compiledSchema, data, {
			expressionEngine,
		});
	};

	const runQuery = <Q extends RootQuery<S>>(query: Q): Result<Q> => {
		return (
			"id" in query ? graph.getTree(query as SingleRootQuery<S>) : graph.getTrees(query)
		) as Result<Q>;
	};

	const get = (query: RootQuery<S>, args = {}) => {
		const compiledQuery = { ...query, ...args };
		ensureValidQuery(compiledQuery, {
			schema: compiledSchema,
			expressionEngine,
		});

		return Promise.resolve(runQuery({ ...query, ...args }));
	};

	const compileQuery = (query: RootQuery<S>) => {
		ensureValidQuery(query, {
			schema: compiledSchema,
			expressionEngine,
		});

		return (args = {}) => Promise.resolve(runQuery({ ...query, ...args }));
	};

	return { compileQuery, get, schema, seed, setState };
}
