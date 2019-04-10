import {expect} from "chai";
import {beforeEach, describe, it} from "mocha";
import MaxRetriesReached from "./error.max-retries-reached.class";
import FakeDocumentClient, {
	InternalServerError,
	TransactionCanceledException,
	TransactionConflict,
} from "./fake.document-client.class";
import PoweredDynamo from "./powered-dynamo.class";

describe("PoweredDynamoClass", () => {

	const tableName = "tableName";

	let poweredDynamo: PoweredDynamo;
	let fakeDocumentClient: FakeDocumentClient;

	beforeEach(() => {
		fakeDocumentClient = new FakeDocumentClient();
		poweredDynamo = new PoweredDynamo(fakeDocumentClient);
		poweredDynamo.retryWaitTimes = [1, 1, 1];
	});

	describe("When putting data", () => {
		describe("Having once a system error", () => {
			beforeEach(() => fakeDocumentClient.failOn("put", new InternalServerError()));
			it("should retry the call", async () => poweredDynamo.put({TableName: tableName, Item: null}));
		});
		describe("Having 4 times a system error", () => {
			beforeEach(() => {
				for (let i = 0; i < 4; i++) {
					fakeDocumentClient.failOn("put", new InternalServerError());
				}
			});
			it("should throw max retries error", async () => poweredDynamo.put({TableName: tableName, Item: null}).then(
				() => expect.fail(),
				(err) => expect(err).instanceOf(MaxRetriesReached),
			));
		});
	});

	describe("When saving transactional data", () => {
		describe("Having once a transaction collision error", () => {
			beforeEach(() => fakeDocumentClient.failOn(
				"transactWrite",
				new TransactionCanceledException([new TransactionConflict()])),
			);
			it("should retry the call", async () => poweredDynamo.transactWrite({TransactItems: []}));
		});
		describe("Having 3 times a transaction collision error", () => {
			beforeEach(() => {
				for (let i = 0; i < 4; i++) {
					fakeDocumentClient.failOn(
						"transactWrite",
						new TransactionCanceledException([new TransactionConflict()]),
					);
				}
			});
			it("should throw max retries error", async () => poweredDynamo.transactWrite({TransactItems: []}).then(
				() => expect.fail(),
				(err) => expect(err).instanceOf(MaxRetriesReached),
			));
		});
	});
});
