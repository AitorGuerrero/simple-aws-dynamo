import { DynamoDB } from "aws-sdk";
import QuerySearchGenerator from "./query-generator.class";
import ScanSearchGenerator from "./scan-generator.class";
export default class SimpleDynamo {
    private documentClient;
    constructor(documentClient: DynamoDB.DocumentClient);
    get(input: DynamoDB.DocumentClient.GetItemInput): Promise<{}>;
    getList(tableName: string, keys: DynamoDB.DocumentClient.Key[]): Promise<Map<DynamoDB.DocumentClient.Key, DynamoDB.DocumentClient.AttributeMap>>;
    scan(input: DynamoDB.DocumentClient.ScanInput): ScanSearchGenerator;
    query(input: DynamoDB.DocumentClient.QueryInput): QuerySearchGenerator;
    put(input: DynamoDB.DocumentClient.PutItemInput): Promise<{}>;
    update(input: DynamoDB.DocumentClient.UpdateItemInput): Promise<{}>;
}
