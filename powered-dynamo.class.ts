import {DynamoDB} from "aws-sdk";
import DynamoIterator from "dynamo-iterator";
import {EventEmitter} from "events";
import MaxRetriesReached from "./error.max-retries-reached.class";
import IPoweredDynamo from "./powered-dynamo.interface";
import DocumentClient = DynamoDB.DocumentClient;

const maxBatchWriteElems = 10;

enum EventType {
	retryableError = "retryableError",
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
	private iterator: DynamoIterator;

	constructor(
		private documentClient: DocumentClient,
		public eventEmitter = new EventEmitter(),
	) {
		this.iterator = new DynamoIterator(documentClient);
	}

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
		return this.iterator.scan(input);
	}

	public query(input: DocumentClient.QueryInput) {
		return this.iterator.query(input);
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
