import { DynamoDB } from "aws-sdk";
import SearchGenerator from "./search-generator.class";
export default class QueryGenerator extends SearchGenerator<DynamoDB.DocumentClient.ScanInput> {
    protected asyncSearch(input: DynamoDB.DocumentClient.ScanInput): Promise<DynamoDB.DocumentClient.ScanOutput>;
}
