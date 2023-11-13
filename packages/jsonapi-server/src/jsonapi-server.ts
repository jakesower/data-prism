import { get as getQuery } from "./get.js";

type JSONAPIConfig = {
	supportedParams: ("include" | "fields" | "sort" | "page" | "filter")[]
	transport: any;
}

export function createJSONAPIStore(schema, config: JSONAPIConfig) {
	const fullStoreConfig = {
		...config,
	};

	return {
		get: async (query) =>
			getQuery(query, {
				config: fullStoreConfig,
				schema,
				query,
			}),
	};
}
