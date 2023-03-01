/*
	This file is used to detect data types from such things as CSVs where all of the field
	inputs are strings. Given that everything comes in as a string, "string" is the base
	type that everything falls into, obviating the need for a "mixed" or similar type.
*/

export type BaseType = "number" | "string" | "boolean" | "null" | "integer";

export type BaseDetector = { test: (val: string) => boolean } & (
	| { baseType: "string"; cast: (val: string) => string }
	| { baseType: "number"; cast: (val: string) => number }
	| { baseType: "integer"; cast: (val: string) => number }
	| { baseType: "boolean"; cast: (val: string) => boolean }
	| { baseType: "null"; cast: (val: string) => null }
);

export const baseTypeDetectors: BaseDetector[] = [
	{ baseType: "integer", test: (val) => Number.isInteger(Number(val)), cast: Number },
	{ baseType: "number", test: (val) => Number.isFinite(Number(val)), cast: Number },
	{
		baseType: "boolean",
		test: (val) => val === "true" || val === "false",
		cast: (val) => val === "true",
	},
	{ baseType: "null", test: (val) => val === "", cast: () => null },
	{ baseType: "string", test: () => true, cast: (val) => val },
];

const isNumeric = (val) => !isNaN(parseFloat(val)) && isFinite(val);

// type ColumnTypeTest<T> = { test: (val: string) => boolean; cast: (val: string) => T };
export const slotTypeTests = {
	number: { test: isNumeric, cast: Number },
	positive: { test: (val) => isNumeric(val) && Number(val) > 0, cast: Number },
	"non-negative": { test: (val) => isNumeric(val) && Number(val) >= 0, cast: Number },
	negative: { test: (val) => isNumeric(val) && Number(val) < 0, cast: Number },
	"non-positive": { test: (val) => isNumeric(val) && Number(val) <= 0, cast: Number },
	integer: { test: (val) => isNumeric(val) && Number.isInteger(val), cast: Number },
	string: { test: () => true, cast: (val) => val },
};

export type SlotType = keyof typeof slotTypeTests;

// obsolete?

export type Detector = {
	name: string;
	test: (val: string) => boolean;
	// cast: (val: unknown) => T;
};

export const columnDetectors: Detector[] = [
	{ name: "number", test: (val) => Number.isFinite(val) },
	{
		name: "positive",
		test: (val) => Number.isFinite(val) && Number.isFinite(val) && Number(val) > 0,
	},
	{
		name: "non-negative",
		test: (val) => Number.isFinite(val) && Number.isFinite(val) && Number(val) >= 0,
	},
	{
		name: "negative",
		test: (val) => Number.isFinite(val) && Number.isFinite(val) && Number(val) < 0,
	},
	{
		name: "non-positive",
		test: (val) => Number.isFinite(val) && Number.isFinite(val) && Number(val) <= 0,
	},
	{
		name: "integer",
		test: (val) => Number.isInteger(val),
	},
	{ name: "string", test: () => true },
];
