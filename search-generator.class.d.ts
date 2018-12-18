import { DynamoDB } from "aws-sdk";
import DocumentClient = DynamoDB.DocumentClient;
interface IInput {
    ExclusiveStartKey?: DocumentClient.Key;
}
interface IOutput {
    Items?: DocumentClient.AttributeMap[];
    LastEvaluatedKey?: DocumentClient.Key;
    Count?: number;
}
export default abstract class SearchGenerator<Input> {
    protected documentClient: DocumentClient;
    protected input: Input & IInput;
    private batch;
    private sourceIsEmpty;
    private lastEvaluatedKey;
    constructor(documentClient: DocumentClient, input: Input & IInput);
    next(): Promise<DynamoDB.DocumentClient.AttributeMap>;
    count(): Promise<number>;
    protected abstract asyncSearch(input: Input): Promise<IOutput>;
    private getNextBlock;
}
export {};
