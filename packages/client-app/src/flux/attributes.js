import Matcher from "./attributes/matcher.js";
import SortOrder from "./attributes/sort-order.js";
import AttributeNumber from "./attributes/attribute-number.js";
import AttributeString from "./attributes/attribute-string.js";
import AttributeObject from "./attributes/attribute-object.js";
import AttributeBoolean from "./attributes/attribute-boolean.js";
import AttributeDateTime from "./attributes/attribute-datetime.js";
import AttributeCollection from "./attributes/attribute-collection.js";
import AttributeJoinedData from "./attributes/attribute-joined-data.js";
import AttributeServerId from "./attributes/attribute-serverid.js";

export default {
	Matcher: Matcher,
	SortOrder: SortOrder,

	Number: (...args) => new AttributeNumber(...args),
	String: (...args) => new AttributeString(...args),
	Object: (...args) => new AttributeObject(...args),
	Boolean: (...args) => new AttributeBoolean(...args),
	DateTime: (...args) => new AttributeDateTime(...args),
	Collection: (...args) => new AttributeCollection(...args),
	JoinedData: (...args) => new AttributeJoinedData(...args),
	ServerId: (...args) => new AttributeServerId(...args),

	AttributeNumber: AttributeNumber,
	AttributeString: AttributeString,
	AttributeObject: AttributeObject,
	AttributeBoolean: AttributeBoolean,
	AttributeDateTime: AttributeDateTime,
	AttributeCollection: AttributeCollection,
	AttributeJoinedData: AttributeJoinedData,
	AttributeServerId: AttributeServerId,
};
