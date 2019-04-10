import {DynamoDB} from "aws-sdk";
import DocumentClient = DynamoDB.DocumentClient;
import {EventEmitter} from "events";
import MaxRetriesReached from "./error.max-retries-reached.class";
import IPoweredDynamo from "./powered-dynamo.interface";
import QuerySearchGenerator, {IQueryDocumentClient} from "./query-generator.class";
import ScanSearchGenerator, {IScanDocumentClient} from "./scan-generator.class";

const maxBatchWriteElems = 10;

enum EventType {
	retryableError = "retryableError",
}

export interface IDocumentClient extends IScanDocumentClient, IQueryDocumentClient {
	get(i: DocumentClient.GetItemInput, cb: (err: Error, data: DocumentClient.GetItemOutput) => unknown): unknown;
	batchGet(
		i: DocumentClient.BatchGetItemInput,
		cb: (err: Error, data: DocumentClient.BatchGetItemOutput) => unknown,
	): unknown;
	put(i: DocumentClient.PutItemInput, cb: (err: Error, data: DocumentClient.PutItemOutput) => unknown): unknown;
	update(i: DocumentClient.UpdateItemInput, cb: (err: Error, data: DocumentClient.UpdateItemOutput) => unknown): unknown;
	delete(i: DocumentClient.DeleteItemInput, cb: (err: Error, data: DocumentClient.DeleteItemOutput) => unknown): unknown;
	batchWrite(
		i: DocumentClient.BatchWriteItemInput,
		cb: (err: Error, data: DocumentClient.BatchWriteItemOutput) => unknown,
	): unknown;
	transactWrite(
		i: DocumentClient.TransactWriteItemsInput,
		cb: (err: Error, data: DocumentClient.TransactWriteItemsOutput) => unknown,
	): unknown;
}

export default class PoweredDynamo implements IPoweredDynamo {

	private static splitBatchWriteRequestsInChunks(request: DocumentClient.BatchWriteItemInput) {
		const requests: Array<{tableName: string, request: DocumentClient.WriteRequest}> = [];
		const batches: DocumentClient.BatchWriteItemRequestMap[] = [];
		for (const tableName of Object.keys(request.RequestItems)) {
			for (const itemRequest of request.RequestItems[tableName]) {
				requests.push({tableName, request: itemRequest});
			}
		}
		for (let i = 0; i < requests.length; i += maxBatchWriteElems) {
			const batchRequestMap: DocumentClient.BatchWriteItemRequestMap = {};
			for (const itemRequest of requests.slice(i, i + maxBatchWriteElems)) {
				batchRequestMap[itemRequest.tableName] = [].concat(
					batchRequestMap[itemRequest.tableName] || [],
					itemRequest.request,
				);
			}
			batches.push(batchRequestMap);
		}

		return batches;
	}

	private static isInternalServerError(error: Error) {
		return error.name === "InternalServerError";
	}

	private static isRetryableTransactionError(err: Error) {
		return err.name === "TransactionCanceledException"
			&& /ConditionalCheckFailed/.test(err.message) === false
			&& /TransactionConflict/.test(err.message);
	}

	public retryWaitTimes: number[] = [100, 500, 1000];

	constructor(
		private documentClient: IDocumentClient,
		public eventEmitter = new EventEmitter(),
	) {}

	public get(input: DocumentClient.GetItemInput) {
		return new Promise<DocumentClient.GetItemOutput>(
			(rs, rj) => this.documentClient.get(input, (err, output) => err ? rj(err) : rs(output)),
		);
	}
	public async getList(tableName: string, keys: DocumentClient.Key[]) {
		const uniqueKeys: DocumentClient.Key = filterRepeatedKeys(keys);
		const result = new Map<DocumentClient.Key, DocumentClient.AttributeMap>();
		const batchProcesses: Array<Promise<void>> = [];
		for (let i = 0; i < uniqueKeys.length; i += 10) {
			batchProcesses.push(new Promise(async (rs, rj) => {
				try {
					const keysBatch: DocumentClient.Key[] = uniqueKeys.slice(i, i + 10);
					const input: DocumentClient.BatchGetItemInput = {
						RequestItems: {[tableName]: {Keys: keysBatch}},
					};
					const response = await this.asyncBatchGet(input);
					for (const item of response.Responses[tableName]) {
						result.set(keysBatch.find((k) => sameKey(k, item)), item);
					}
					rs();
				} catch (err) {
					rj(err);
				}
			}));
		}
		await Promise.all(batchProcesses);

		return result;
	}

