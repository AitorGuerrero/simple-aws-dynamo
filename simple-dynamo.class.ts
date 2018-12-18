import {DynamoDB} from "aws-sdk";
import QuerySearchGenerator from "./query-generator.class";
import ScanSearchGenerator from "./scan-generator.class";

export default class SimpleDynamo {

	constructor(
		private documentClient: DynamoDB.DocumentClient,
	) {}

	public get(input: DynamoDB.DocumentClient.GetItemInput) {
		return new Promise((rs, rj) => this.documentClient.get(input, (err, output) => err ? rj(err) : rs(output)));
	}

	public async getList(tableName: string, keys: DynamoDB.DocumentClient.Key[]) {
		const input: DynamoDB.DocumentClient.BatchGetItemInput = {
			RequestItems: {
				[tableName]: {Keys: uniqueKeys(keys)},
			},
		};
		const response = await new Promise<DynamoDB.DocumentClient.BatchGetItemOutput>(
			(rs, rj) => this.documentClient.batchGet(input, (err, res) => err ? rj(err) : rs(res)),
		);
		const result = new Map<DynamoDB.DocumentClient.Key, DynamoDB.DocumentClient.AttributeMap>();
		for (const item of response.Responses[tableName]) {
			result.set(keys.find((k) => sameKey(k, item)), item);
		}

		return result;
	}

	public scan(input: DynamoDB.DocumentClient.ScanInput) {
		return new ScanSearchGenerator(this.documentClient, input);
	}

	public query(input: DynamoDB.DocumentClient.QueryInput) {
		return new QuerySearchGenerator(this.documentClient, input);
	}

	public put(input: DynamoDB.DocumentClient.PutItemInput) {
		return new Promise((rs, rj) => this.documentClient.put(input, (err, output) => err ? rj(err) : rs(output)));
	}

	public update(input: DynamoDB.DocumentClient.UpdateItemInput) {
		return new Promise((rs, rj) => this.documentClient.update(input, (err, output) => err ? rj(err) : rs(output)));
	}
}

function uniqueKeys(arrArg: DynamoDB.DocumentClient.Key[]) {
	return arrArg.reduce(
		(output, key) => output.some(
			(k2: DynamoDB.DocumentClient.Key) => sameKey(key, k2),
		) ? output : output.concat([key]),
		[] as DynamoDB.DocumentClient.Key[],
	);
}

function sameKey(key1: DynamoDB.DocumentClient.Key, key2: DynamoDB.DocumentClient.Key) {
	return Object.keys(key1).every((k) => key2[k] === key1[k]);
}
