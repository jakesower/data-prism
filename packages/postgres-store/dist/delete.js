"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteResource = deleteResource;
var lodash_es_1 = require("lodash-es");
function deleteResource(resource, context) {
    return __awaiter(this, void 0, void 0, function () {
        var config, schema, db, resConfig, joins, table, resSchema, _a, idAttribute, sql, foreignRelationships, m2mForeignRelationships;
        var _this = this;
        var _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    config = context.config, schema = context.schema;
                    db = config.db;
                    resConfig = config.resources[resource.type];
                    joins = resConfig.joins, table = resConfig.table;
                    resSchema = schema.resources[resource.type];
                    _a = resSchema.idAttribute, idAttribute = _a === void 0 ? "id" : _a;
                    sql = "\n    DELETE FROM ".concat(table, "\n    WHERE ").concat((0, lodash_es_1.snakeCase)(idAttribute), " = $1\n\t\tRETURNING *\n  ");
                    return [4 /*yield*/, db.query(sql, [resource.id])];
                case 1:
                    _d.sent();
                    foreignRelationships = (0, lodash_es_1.pickBy)((_b = resource.relationships) !== null && _b !== void 0 ? _b : {}, function (_, k) { return joins[k].foreignColumn; });
                    return [4 /*yield*/, Promise.all(Object.entries(foreignRelationships).map(function (_a) { return __awaiter(_this, [_a], void 0, function (_b) {
                            var foreignColumn, foreignTable;
                            var relName = _b[0], val = _b[1];
                            return __generator(this, function (_c) {
                                switch (_c.label) {
                                    case 0:
                                        foreignColumn = joins[relName].foreignColumn;
                                        foreignTable = config.resources[resSchema.relationships[relName].type].table;
                                        return [4 /*yield*/, db.query("\n\t\t\t\tUPDATE ".concat(foreignTable, "\n\t\t\t\tSET ").concat(foreignColumn, " = NULL\n\t\t\t\tWHERE ").concat(foreignColumn, " = $1\n\t\t\t"), [resource.id])];
                                    case 1:
                                        _c.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); }))];
                case 2:
                    _d.sent();
                    m2mForeignRelationships = (0, lodash_es_1.pickBy)((_c = resource.relationships) !== null && _c !== void 0 ? _c : {}, function (_, k) { return joins[k].joinTable; });
                    return [4 /*yield*/, Promise.all(Object.entries(m2mForeignRelationships).map(function (_a) { return __awaiter(_this, [_a], void 0, function (_b) {
                            var _c, joinTable, localJoinColumn;
                            var relName = _b[0], val = _b[1];
                            return __generator(this, function (_d) {
                                switch (_d.label) {
                                    case 0:
                                        _c = joins[relName], joinTable = _c.joinTable, localJoinColumn = _c.localJoinColumn;
                                        return [4 /*yield*/, Promise.all(val.map(function (v) {
                                                return db.query("\n\t\t\t\t\t\t\tDELETE FROM ".concat(joinTable, "\n              WHERE ").concat(localJoinColumn, " = $1\n\t\t\t"), [resource.id]);
                                            }))];
                                    case 1:
                                        _d.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); }))];
                case 3:
                    _d.sent();
                    return [2 /*return*/, {
                            type: resource.type,
                            id: resource.id,
                        }];
            }
        });
    });
}
