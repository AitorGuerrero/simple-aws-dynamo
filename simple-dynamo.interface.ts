import {DynamoDB} from "aws-sdk";
import IGenerator from "./generator.interface";

import DocumentClient = DynamoDB.DocumentClient;

export default interface ISimpleDynamo {
	get(input: DocumentClient.GetItemInput): Promise<DocumentClient.AttributeMap>;
	getList(tableName: string, keys: DocumentClient.Key[]): Promise<Map<DocumentClient.Key, DocumentClient.AttributeMap>>;
	scan(input: DocumentClient.ScanInput): IGenerator;
	query(input: DocumentClient.QueryInput): IGenerator;
	put(input: DocumentClient.PutItemInput): Promise<void>;
	update(input: DocumentClient.UpdateItemInput): Promise<void>;
	transactWrite(input: DocumentClient.TransactWriteItemsInput): Promise<void>;
}
