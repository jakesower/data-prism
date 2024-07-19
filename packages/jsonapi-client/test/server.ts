import express from "express";
import { Schema, createStore } from "data-prism";
import { parseRequest } from "../src/parse-response.js";
import careBearSchema from "./fixtures/care-bears.schema.json" assert { type: "json" };
import { careBearData } from "./fixtures/care-bear-data.js"; // eslint-disable-line
import { formatResponse } from "../src/format-request.js";

function applySchemaRoutes(schema: Schema, store, app) {
	Object.entries(schema.resources).forEach(([type, resDef]) => {
		app.get(`/${type}`, (req, res) => {
			console.log(req.query);
			const query = parseRequest(schema, {
				...req.query,
				type,
				id: req.params.id,
			});
			const result = store.query(query);
			const response = formatResponse(schema, query, result);
			res.json(response);
		});

		app.get(`/${type}/:id`, (req, res) => {
			const query = parseRequest(schema, {
				...req.query,
				type,
				id: req.params.id,
			});
			const result = store.query(query);
			const response = formatResponse(schema, query, result);
			res.json(response);
		});
	});
}

const app = express();
// app.set("query parser", "simple");

const store = createStore(careBearSchema as Schema, careBearData);

applySchemaRoutes(careBearSchema as Schema, store, app);

app.listen(3000, "0.0.0.0", () => {
	console.log("running on port 3000");
});
