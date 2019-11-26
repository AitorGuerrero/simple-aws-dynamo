/* tslint:disable */
import {IDocumentClient} from "./powered-dynamo.class";
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

export default class FakeDocumentClient implements IDocumentClient {

    public scanQueueBatches: DynamoDB.DocumentClient.ScanOutput[] = [];
    private pendingFails: {[functionName: string]: Error[]} = {
        put: [],
        transactWrite: [],
    };

    public get(i: DocumentClient.GetItemInput, cb: (err: Error, data: DocumentClient.GetItemOutput) => unknown) {
		throw new Error("Method not implemented.");
	}
    public batchGet(i: DocumentClient.BatchGetItemInput, cb: (err: Error, data: DocumentClient.BatchGetItemOutput) => unknown) {
        throw new Error("Method not implemented.");
    }
    public put(i: DocumentClient.PutItemInput, cb: (err: Error, data: DocumentClient.PutItemOutput) => unknown) {
        const error = this.pendingFails.put.pop() || null;
        cb(error, {});
    }
    public update(i: DocumentClient.UpdateItemInput, cb: (err: Error, data: DocumentClient.UpdateItemOutput) => unknown) {
        throw new Error("Method not implemented.");
    }
    public delete(i: DocumentClient.DeleteItemInput, cb: (err: Error, data: DocumentClient.DeleteItemOutput) => unknown) {
        throw new Error("Method not implemented.");
    }
    public batchWrite(i: DocumentClient.BatchWriteItemInput, cb: (err: Error, data: DocumentClient.BatchWriteItemOutput) => unknown) {
        throw new Error("Method not implemented.");
    }
    public transactWrite(i: DocumentClient.TransactWriteItemsInput, cb: (err: Error, data: DocumentClient.TransactWriteItemsOutput) => unknown) {
        const error = this.pendingFails.transactWrite.pop() || null;
        cb(error, {});
    }
    public scan(i: DocumentClient.ScanInput, cb: (err: Error, data: DocumentClient.ScanOutput) => unknown) {
        cb(null, this.scanQueueBatches.shift());
    }
    public query(i: DocumentClient.QueryInput, cb: (err: Error, data: DocumentClient.QueryOutput) => unknown) {
        throw new Error("Method not implemented.");
    }

    public failOn(functionName: string, error: Error) {
        this.pendingFails[functionName].push(error);
    }
}
