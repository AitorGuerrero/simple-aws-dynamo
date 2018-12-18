import { DynamoDB } from "aws-sdk";
interface IInput {
    ExclusiveStartKey?: DynamoDB.DocumentClient.Key;
}
interface IOutput {
    Items?: DynamoDB.DocumentClient.AttributeMap[];
    LastEvaluatedKey?: DynamoDB.DocumentClient.Key;
    Count?: number;
}
export default abstract class SearchGenerator<Input> {
    protected documentClient: DynamoDB.DocumentClient;
    protected input: Input & IInput;
    private batch;
    private sourceIsEmpty;
    private lastEvaluatedKey;
    constructor(documentClient: DynamoDB.DocumentClient, input: Input & IInput);
    next(): Promise<DynamoDB.DocumentClient.AttributeMap>;
    count(): Promise<number>;
    protected abstract asyncSearch(input: Input): Promise<IOutput>;
    private getNextBlock;
}
export {};
