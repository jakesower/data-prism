import { expect, it, describe } from "vitest";
import { careBearData } from "./fixtures/care-bear-data.js";
import { createGraph } from "../src/index.js";
import { careBearSchema } from "./fixtures/care-bear-schema.js";

const graph = createGraph(careBearSchema, careBearData);

describe("tree queries", () => {
	describe("without expressions", () => {
		it("fetches a single resource with array notation", async () => {
			const result = await graph.getTree({
				type: "bears",
				id: "1",
				select: ["name"],
			});

			expect(result).toEqual({ name: "Tenderheart Bear" });
		});

		it("fetches a single resource with object notation", async () => {
			const result = await graph.getTree({
				type: "bears",
				id: "1",
				select: {
					name: "name",
				},
			});

			expect(result).toEqual({ name: "Tenderheart Bear" });
		});

		it("fetches a single resource with mixed notation", async () => {
			const result = await graph.getTree({
				type: "bears",
				id: "1",
				select: ["name", { yearIntroduced: "yearIntroduced" }],
			});

			expect(result).toEqual({ name: "Tenderheart Bear", yearIntroduced: 1982 });
		});

		it("fetches a single resource with its id", async () => {
			const result = await graph.getTree({
				type: "bears",
				id: "1",
				select: ["id", "name"],
			});

			expect(result).toEqual({ id: "1", name: "Tenderheart Bear" });
		});

		it("fetches a single resource without its id", async () => {
			const result = await graph.getTree({
				type: "bears",
				id: "1",
				select: ["name"],
			});

			expect(result).toEqual({ name: "Tenderheart Bear" });
		});

		it("fetches a single resource and maps property names", async () => {
			const result = await graph.getTree({
				type: "bears",
				id: "1",
				select: {
					nombre: "name",
				},
			});

			expect(result).toEqual({ nombre: "Tenderheart Bear" });
		});

		it("fetches a property from multiple resources", async () => {
			const result = await graph.getTrees({
				type: "bears",
				select: { name: "name" },
			});
			const expected = [
				"Tenderheart Bear",
				"Cheer Bear",
				"Wish Bear",
				"Smart Heart Bear",
			].map((name) => ({ name }));

			expect(result).toEqual(expected);
		});

		it("fetches null for a nonexistent resource", async () => {
			const result = await graph.getTree({ type: "bears", id: "6", select: ["id"] });

			expect(result).toEqual(null);
		});

		it("fetches a single resource with a many-to-one relationship", async () => {
			const q = {
				type: "bears",
				id: "1",
				select: ["home"],
			} as const;

			const result = await graph.getTree(q);

			expect(result).toEqual({
				home: { type: "homes", id: "1" },
			});
		});

		it("a single resource with a one-to-many relationship", async () => {
			const q = {
				type: "homes",
				id: "1",
				select: ["residents"],
			} as const;

			const result = await graph.getTree(q);

			expect(result).toEqual({
				residents: [
					{ type: "bears", id: "1" },
					{ type: "bears", id: "2" },
					{ type: "bears", id: "3" },
				],
			});
		});

		it("fetches a single resource with a subset of props", async () => {
			const result = await graph.getTree({
				type: "bears",
				id: "1",
				select: { id: "id", name: "name", furColor: "furColor" },
			});

			expect(result).toEqual({ id: "1", name: "Tenderheart Bear", furColor: "tan" });
		});

		it("fetches a single resource with a subset of props on a relationship", async () => {
			const q = {
				type: "bears",
				id: "1",
				select: { home: { select: { caringMeter: "caringMeter" } } },
			} as const;

			const result = await graph.getTree(q);

			expect(result).toEqual({ home: { caringMeter: 1 } });
		});

		it("uses explicitly set id fields", async () => {
			const result = await graph.getTree({
				type: "powers",
				id: "careBearStare",
				select: {
					powerId: "powerId",
				},
			});

			expect(result).toEqual({ powerId: "careBearStare" });
		});

		it("fetches a single resource with many-to-many relationship", async () => {
			const result = await graph.getTree({
				type: "bears",
				id: "1",
				select: ["powers"],
			});

			expect(result).toEqual({ powers: [{ type: "powers", id: "careBearStare" }] });
		});

		it("fetches multiple subqueries of various types", async () => {
			const result = await graph.getTree({
				type: "bears",
				id: "1",
				select: {
					home: {
						select: ["residents"],
					},
					powers: "powers",
				},
			});

			expect(result).toEqual({
				home: {
					residents: [
						{ type: "bears", id: "1" },
						{ type: "bears", id: "2" },
						{ type: "bears", id: "3" },
					],
				},
				powers: [{ type: "powers", id: "careBearStare" }],
			});
		});

		it("handles subqueries between the same type", async () => {
			const result = await graph.getTrees({
				type: "bears",
				select: {
					id: "id",
					bestFriend: "bestFriend",
				},
			});

			expect(result).toEqual([
				{ id: "1", bestFriend: null },
				{ id: "2", bestFriend: { type: "bears", id: "3" } },
				{ id: "3", bestFriend: { type: "bears", id: "2" } },
				{ id: "5", bestFriend: null },
			]);
		});

		it("fails validation for invalid types", async () => {
			expect(async () => {
				await graph.getTree({ type: "bearz", id: "1" });
			}).rejects.toThrowError();
		});

		it("fails validation for invalid top level props", async () => {
			await expect(async () => {
				await graph.getTree({ type: "bears", id: "1", select: { koopa: {} } });
			}).rejects.toThrowError();
		});

		describe("dot notation", () => {
			it("fetches nested fields with dot notation", async () => {
				const result = await graph.getTrees({
					type: "bears",
					select: {
						name: "name",
						residence: "home.name",
					},
				});

				expect(result).toEqual([
					{ name: "Tenderheart Bear", residence: "Care-a-Lot" },
					{ name: "Cheer Bear", residence: "Care-a-Lot" },
					{ name: "Wish Bear", residence: "Care-a-Lot" },
					{ name: "Smart Heart Bear", residence: null },
				]);
			});

			it("fetches doubly nested fields with dot notation", async () => {
				const result = await graph.getTrees({
					type: "bears",
					select: {
						name: "name",
						friendsResidence: "bestFriend.home.name",
					},
				});

				expect(result).toEqual([
					{ name: "Tenderheart Bear", friendsResidence: null },
					{ name: "Cheer Bear", friendsResidence: "Care-a-Lot" },
					{ name: "Wish Bear", friendsResidence: "Care-a-Lot" },
					{ name: "Smart Heart Bear", friendsResidence: null },
				]);
			});

			it("fetches mapped array data with dot notation", async () => {
				const result = await graph.getTrees({
					type: "homes",
					select: {
						name: "name",
						residentNames: "residents.name",
					},
				});

				expect(result).toEqual([
					{
						name: "Care-a-Lot",
						residentNames: ["Tenderheart Bear", "Cheer Bear", "Wish Bear"],
					},
					{ name: "Forest of Feelings", residentNames: [] },
					{ name: "Earth", residentNames: [] },
				]);
			});
		});
	});

	describe.skip("with expressions", () => {
		it("projects a field to a literal expression", async () => {
			const result = await graph.getTrees({
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
			const result = await graph.getTrees({
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
			const result = await graph.getTrees({
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
				{ name: "Smart Heart Bear", powerCount: 1 },
			]);
		});

		it("evaluates the minimum across one-to-many nested resources", async () => {
			const result = await graph.getTrees({
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
			const result = await graph.getTrees({
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
			const result = await graph.getTrees({
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
});
