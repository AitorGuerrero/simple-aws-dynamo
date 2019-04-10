import {DynamoDB} from "aws-sdk";
import IGenerator from "./generator.interface";

import DocumentClient = DynamoDB.DocumentClient;

export interface IInput {
	ExclusiveStartKey?: DocumentClient.Key;
}

interface IOutput {
	Items?: DocumentClient.AttributeMap[];
	LastEvaluatedKey?: DocumentClient.Key;
	Count?: number;
}

export default abstract class SearchGenerator<Input> implements IGenerator {

	private batch: DocumentClient.AttributeMap[] = [];
	private sourceIsEmpty = false;
	private lastEvaluatedKey: DocumentClient.Key;

	protected constructor(
		protected input: Input & IInput,
	) {}

	public async next() {
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

	public async count() {
		const documentClientInput = Object.assign(
			{},
			this.input,
			{Select: "COUNT"},
		);
		let total = 0;
		let response;
		do {
			response = await this.asyncSearch(documentClientInput);
			documentClientInput.ExclusiveStartKey = response.LastEvaluatedKey;
			total += response.Count;
		} while (response.LastEvaluatedKey);

		return total;
	}

	public async toArray() {
		let e: DocumentClient.AttributeMap;
		const result: DocumentClient.AttributeMap[] = [];
		while (e = await this.next()) {
			result.push(e);
		}

		return result;
	}

	protected abstract asyncSearch(input: Input): Promise<IOutput>;

	private async getNextBlock() {
		if (this.sourceIsEmpty) {
			return;
		}
		const blockInput = Object.assign({}, this.input);
		if (this.lastEvaluatedKey) {
			blockInput.ExclusiveStartKey = this.lastEvaluatedKey;
		}
		const response = await this.asyncSearch(blockInput);
		this.lastEvaluatedKey = response.LastEvaluatedKey;
		if (undefined === this.lastEvaluatedKey) {
			this.sourceIsEmpty = true;
		}

		return response;
	}
}
