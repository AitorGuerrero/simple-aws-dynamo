import { DynamoDB } from "aws-sdk";
import SearchGenerator from "./search-generator.class";
import DocumentClient = DynamoDB.DocumentClient;
export default class ScanGenerator extends SearchGenerator<DocumentClient.ScanInput> {
    protected asyncSearch(input: DocumentClient.ScanInput): Promise<DocumentClient.ScanOutput>;
}
