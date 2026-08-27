import Model from "./model.js";
import Query from "./query.js";
import Attributes from "../attributes.js";

class JSONBlobQuery extends Query {
	formatResult(objects) {
		return objects[0] ? objects[0].json : null;
	}
}

export default class JSONBlob extends Model {
	static Query = JSONBlobQuery;

	static attributes = {
		id: Attributes.String({
			queryable: true,
			modelKey: "id",
		}),

		clientId: Attributes.String({
			queryable: true,
			modelKey: "clientId",
			jsonKey: "client_id",
		}),

		serverId: Attributes.ServerId({
			modelKey: "serverId",
			jsonKey: "server_id",
		}),

		json: Attributes.Object({
			modelKey: "json",
			jsonKey: "json",
		}),
	};

	get key() {
		return this.serverId;
	}

	set key(val) {
		this.serverId = val;
	}

	get clientId() {
		return this.serverId;
	}

	set clientId(val) {
		this.serverId = val;
	}
}
