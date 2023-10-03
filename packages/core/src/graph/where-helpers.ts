export function buildWhereExpression(whereClause: object, expressionEngine) {
	if (expressionEngine.isExpression(whereClause)) {
		const [name, params] = Object.entries(whereClause)[0] as any[];
		const built = Array.isArray(params)
			? params.map((p) => buildWhereExpression(p, expressionEngine))
			: buildWhereExpression(params, expressionEngine);

		return { [name]: built };
	}

	const whereExpressions = Object.entries(whereClause).map(([propPath, expr]) =>
		expressionEngine.isExpression(expr)
			? { $pipe: [{ $get: propPath }, expr] }
			: { $pipe: [{ $get: propPath }, { $eq: expr }] },
	);

	return whereExpressions.length > 1 ? { $and: whereExpressions } : whereExpressions[0];
}
