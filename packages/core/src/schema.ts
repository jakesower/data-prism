/* eslint-disable no-use-before-define */
import { mapValues } from "lodash-es";

type LooseSchemaAttribute = {
	type: string;
	title?: string;
	description?: string;
	default?: any;
	$comment?: string;
	deprecated?: boolean;
	meta?: any;
};

type LooseSchemaRelationship = {
	readonly type: string;
	readonly cardinality: string;
	readonly inverse?: string;
};

type LooseSchemaResource = {
	idField?: string;
	attributes: { [k: string]: LooseSchemaAttribute };
	relationships: { [k: string]: LooseSchemaRelationship };
};

export type LooseSchema = {
	$schema?: string;
	$id?: string;
	title?: string;
	description?: string;
	meta?: any;
	version?: string;
	resources: { [k: string]: LooseSchemaResource };
};

type SchemaAttribute = {
	type: "object" | "array" | "boolean" | "string" | "number" | "integer" | "null";
	title?: string;
	description?: string;
	default?: any;
	$comment?: string;
	deprecated?: boolean;
	meta?: any;
};

type SchemaRelationship = {
	type: string;
	cardinality: "one" | "many";
	inverse?: string;
};

type SchemaResource = {
	idField?: string;
	attributes: { [k: string]: SchemaAttribute };
	relationships: { [k: string]: SchemaRelationship };
};

export type Schema = {
	$schema?: string;
	$id?: string;
	title?: string;
	description?: string;
	meta?: any;
	version?: string;
	resources: { [k: string]: SchemaResource };
};

type Concrete<Type> = {
	[Property in keyof Type]-?: Type[Property];
};

export type CompiledSchema<S extends Schema> = S & {
	resources: {
		[ResType in keyof S["resources"]]: Concrete<S["resources"][ResType]>;
	};
};

function ensureValidSchema(schema) {
	// TODO
}

export function compileSchema<S extends Schema>(schema: S): CompiledSchema<S> {
	ensureValidSchema(schema);

	return {
		...schema,
		resources: mapValues(schema.resources, (resDef) => ({
			idField: "id",
			attributes: {},
			relationships: {},
			...resDef,
		})),
	} as CompiledSchema<S>;
}
