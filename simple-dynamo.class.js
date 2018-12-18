"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const query_generator_class_1 = require("./query-generator.class");
const scan_generator_class_1 = require("./scan-generator.class");
class SimpleDynamo {
    constructor(documentClient) {
        this.documentClient = documentClient;
    }
    get(input) {
        return new Promise((rs, rj) => this.documentClient.get(input, (err, output) => err ? rj(err) : rs(output)));
    }
    async getList(tableName, keys) {
        const input = {
            RequestItems: {
                [tableName]: { Keys: uniqueKeys(keys) },
            },
        };
        const response = await new Promise((rs, rj) => this.documentClient.batchGet(input, (err, res) => err ? rj(err) : rs(res)));
        const result = new Map();
        for (const item of response.Responses[tableName]) {
            result.set(keys.find((k) => sameKey(k, item)), item);
        }
        return result;
    }
    scan(input) {
        return new scan_generator_class_1.default(this.documentClient, input);
    }
    query(input) {
        return new query_generator_class_1.default(this.documentClient, input);
    }
    put(input) {
        return new Promise((rs, rj) => this.documentClient.put(input, (err, output) => err ? rj(err) : rs(output)));
    }
    update(input) {
        return new Promise((rs, rj) => this.documentClient.update(input, (err, output) => err ? rj(err) : rs(output)));
    }
    transactWrite(input) {
        return new Promise((rs, rj) => this.documentClient.transactWrite(input, (err, output) => err ? rj(err) : rs(output)));
    }
}
exports.default = SimpleDynamo;
function uniqueKeys(arrArg) {
    return arrArg.reduce((output, key) => output.some((k2) => sameKey(key, k2)) ? output : output.concat([key]), []);
}
function sameKey(key1, key2) {
    return Object.keys(key1).every((k) => key2[k] === key1[k]);
}
