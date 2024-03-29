import { expect, it, describe } from "vitest";
import { careBearData } from "./fixtures/care-bear-data.js";
import { createQueryGraph } from "../src/query-graph.js";

const graph = createQueryGraph(careBearData);

describe("select expressions", () => {
	it("projects a field to a literal expression", async () => {
		const result = graph.query({
			type: "bears",
			select: {
				beep: { $literal: "boop" },
			},
		});

		expect(result).toEqual([
			{ beep: "boop" },
			{ beep: "boop" },
			{ beep: "boop" },
			{ beep: "boop" },
		]);
	});

	it("projects a field to an expression", async () => {
		const result = graph.query({
			type: "homes",
			select: {
				name: "name",
				numberOfResidents: { $count: "residents" },
			},
		});

		expect(result).toEqual([
			{ name: "Care-a-Lot", numberOfResidents: 3 },
			{ name: "Forest of Feelings", numberOfResidents: 0 },
			{ name: "Earth", numberOfResidents: 0 },
		]);
	});

	it("applies expressions over a nested resource", async () => {
		const result = graph.query({
			type: "bears",
			select: {
				name: "name",
				powerCount: { $count: { $get: "powers" } },
			},
		});

		expect(result).toEqual([
			{ name: "Tenderheart Bear", powerCount: 1 },
			{ name: "Cheer Bear", powerCount: 1 },
			{ name: "Wish Bear", powerCount: 1 },
			{ name: "Smart Heart Bear", powerCount: 0 },
		]);
	});

	it("evaluates the minimum across one-to-many nested resources", async () => {
		const result = graph.query({
			type: "homes",
			select: {
				name: "name",
				minYear: { $min: "residents.$.yearIntroduced" },
			},
		});

		expect(result).toEqual([
			{ name: "Care-a-Lot", minYear: 1982 },
			{ name: "Forest of Feelings", minYear: undefined },
			{ name: "Earth", minYear: undefined },
		]);
	});

	it("evaluates the minimum across many-to-many nested resources", async () => {
		const result = graph.query({
			type: "powers",
			select: {
				name: "name",
				minYear: { $min: "wielders.$.yearIntroduced" },
			},
		});

		expect(result).toEqual([
			{ name: "Care Bear Stare", minYear: 1982 },
			{ name: "Make a Wish", minYear: undefined },
		]);
	});

	it("evaluates deeply nested values", async () => {
		const result = graph.query({
			type: "powers",
			select: {
				name: "name",
				caring: { $sum: "wielders.$.home.caringMeter" },
			},
		});

		expect(result).toEqual([
			{ name: "Care Bear Stare", caring: 3 },
			{ name: "Make a Wish", caring: 0 },
		]);
	});
});
