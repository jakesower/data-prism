import express from "express";
import { create } from "./create.js";
import { update } from "./update.js";
import { deleteHandler } from "./delete.js";
import { get } from "./get.js";
export function createJSONAPIHandlers(schema, store) {
    return {
        getAllHandler: (type) => get(schema, store, type),
        getOneHandler: (type) => get(schema, store, type),
        createHandler: () => create(store),
        updateHandler: () => update(store),
        deleteHandler: (type) => deleteHandler(type, store),
    };
}
export function applySchemaRoutes(schema, store, app) {
    const server = createJSONAPIHandlers(schema, store);
    Object.keys(schema.resources).forEach((type) => {
        app.get(`/${type}`, server.getAllHandler(type));
        app.get(`/${type}/:id`, server.getOneHandler(type));
        app.post(`/${type}`, server.createHandler(type));
        app.patch(`/${type}/:id`, server.updateHandler(type));
        app.delete(`/${type}/:id`, server.deleteHandler(type));
    });
}
export function createServer(schema, store, options = {}) {
    const app = express();
    app.use(express.json());
    const { port = 3000 } = options;
    applySchemaRoutes(schema, store, app);
    app.get("/", (req, res) => {
        res.send("OK");
    });
    app.listen(port, "0.0.0.0", () => {
        console.log(`running on port ${port}`);
    });
}
