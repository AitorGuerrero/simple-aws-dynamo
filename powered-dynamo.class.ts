import {DynamoDB} from "aws-sdk";
import DynamoIterator from "dynamo-iterator";
import ScanIterator from "dynamo-iterator/scan-iterator.class";
import {EventEmitter} from "events";
import MaxRetriesReached from "./error.max-retries-reached.class";
import DocumentClient = DynamoDB.DocumentClient;

const maxBatchWriteElems = 25;
const maxBatchGetElems = 100;

enum EventType {
	retryableError = "retryableError",
}

export default class PoweredDynamo {

	private static splitBatchWriteRequestsInChunks(request: DocumentClient.BatchWriteItemInput) {
		const requests: {tableName: string, request: DocumentClient.WriteRequest}[] = [];
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
		return this.documentClient.get(input).promise();
	}

	public async getList(tableName: string, keys: DocumentClient.Key[]) {
		const uniqueKeys: DocumentClient.Key = filterRepeatedKeys(keys);
		const result = new Map<DocumentClient.Key, DocumentClient.AttributeMap>();
		const batchProcesses: Promise<void>[] = [];
		for (let i = 0; i < uniqueKeys.length; i += maxBatchGetElems) {
			batchProcesses.push(new Promise(async (rs, rj) => {
				try {
					const keysBatch: DocumentClient.Key[] = uniqueKeys.slice(i, i + maxBatchGetElems);
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

	public scan(input: DocumentClient.ScanInput): Promise<ScanIterator> {
		return this.iterator.scan(input);
	}

	public query(input: DocumentClient.QueryInput) {
		return this.iterator.query(input);
	}

	public put(input: DocumentClient.PutItemInput) {
		return this.retryInternalServerError(
			() => this.documentClient.put(input).promise(),
		);
	}

	public update(input: DocumentClient.UpdateItemInput) {
		return this.retryInternalServerError(
			() => this.documentClient.update(input).promise(),
		);
	}

	public delete(input: DocumentClient.DeleteItemInput) {
		return this.retryInternalServerError(
			() => this.documentClient.delete(input).promise(),
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
		return this.documentClient.batchGet(input).promise();
	}

	private async asyncTransactWrite(input: DocumentClient.TransactWriteItemsInput) {
		await this.documentClient.transactWrite(input).promise();
	}

	private async asyncBatchWrite(input: DocumentClient.BatchWriteItemInput) {
		await this.documentClient.batchWrite(input).promise();
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
