import {DynamoDB} from "aws-sdk";
import IGenerator from "./generator.interface";

import DocumentClient = DynamoDB.DocumentClient;

export default interface IPoweredDynamo {
	get(input: DocumentClient.GetItemInput): Promise<DocumentClient.AttributeMap>;
	getList(tableName: string, keys: DocumentClient.Key[]): Promise<Map<DocumentClient.Key, DocumentClient.AttributeMap>>;
	scan(input: DocumentClient.ScanInput): Promise<IGenerator>;
	query(input: DocumentClient.QueryInput): Promise<IGenerator>;
	put(input: DocumentClient.PutItemInput): Promise<DocumentClient.PutItemOutput>;
	update(input: DocumentClient.UpdateItemInput): Promise<DocumentClient.UpdateItemOutput>;
	delete(input: DocumentClient.DeleteItemInput): Promise<DocumentClient.DeleteItemOutput>;
	transactWrite(input: DocumentClient.TransactWriteItemsInput): Promise<void>;
}
