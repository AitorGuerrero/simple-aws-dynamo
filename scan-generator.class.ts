import {DynamoDB} from "aws-sdk";
import SearchGenerator from "./search-generator.class";

export default class ScanGenerator extends SearchGenerator<DynamoDB.DocumentClient.ScanInput> {
	protected asyncSearch(input: DynamoDB.DocumentClient.ScanInput): Promise<DynamoDB.DocumentClient.ScanOutput> {
		return new Promise<DynamoDB.DocumentClient.ScanOutput>(
			(rs, rj) => this.documentClient.scan(input, (err, res) => err ? rj(err) : rs(res)),
		);
	}
}
