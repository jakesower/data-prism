import { describe, expect, it } from "vitest";
import { evaluate } from "../src/expressions";

const kids = {
	xinema: { name: "Ximena", age: 4 },
	yousef: { name: "Yousef", age: 5 },
	zoe: { name: "Zoe", age: 6 },
};

describe("core expressions (using $eq)", () => {
	it("should evaluate an equality expression", () => {
		const result = evaluate({ $eq: [3, 3] });
		expect(result).toBe(true);
	});

	it("should treat non-expression objects as literals", () => {
		const notExp = { $notAnExpression: 4 };
		expect(evaluate(notExp)).toEqual(notExp);
	});

	it("doesn't evaluate contents of $literal expressions", () => {
		const exp = { $literal: { $prop: "age" } };
		expect(evaluate(exp, kids.xinema)).toEqual({ $prop: "age" });
	});

	it("compiles and runs values that resolve to false", async (t) => {
		const result = evaluate({ $eq: [3, 6] }, {});
		expect(result).toBe(false);
	});

	it("looks up a variable", () => {
		expect(evaluate({ $prop: "age" }, kids.xinema)).toEqual(4);
	});

	it("should evaluate expressions within an array", () => {
		const result = evaluate([1, { $prop: "age" }], kids.xinema);
		expect(result).toEqual([1, 4]);
	});

	it("should evaluate expressions within an object", () => {
		const result = evaluate([1, { moo: { $prop: "age" } }], kids.xinema);
		expect(result).toEqual([1, { moo: 4 }]);
	});

	it("should evaluate an expression within an expression", () => {
		const result = evaluate({ $eq: [true, { $eq: [4, { $prop: "age" }] }] }, kids.xinema);
		expect(result).toBe(true);
	});

	it("looks up variables within an expression", async (t) => {
		expect(evaluate({ $eq: [4, { $prop: "age" }] }, kids.xinema)).toBe(true);
		expect(evaluate({ $eq: [4, { $prop: "age" }] }, kids.yousef)).toBe(false);
		expect(evaluate({ $eq: [4, { $prop: "age" }] }, kids.zoe)).toBe(false);
	});

	it("doesn't evaluate contents of $literal expressions", () => {
		const exp = { $literal: { $prop: "age" } };
		expect(evaluate(exp, kids.xinema)).toEqual({ $prop: "age" });
	});
});

describe("the $eq expression", () => {
	it("is determined deeply", async (t) => {
		const result = evaluate({
			$eq: [
				[3, { chicken: "butt" }],
				[3, { chicken: "butt" }],
			],
		});
		expect(result).toBe(true);
	});
});

it("implements the $gt expression", () => {
	const exp = {
		$gt: [{ $prop: "age" }, 5],
	};

	expect(evaluate(exp, kids.xinema)).toBe(false);
	expect(evaluate(exp, kids.yousef)).toBe(false);
	expect(evaluate(exp, kids.zoe)).toBe(true);
});

it("implements the $gte expression", () => {
	const exp = {
		$gte: [{ $prop: "age" }, 5],
	};

	expect(evaluate(exp, kids.xinema)).toBe(false);
	expect(evaluate(exp, kids.yousef)).toBe(true);
	expect(evaluate(exp, kids.zoe)).toBe(true);
});

it("implements the $lt expression", () => {
	const exp = {
		$lt: [{ $prop: "age" }, 5],
	};

	expect(evaluate(exp, kids.xinema)).toBe(true);
	expect(evaluate(exp, kids.yousef)).toBe(false);
	expect(evaluate(exp, kids.zoe)).toBe(false);
});

it("implements the $lte expression", () => {
	const exp = {
		$lte: [{ $prop: "age" }, 5],
	};

	expect(evaluate(exp, kids.xinema)).toBe(true);
	expect(evaluate(exp, kids.yousef)).toBe(true);
	expect(evaluate(exp, kids.zoe)).toBe(false);
});

it("implements the $ne expression", () => {
	const exp = {
		$ne: [{ $prop: "age" }, 5],
	};

	expect(evaluate(exp, kids.xinema)).toBe(true);
	expect(evaluate(exp, kids.yousef)).toBe(false);
	expect(evaluate(exp, kids.zoe)).toBe(true);
});

it("implements the $in expression", () => {
	const exp = {
		$in: { needle: { $prop: "age" }, haystack: [4, 6] },
	};

	expect(evaluate(exp, kids.xinema)).toBe(true);
	expect(evaluate(exp, kids.yousef)).toBe(false);
	expect(evaluate(exp, kids.zoe)).toBe(true);
});

it("implements the $nin expression", () => {
	const exp = {
		$nin: { needle: { $prop: "age" }, haystack: [4, 6] },
	};

	expect(evaluate(exp, kids.xinema)).toBe(false);
	expect(evaluate(exp, kids.yousef)).toBe(true);
	expect(evaluate(exp, kids.zoe)).toBe(false);
});
