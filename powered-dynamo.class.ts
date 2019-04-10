import {DynamoDB} from "aws-sdk";
import QuerySearchGenerator from "./query-generator.class";
import ScanSearchGenerator from "./scan-generator.class";

import DocumentClient = DynamoDB.DocumentClient;
import MaxRetriesReached from "./error.max-retries-reached.class";
import IPoweredDynamo from "./powered-dynamo.interface";

const maxBatchWriteElems = 10;
const internalServerErrorCode = "InternalServerError";
const retryWaitTimes = [200, 400];

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

	private static errorIsInternalServerError(error: unknown) {
		return error instanceof Error && error.name === internalServerErrorCode;
	}

	constructor(
		private documentClient: DocumentClient,
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
		await this.retryInternalServerError(() => this.asyncTransactWrite(input));
	}

	private async retryInternalServerError<O>(execution: () => Promise<O>) {
		try {
			return await execution();
		} catch (firstTryError) {
			if (PoweredDynamo.errorIsInternalServerError(firstTryError)) {
				await new Promise((rs) => setTimeout(rs, retryWaitTimes[0]));
				try {
					return await execution();
				} catch (secondTryError) {
					if (PoweredDynamo.errorIsInternalServerError(secondTryError)) {
						await new Promise((rs) => setTimeout(rs, retryWaitTimes[1]));
						try {
							return await execution();
						} catch (err) {
							if (PoweredDynamo.errorIsInternalServerError(err)) {
								throw new MaxRetriesReached();
							}

							throw err;
						}
					}

					throw secondTryError;
				}
			}

			throw firstTryError;
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
