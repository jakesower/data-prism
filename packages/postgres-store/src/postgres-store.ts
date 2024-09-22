import { normalizeQuery, RootQuery, Schema } from "data-prism";
import { query as getQuery } from "./query.js";
import { create } from "./create.js";
import { deleteResource } from "./delete.js";
import { update } from "./update.js";
import { getAll, getOne, GetOptions } from "./get.js";
import { Client } from "pg";

export type Resource = {
	type: string;
	id: any;
	attributes: object;
	relationships?: object;
};

type CreateResource = {
	type: string;
	attributes?: object;
	relationships?: object;
};

type UpdateResource = {
	type: string;
	id: any;
	attributes?: object;
	relationships?: object;
};

type DeleteResource = {
	type: string;
	id: any;
};

export type LocalJoin = { localColumn: string; localColumnType?: string };
export type ForeignJoin = { foreignColumn: string; foreignColumnType?: string };
export type ManyToManyJoin = {
	joinTable: string;
	localJoinColumn: string;
	localJoinColumnType?: string;
	foreignJoinColumn: string;
	foreignJoinColumnType?: string;
};

export type Config = {
	db: Client;
	resources: {
		[k: string]: {
			table: string;
			idType?: string;
			columns?: {
				[k: string]: {
					select?: (table: string, col: string) => string;
				};
			};
			joins?: {
				[k: string]: LocalJoin | ForeignJoin | ManyToManyJoin;
			};
		};
	};
};

export type Context = {
	config: Config;
	schema: Schema;
};

type PostgresStore = {
	getAll: (type: string, options?: GetOptions) => Promise<Resource[]>;
	getOne: (type: string, id: string, options?: GetOptions) => Promise<Resource>;
	create: (resource: CreateResource) => Promise<Resource>;
	update: (resource: UpdateResource) => Promise<Resource>;
	delete: (resource: DeleteResource) => Promise<DeleteResource>;
	query: (query: RootQuery) => Promise<any>;
};

export function createPostgresStore(
	schema: Schema,
	config: Config,
): PostgresStore {
	return {
		async getAll(type, options = {}) {
			return getAll(type, { config, options, schema });
		},
		async getOne(type, id, options = {}) {
			return getOne(type, id, { config, options, schema });
		},
		async create(resource) {
			return create(resource, { config, schema });
		},
		async update(resource) {
			return update(resource, { config, schema });
		},
		async delete(resource) {
			return deleteResource(resource, { config, schema });
		},
		async query(query) {
			const normalized = normalizeQuery(query);

			return getQuery(normalized, {
				config,
				schema,
				query: normalized,
			});
		},
	};
}