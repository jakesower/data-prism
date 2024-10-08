import { camelCase, pick, pickBy, snakeCase } from "lodash-es";

export async function create(resource, context) {
	const { config, schema } = context;

	const { db } = config;

	const resConfig = config.resources[resource.type];
	const { joins, table } = resConfig;

	const resSchema = schema.resources[resource.type];
	const { idAttribute = "id" } = resSchema;

	const attributeColumns = Object.keys(resource.attributes).map(snakeCase);
	const attributePlaceholders = Object.keys(resource.attributes).map(
		(key, idx) => {
			const placeholder =
				resConfig.columns?.[key]?.placeholder ?? ((idx) => `$${idx}`);
			return placeholder(idx + 1);
		},
	);

	const localRelationships = pickBy(
		resource.relationships ?? {},
		(_, k) => joins[k].localColumn,
	);

	const relationshipColumns = Object.keys(localRelationships).map(
		(r) => resConfig.joins[r].localColumn,
	);
	const relationshipPlaceholders = Object.keys(localRelationships)
		.map((r) => resConfig.joins[r].localColumn)
		.map((_, idx) => `$${idx + attributePlaceholders.length + 1}`);

	const columns = [...attributeColumns, ...relationshipColumns].join(", ");
	const placeholders = [
		...attributePlaceholders,
		...relationshipPlaceholders,
	].join(", ");
	const vars = [
		...Object.values(resource.attributes),
		...Object.values(localRelationships).map((r) => r?.id ?? null),
	];

	const sql = `
    INSERT INTO ${table}
      (${columns})
    VALUES
      (${placeholders})
		RETURNING *
  `;

	const { rows } = await db.query(sql, vars);
	const created = {};
	Object.entries(rows[0]).forEach(([k, v]) => {
		created[camelCase(k)] = v;
	});

	// handle to-one foreign columns
	const foreignRelationships = pickBy(
		resource.relationships ?? {},
		(_, k) => joins[k].foreignColumn,
	);

	await Promise.all(
		Object.entries(foreignRelationships).map(async ([relName, val]) => {
			const { foreignColumn } = joins[relName];
			const foreignIdAttribute =
				schema.resources[resSchema.relationships[relName].type].idAttribute ??
				"id";
			const foreignTable =
				config.resources[resSchema.relationships[relName].type].table;

			await db.query(
				`
				UPDATE ${foreignTable}
				SET ${foreignColumn} = NULL
				WHERE ${foreignColumn} = $1
			`,
				[resource.id],
			);

			await db.query(
				`
				UPDATE ${foreignTable}
				SET ${foreignColumn} = $1
				WHERE ${foreignIdAttribute} = ANY ($2)
			`,
				[created[idAttribute], val.map((v) => v.id)],
			);
		}),
	);

	// handle many-to-many columns
	const m2mForeignRelationships = pickBy(
		resource.relationships ?? {},
		(_, k) => joins[k].joinTable,
	);

	await Promise.all(
		Object.entries(m2mForeignRelationships).map(async ([relName, val]) => {
			const { joinTable, localJoinColumn, foreignJoinColumn } = joins[relName];

			await Promise.all(
				val.map((v) =>
					db.query(
						`
							INSERT INTO ${joinTable}
							(${localJoinColumn}, ${foreignJoinColumn})
							VALUES ($1, $2)
			`,
						[created[idAttribute], v.id],
					),
				),
			);
		}),
	);

	return {
		type: resource.type,
		id: created[idAttribute],
		attributes: pick(created, Object.keys(resSchema.attributes)),
		relationships: resource.relationships ?? {},
	};
}
