import { defaultExpressionEngine } from "@data-prism/expressions";
import { mapValues, pick } from "lodash-es";
const { isExpression } = defaultExpressionEngine;
export function normalizeQuery(rootQuery) {
    const stringToProp = (str) => ({ [str]: str });
    const go = (query) => {
        const { select } = query;
        if (!select)
            throw new Error("queries must have a `select` clause");
        const selectObj = Array.isArray(select)
            ? select.reduce((selectObj, item) => {
                const subObj = typeof item === "string" ? stringToProp(item) : item;
                return { ...selectObj, ...subObj };
            }, {})
            : select;
        const subqueries = mapValues(selectObj, (sel) => typeof sel === "object" && !isExpression(sel) ? go(sel) : sel);
        const orderObj = query.order
            ? { order: !Array.isArray(query.order) ? [query.order] : query.order }
            : {};
        return {
            ...query,
            select: subqueries,
            ...orderObj,
        };
    };
    return go(rootQuery);
}
export function forEachSchemalessQuery(query, fn) {
    const go = (subquery, info) => {
        fn(subquery, info);
        Object.entries(subquery.select).forEach(([prop, select]) => {
            if (typeof select === "object" && !isExpression(select)) {
                const nextInfo = {
                    path: [...info.path, prop],
                    parent: subquery,
                };
                go(select, nextInfo);
            }
        });
    };
    const initInfo = {
        path: [],
        parent: null,
    };
    go(normalizeQuery(query), initInfo);
}
export function mapSchemalessQuery(query, fn) {
    const go = (subquery, info) => {
        const mappedSelect = mapValues(subquery.select, (select, prop) => {
            if (typeof select !== "object" || isExpression(select))
                return select;
            const nextInfo = {
                path: [...info.path, prop],
                parent: subquery,
            };
            return go(select, nextInfo);
        });
        return fn({ ...subquery, select: mappedSelect }, info);
    };
    const initInfo = {
        path: [],
        parent: null,
    };
    return go(normalizeQuery(query), initInfo);
}
export function reduceSchemalessQuery(query, fn, init) {
    const go = (subquery, info, accValue) => Object.entries(subquery.select).reduce((acc, [prop, select]) => {
        if (typeof select !== "object" || isExpression(select))
            return acc;
        const nextInfo = {
            path: [...info.path, prop],
            parent: subquery,
        };
        return go(select, nextInfo, acc);
    }, fn(accValue, subquery, info));
    const initInfo = {
        path: [],
        parent: null,
    };
    return go(normalizeQuery(query), initInfo, init);
}
export function forEachQuery(schema, query, fn) {
    const go = (subquery, info) => {
        const { path, type } = info;
        const resourceSchema = schema.resources[type];
        const attributes = Object.keys(resourceSchema.attributes).filter((a) => Object.values(subquery.select).includes(a));
        const relationships = pick(subquery.select, Object.keys(resourceSchema.relationships));
        const fullInfo = {
            ...info,
            attributes,
            relationships,
        };
        fn(subquery, fullInfo);
        Object.entries(subquery.select).forEach(([prop, select]) => {
            if (typeof select === "object" && !isExpression(select)) {
                const nextInfo = {
                    path: [...path, prop],
                    parent: subquery,
                    type: resourceSchema.relationships[prop].type,
                };
                go(select, nextInfo);
            }
        });
    };
    const initInfo = {
        path: [],
        parent: null,
        type: query.type,
    };
    go(normalizeQuery(query), initInfo);
}
export function mapQuery(schema, query, fn) {
    const go = (subquery, info) => {
        const { path, type } = info;
        const resourceSchema = schema.resources[type];
        const attributes = Object.keys(resourceSchema.attributes).filter((a) => Object.values(subquery.select).includes(a));
        const relationships = pick(subquery.select, Object.keys(resourceSchema.relationships));
        const fullInfo = {
            ...info,
            attributes,
            relationships,
        };
        const mappedSelect = mapValues(subquery.select, (select, prop) => {
            if (typeof select !== "object" || isExpression(select))
                return select;
            const nextInfo = {
                path: [...path, prop],
                parent: subquery,
                type: resourceSchema.relationships[prop].type,
            };
            return go(select, nextInfo);
        });
        return fn({ ...subquery, select: mappedSelect }, fullInfo);
    };
    const initInfo = {
        path: [],
        parent: null,
        type: query.type,
    };
    return go(normalizeQuery(query), initInfo);
}
export function reduceQuery(schema, query, fn, init) {
    const go = (subquery, info, accValue) => {
        const { path, type } = info;
        const resourceSchema = schema.resources[type];
        const attributes = Object.keys(resourceSchema.attributes).filter((a) => Object.values(subquery.select).includes(a));
        const relationships = pick(subquery.select, Object.keys(resourceSchema.relationships));
        const fullInfo = {
            ...info,
            attributes,
            relationships,
        };
        return Object.entries(subquery.select).reduce((acc, [prop, select]) => {
            if (typeof select !== "object" || isExpression(select))
                return acc;
            const nextInfo = {
                path: [...path, prop],
                parent: subquery,
                type: resourceSchema.relationships[prop].type,
            };
            return go(select, nextInfo, acc);
        }, fn(accValue, subquery, fullInfo));
    };
    const initInfo = {
        path: [],
        parent: null,
        type: query.type,
    };
    return go(normalizeQuery(query), initInfo, init);
}
export function ensureValidQuery(schema, query) {
    if (!query.type)
        throw new Error("root queries must have a `type`");
    const hasValidPath = (curType, remainingPath) => {
        if (remainingPath.length === 0)
            return true;
        const [head, ...tail] = remainingPath;
        if (tail.length === 0)
            return head in schema.resources[curType].attributes;
        const rel = schema.resources[curType].relationships[head];
        if (!rel)
            return false;
        return hasValidPath(rel.type, tail);
    };
    forEachQuery(schema, query, (subquery, info) => {
        Object.entries(subquery.where ?? {}).forEach(([whereKey, whereVal]) => {
            // TODO: Distribute $and, $or, and $not
            if (!defaultExpressionEngine.isExpression({ [whereKey]: whereVal }) &&
                !hasValidPath(info.type, whereKey.split("."))) {
                throw new Error(`"${whereKey}" is not a valid attribute or path to filter on for the "${info.type}" resource type`);
            }
        });
    });
}
