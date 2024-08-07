import { formatRequest } from "./format-request.js";
import { parseResponse } from "./parse-response.js";
export function createJSONAPIStore(schema, config) {
    const { transport } = config;
    return {
        async get(query) {
            try {
                const req = formatRequest(schema, config, query);
                const res = await transport.get(req);
                return parseResponse(schema, query, res);
            }
            catch (err) {
                if (err.response.statusCode === 404) {
                    return null;
                }
                throw err;
            }
        },
    };
}
