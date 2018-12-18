import {DynamoDB} from "aws-sdk";

interface IInput {
	ExclusiveStartKey?: DynamoDB.DocumentClient.Key;
}

interface IOutput {
	Items?: DynamoDB.DocumentClient.AttributeMap[];
	LastEvaluatedKey?: DynamoDB.DocumentClient.Key;
	Count?: number;
}

export default abstract class SearchGenerator<Input> {

	private batch: DynamoDB.DocumentClient.AttributeMap[] = [];
	private sourceIsEmpty = false;
	private lastEvaluatedKey: DynamoDB.DocumentClient.Key;

	constructor(
		protected documentClient: DynamoDB.DocumentClient,
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

	protected abstract asyncSearch(input: Input): Promise<IOutput>;

	private async getNextBlock() {
		if (this.sourceIsEmpty) {
			return;
		}
		const blockInput = Object.assign(this.input, {ExclusiveStartKey: this.lastEvaluatedKey});
		const response = await this.asyncSearch(blockInput);
		this.lastEvaluatedKey = response.LastEvaluatedKey;
		if (undefined === this.lastEvaluatedKey) {
			this.sourceIsEmpty = true;
		}

		return response;
	}
}
