import {DynamoDB} from "aws-sdk";
import QuerySearchGenerator from "./query-generator.class";
import ScanSearchGenerator from "./scan-generator.class";

import DocumentClient = DynamoDB.DocumentClient;

export default class SimpleDynamo {

	constructor(
		private documentClient: DocumentClient,
	) {}

	public get(input: DocumentClient.GetItemInput) {
		return new Promise<DocumentClient.GetItemOutput>(
			(rs, rj) => this.documentClient.get(input, (err, output) => err ? rj(err) : rs(output)),
		);
	}

	public async getList(tableName: string, keys: DocumentClient.Key[]) {
		const input: DocumentClient.BatchGetItemInput = {
			RequestItems: {
				[tableName]: {Keys: uniqueKeys(keys)},
			},
		};
		const response = await new Promise<DocumentClient.BatchGetItemOutput>(
			(rs, rj) => this.documentClient.batchGet(input, (err, res) => err ? rj(err) : rs(res)),
		);
		const result = new Map<DocumentClient.Key, DocumentClient.AttributeMap>();
		for (const item of response.Responses[tableName]) {
			result.set(keys.find((k) => sameKey(k, item)), item);
		}

		return result;
	}

	public scan(input: DocumentClient.ScanInput) {
		return new ScanSearchGenerator(this.documentClient, input);
	}

	public query(input: DocumentClient.QueryInput) {
		return new QuerySearchGenerator(this.documentClient, input);
	}

	public put(input: DocumentClient.PutItemInput) {
		return new Promise((rs, rj) => this.documentClient.put(input, (err, output) => err ? rj(err) : rs(output)));
	}

	public update(input: DocumentClient.UpdateItemInput) {
		return new Promise((rs, rj) => this.documentClient.update(input, (err, output) => err ? rj(err) : rs(output)));
	}

	public transactWrite(input: DocumentClient.TransactWriteItemsInput) {
		return new Promise((rs, rj) => this.documentClient.transactWrite(input, (err, output) => err ? rj(err) : rs(output)));
	}
}

function uniqueKeys(arrArg: DocumentClient.Key[]) {
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
