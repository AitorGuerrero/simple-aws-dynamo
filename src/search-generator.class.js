"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class SearchGenerator {
    constructor(documentClient, input) {
        this.documentClient = documentClient;
        this.input = input;
        this.batch = [];
        this.sourceIsEmpty = false;
    }
    async next() {
        while (this.batch.length === 0 && this.sourceIsEmpty === false) {
            const dynamoResponse = await this.getNextBlock();
            this.batch = dynamoResponse.Items;
            this.sourceIsEmpty = dynamoResponse.LastEvaluatedKey === undefined;
        }
        if (this.batch.length === 0) {
            return;
        }
        return this.batch.shift();
    }
    async count() {
        const documentClientInput = Object.assign({}, this.input, { Select: "COUNT" });
        let total = 0;
        let response;
        do {
            response = await this.asyncSearch(documentClientInput);
            documentClientInput.ExclusiveStartKey = response.LastEvaluatedKey;
            total += response.Count;
        } while (response.LastEvaluatedKey);
        return total;
    }
    async getNextBlock() {
        if (this.sourceIsEmpty) {
            return;
        }
        const blockInput = Object.assign(this.input, { ExclusiveStartKey: this.lastEvaluatedKey });
        const response = await this.asyncSearch(blockInput);
        this.lastEvaluatedKey = response.LastEvaluatedKey;
        if (undefined === this.lastEvaluatedKey) {
            this.sourceIsEmpty = true;
        }
        return response;
    }
}
exports.default = SearchGenerator;
