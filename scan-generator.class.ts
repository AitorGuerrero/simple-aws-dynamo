import {DynamoDB} from "aws-sdk";
import SearchGenerator from "./search-generator.class";

import DocumentClient = DynamoDB.DocumentClient;

export interface IScanDocumentClient {
	scan(i: DocumentClient.ScanInput, cb: (err: Error, data: DocumentClient.ScanOutput) => unknown): unknown;
}

export default class ScanGenerator extends SearchGenerator<DocumentClient.ScanInput> {

	constructor(
		private documentClient: IScanDocumentClient,
		input: DocumentClient.ScanInput,
	) {
		super(input);
	}

	protected asyncSearch(input: DocumentClient.ScanInput) {
		return new Promise<DocumentClient.ScanOutput>(
			(rs, rj) => this.documentClient.scan(input, (err, res) => err ? rj(err) : rs(res)),
		);
	}
}
