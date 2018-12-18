"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const search_generator_class_1 = require("./search-generator.class");
class QueryGenerator extends search_generator_class_1.default {
    asyncSearch(input) {
        return new Promise((rs, rj) => this.documentClient.scan(input, (err, res) => err ? rj(err) : rs(res)));
    }
}
exports.default = QueryGenerator;
