import {DynamoDB} from "aws-sdk";
import SearchGenerator from "./search-generator.class";

import DocumentClient = DynamoDB.DocumentClient;

export default class QueryGenerator extends SearchGenerator<DocumentClient.ScanInput> {
	protected asyncSearch(input: DocumentClient.QueryInput) {
		return new Promise<DocumentClient.QueryOutput>(
			(rs, rj) => this.documentClient.query(input, (err, res) => err ? rj(err) : rs(res)),
		);
	}
}