	public scan(input: DocumentClient.ScanInput) {
		return new ScanSearchGenerator(this.documentClient, input);
	}

	public query(input: DocumentClient.QueryInput) {
		return new QuerySearchGenerator(this.documentClient, input);
	}

	public put(input: DocumentClient.PutItemInput) {
		return this.retryInternalServerError(
			() => new Promise((rs, rj) => this.documentClient.put(input, (err, output) => err ? rj(err) : rs(output))),
		);
	}

	public update(input: DocumentClient.UpdateItemInput) {
		return this.retryInternalServerError(
			() => new Promise((rs, rj) => this.documentClient.update(input, (err, output) => err ? rj(err) : rs(output))),
		);
	}

	public delete(input: DocumentClient.DeleteItemInput) {
		return this.retryInternalServerError(
			() => new Promise((rs, rj) => this.documentClient.delete(input, (err, output) => err ? rj(err) : rs(output))),
		);
	}

	public async batchWrite(request: DocumentClient.BatchWriteItemInput) {
		for (const batch of PoweredDynamo.splitBatchWriteRequestsInChunks(request)) {
			await this.retryInternalServerError(() => this.asyncBatchWrite(Object.assign(request, {RequestItems: batch})));
		}
	}

	public async transactWrite(input: DocumentClient.TransactWriteItemsInput) {
		await this.retryTransactionCancelledServerError(() =>
			this.retryInternalServerError(() => this.asyncTransactWrite(input)),
		);
	}

	private async retryTransactionCancelledServerError<O>(execution: () => Promise<O>) {
		return this.retryError(
			PoweredDynamo.isRetryableTransactionError,
			execution,
		);
	}

	private async retryInternalServerError<O>(execution: () => Promise<O>) {
		return this.retryError(
			PoweredDynamo.isInternalServerError,
			execution,
		);
	}

	private async retryError<O>(
		isRetryable: (err: Error) => boolean,
		execution: () => Promise<O>,
		tryCount = 0,
	): Promise<O> {
		try {
			return await execution();
		} catch (error) {
			if (isRetryable(error)) {
				this.eventEmitter.emit(EventType.retryableError, error);
				if (this.retryWaitTimes[tryCount] === undefined) {
					throw new MaxRetriesReached();
				}
				await new Promise((rs) => setTimeout(rs, this.retryWaitTimes[tryCount]));
				return await this.retryError(isRetryable, execution, tryCount + 1);
			}

			throw error;
		}
	}

	private asyncBatchGet(input: DynamoDB.DocumentClient.BatchGetItemInput) {
		return new Promise<DocumentClient.BatchGetItemOutput>(
			(rs, rj) => this.documentClient.batchGet(input, (err, res) => err ? rj(err) : rs(res)),
		);
	}

	private  async asyncTransactWrite(input: DocumentClient.TransactWriteItemsInput) {
		await new Promise((rs, rj) => this.documentClient.transactWrite(input, (err, output) => err ? rj(err) : rs(output)));
	}

	private async asyncBatchWrite(input: DocumentClient.BatchWriteItemInput) {
		await new Promise((rs, rj) => this.documentClient.batchWrite(
			input,
			(err, output) => err ? rj(err) : rs(output)),
		);
	}
}

function filterRepeatedKeys(arrArg: DocumentClient.Key[]) {
	return arrArg.reduce(
		(output, key) => output.some(
			(k2: DocumentClient.Key) => sameKey(key, k2),
		) ? output : output.concat([key]),
		[] as DocumentClient.Key[],
	);
}

function sameKey(key1: DocumentClient.Key, key2: DocumentClient.Key) {
	return Object.keys(key1).every((k) => key2[k] === key1[k]);
}
