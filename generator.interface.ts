import {DynamoDB} from "aws-sdk";

import DocumentClient = DynamoDB.DocumentClient;

export default interface IGenerator {
	next(): Promise<DocumentClient.AttributeMap>;
	count(): Promise<number>;
	toArray(): Promise<DocumentClient.AttributeMap[]>;
}
