import { DynamoDB } from "aws-sdk";
import QuerySearchGenerator from "./query-generator.class";
import ScanSearchGenerator from "./scan-generator.class";
import DocumentClient = DynamoDB.DocumentClient;
export default class SimpleDynamo {
    private documentClient;
    constructor(documentClient: DocumentClient);
    get(input: DocumentClient.GetItemInput): Promise<DynamoDB.DocumentClient.GetItemOutput>;
    getList(tableName: string, keys: DocumentClient.Key[]): Promise<Map<DynamoDB.DocumentClient.Key, DynamoDB.DocumentClient.AttributeMap>>;
    scan(input: DocumentClient.ScanInput): ScanSearchGenerator;
    query(input: DocumentClient.QueryInput): QuerySearchGenerator;
    put(input: DocumentClient.PutItemInput): Promise<{}>;
    update(input: DocumentClient.UpdateItemInput): Promise<{}>;
    transactWrite(input: DocumentClient.TransactWriteItemsInput): Promise<{}>;
}
