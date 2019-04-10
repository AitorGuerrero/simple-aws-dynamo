import {DynamoDB} from "aws-sdk";
import SearchGenerator from "./search-generator.class";

import DocumentClient = DynamoDB.DocumentClient;

export interface IQueryDocumentClient {
	query(i: DocumentClient.QueryInput, cb: (err: Error, data: DocumentClient.QueryOutput) => unknown): unknown;
}

export default class QueryGenerator extends SearchGenerator<DocumentClient.QueryInput> {

	constructor(
		private documentClient: IQueryDocumentClient,
		input: DocumentClient.QueryInput,
	) {
		super(input);
	}

	protected asyncSearch(input: DocumentClient.QueryInput) {
		return new Promise<DocumentClient.QueryOutput>(
			(rs, rj) => this.documentClient.query(input, (err, res) => err ? rj(err) : rs(res)),
		);
	}
}
