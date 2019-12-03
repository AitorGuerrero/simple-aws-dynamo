import MaxRetriesReached from "./error.max-retries-reached.class";
import IGenerator from "./generator.interface";
import PoweredDynamo from "./powered-dynamo.class";
import IPoweredDynamo from "./powered-dynamo.interface";

export default PoweredDynamo;

export {
	IGenerator,
	IPoweredDynamo,
	MaxRetriesReached,
};
