/* tslint:disable */
import {DynamoDB} from 'aws-sdk';

import DocumentClient = DynamoDB.DocumentClient;

export class InternalServerError extends Error {
    constructor() {
        super();
        this.name = "InternalServerError"
    }
}

export class TransactionCanceledException extends Error {
    constructor(errors: (ConditionalCheckFailed | TransactionConflict)[]) {
        super(`Transaction cancelled, please refer cancellation reasons for specific reasons [${errors.map((e) => e.name).join(",")}]`);
        this.name = "TransactionCanceledException"
    }
}

export class ConditionalCheckFailed extends Error {
    constructor() {
        super();
        this.name = "ConditionalCheckFailed"
    }
}

export class TransactionConflict extends Error {
    constructor() {
        super();
        this.name = "TransactionConflict"
    }
}

export default class FakeDocumentClient {

    public scanQueueBatches: DynamoDB.DocumentClient.ScanOutput[] = [];
    private pendingFails: {[functionName: string]: Error[]} = {
        put: [],
        transactWrite: [],
    };

    public put(i: DocumentClient.PutItemInput, cb: (err: Error, data: DocumentClient.PutItemOutput) => unknown) {
        const error = this.pendingFails.put.pop() || null;
        cb(error, {});
    }
    public transactWrite(i: DocumentClient.TransactWriteItemsInput, cb: (err: Error, data: DocumentClient.TransactWriteItemsOutput) => unknown) {
        const error = this.pendingFails.transactWrite.pop() || null;
        cb(error, {});
    }
    public scan(i: DocumentClient.ScanInput, cb: (err: Error, data: DocumentClient.ScanOutput) => unknown) {
        cb(null, this.scanQueueBatches.shift());
    }
    public failOn(functionName: string, error: Error) {
        this.pendingFails[functionName].push(error);
    }
}
