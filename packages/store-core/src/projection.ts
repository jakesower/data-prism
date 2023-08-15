import { mapValues } from "lodash-es";
import {
	Expression,
	TERMINAL_EXPRESSIONS,
	defaultExpressionEngine,
} from "@data-prism/expressions";

export type Projection = {
	[k: string]: any;
};

function distributeStrings(expression) {
	const { isExpression } = defaultExpressionEngine;

	if (typeof expression === "string") {
		const [iteratee, ...rest] = expression.split(".$.");
		if (rest.length === 0) return { $get: expression };

		return {
			$pipe: [
				{ $get: iteratee },
				{ $flatMap: distributeStrings(rest.join(".$.")) },
				{ $filter: { $defined: {} } },
			],
		};
	}

	if (!isExpression(expression)) {
		return Array.isArray(expression)
			? expression.map(distributeStrings)
			: typeof expression === "object"
				? mapValues(expression, distributeStrings)
				: expression;
	}

	const [expressionName, expressionArgs] = Object.entries(expression)[0];

	return TERMINAL_EXPRESSIONS.includes(expressionName)
		? expression
		: { [expressionName]: distributeStrings(expressionArgs) };
}

/**
 * Takes a query and returns the fields that will need to be fetched to ensure
 * all expressions within the query are usable.
 *
 * @param projection - Projection
 * @returns object
 */
export function projectionQueryProperties(projection: Projection) {
	const { isExpression } = defaultExpressionEngine;
	const projectionTerminalExpressions = ["$literal", "$var"];

	const go = (val) => {
		if (isExpression(val)) {
			const [exprName, exprVal] = Object.entries(val)[0];
			if (projectionTerminalExpressions.includes(exprName)) {
				return [];
			}

			return go(exprVal);
		}

		if (Array.isArray(val)) {
			return val.map(go);
		}

		if (typeof val === "object") {
			return Object.values(val).map(go);
		}

		return [val.split(".").filter((v) => v !== "$")];
	};

	// mutates!
	const makePath = (obj, path) => {
		const [head, ...tail] = path;

		if (tail.length === 0) {
			obj[head] = head;
			return;
		}

		if (!obj[head]) obj[head] = { properties: {} };
		makePath(obj[head].properties, tail);
	};

	const propertyPaths = Object.values(projection).flatMap(go);
	const query = {};
	propertyPaths.forEach((path) => makePath(query, path));

	return query;
}

export function createExpressionProjector(expression: Expression) {
	const { apply } = defaultExpressionEngine;
	const expr = distributeStrings(expression);

	return (result) => apply(expr, result);
}
