import { SlotType, baseTypeDetectors, slotTypeTests } from "./string-type-detectors";

// type JSONPrimitive = number | string | boolean | null | JSONPrimitive[] | { [k: string]: JSONPrimitive };
type SimplePrimitive = number | string | boolean | null;

export type Property = {
	type:
		| "string"
		| "boolean"
		| "array"
		| "object"
		| "integer"
		| "number"
		| "null"
		| "mixed";
	title?: string;
	description?: string;
	slotTypes?: SlotType[];
	[k: string]: unknown;
};

type ColumnBaseType = Property["type"]; // | Property["type"][];

export type Record = { [k: string]: string | number | boolean | null };
export type Column = {
	type: ColumnBaseType;
	slotTypes: SlotType[];
	values: (string | number | boolean | null)[];
	description?: string;
	title?: string;
};

export type ColumnObj = { [k: string]: Column };
export type ColumnArray = Column[];

export type Schema = { properties: { [k: string]: Property } };

export type Table = {
	columns: { [k: string | number]: Column };
	rows: { [k: string]: SimplePrimitive }[];
	columnNameMap?: { [k: string]: number };
};

export type Source = {
	name: string;
	table: Table;
	schema?: Schema;
};

export function detectBaseColumnType(vals: string[]): ColumnBaseType {
	const found = baseTypeDetectors.find((detector) =>
		vals.every((val) => detector.test(val)),
	);

	return found.baseType;
}

export function detectColumnSlotTypes(vals: string[]): SlotType[] {
	const slotTypes = Object.keys(slotTypeTests) as (keyof typeof slotTypeTests)[];
	return slotTypes.filter((testName) => vals.every(slotTypeTests[testName].test));
}

export function detectColumns(rawCsvRecords: { [k: string]: string }[]): ColumnObj {
	if (rawCsvRecords.length === 0) return {};

	const columnNames = Object.keys(rawCsvRecords[0]);

	// TODO: this is wildly inefficient
	return columnNames.reduce((acc, colName) => {
		const columnValues = rawCsvRecords.map((r) => r[colName]);

		return {
			...acc,
			[colName]: {
				type: detectBaseColumnType(rawCsvRecords.map((r) => r[colName])),
				slotTypeTests: detectColumnSlotTypes(rawCsvRecords.map((r) => r[colName])),
				values: columnValues,
			},
		};
	}, {});
}
