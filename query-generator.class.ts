import {DynamoDB} from "aws-sdk";
import SearchGenerator from "./search-generator.class";

import DocumentClient = DynamoDB.DocumentClient;

export default class QueryGenerator extends SearchGenerator<DocumentClient.ScanInput> {
	protected asyncSearch(input: DocumentClient.ScanInput): Promise<DocumentClient.ScanOutput> {
		return new Promise<DocumentClient.ScanOutput>(
			(rs, rj) => this.documentClient.scan(input, (err, res) => err ? rj(err) : rs(res)),
		);
	}
}
