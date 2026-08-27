/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
const _ = require("underscore");
const Utils = require("./utils.js");
const Attributes = require("../attributes.js").default;

/*
Public: A base class for API objects that provides abstract support for
serialization and deserialization, matching by attributes, and ID-based equality.

*# Attributes

`id`: {AttributeString} The resolved canonical ID of the model used in the
database and generally throughout the app. The id property is a custom
getter that resolves to the serverId first, and then the clientId.

`clientId`: {AttributeString} An ID created at object construction and
persists throughout the lifetime of the object. This is extremely useful
for optimistically creating objects (like drafts and categories) and
having a constant reference to it. In all other cases, use the resolved
`id` field.

`serverId`: {AttributeServerId} The server ID of the model. In most cases,
except optimistic creation, this will also be the canonical id of the
object.

`object`: {AttributeString} The model's type. This field is used by the JSON
 deserializer to create an instance of the correct class when inflating the object.

`accountId`: {AttributeString} The string Account Id this model belongs to.

Section: Models
*/
class Model {
	static initClass() {
		Object.defineProperty(Model.prototype, "id", {
			enumerable: false,
			get() {
				return this.serverId != null ? this.serverId : this.clientId;
			},
			set() {
				throw new Error(
					"You may not directly set the ID of an object. Set either the `clientId` or the `serverId` instead.",
				);
			},
		});

		Model.attributes = {
			// Lookups will go through the custom getter.
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

			object: Attributes.String({
				modelKey: "object",
			}),

			accountId: Attributes.ServerId({
				queryable: true,
				modelKey: "accountId",
				jsonKey: "account_id",
			}),
		};
	}

	static naturalSortOrder() {
		return null;
	}

	constructor(values) {
		if (values == null) {
			values = {};
		}
		if (values.id && Utils.isTempId(values.id)) {
			if (values.clientId == null) {
				values.clientId = values.id;
			}
		} else {
			if (values.serverId == null) {
				values.serverId = values.id;
			}
		}

		for (var key of Array.from(Object.keys(this.constructor.attributes))) {
			if (key === "id") {
				continue;
			}
			if (values[key] == null) {
				continue;
			}
			this[key] = values[key];
		}

		if (this.clientId == null) {
			this.clientId = Utils.generateTempId();
		}
		this;
	}

	isSavedRemotely() {
		return this.serverId != null;
	}

	clone() {
		return new this.constructor().fromJSON(this.toJSON());
	}

	// Public: Returns an {Array} of {Attribute} objects defined on the Model's constructor
	//
	attributes() {
		const attrs = _.clone(this.constructor.attributes);
		delete attrs.id;
		return attrs;
	}

	//#
	// Public: Inflates the model object from JSON, using the defined attributes to
	// guide type coercision.
	//
	// - `json` A plain Javascript {Object} with the JSON representation of the model.
	//
	// This method is chainable.
	//
	fromJSON(json) {
		// Note: The loop in this function has been optimized for the V8 'fast case'
		// https://github.com/petkaantonov/bluebird/wiki/Optimization-killers
		//
		if (json.id && !Utils.isTempId(json.id)) {
			this.serverId = json.id;
		}
		for (var key of Array.from(Object.keys(this.constructor.attributes))) {
			if (key === "id") {
				continue;
			}
			var attr = this.constructor.attributes[key];
			var attrValue = json[attr.jsonKey];
			if (attrValue !== undefined) {
				// Computed attributes (e.g. Thread.inAllMail) are exposed as
				// getter-only properties; assignment would throw.
				var descriptor = Object.getOwnPropertyDescriptor(
					this.constructor.prototype,
					key,
				);
				if (descriptor?.get && !descriptor.set) {
					continue;
				}
				this[key] = attr.fromJSON(attrValue);
			}
		}
		return this;
	}

	// Public: Deflates the model to a plain JSON object. Only attributes defined
	// on the model are included in the JSON.
	//
	// - `options` (optional) An {Object} with additional options. To skip joined
	//    data attributes in the toJSON representation, pass the `joined:false`
	//
	// Returns an {Object} with the JSON representation of the model.
	//
	toJSON(options) {
		if (options == null) {
			options = {};
		}
		const json = {};
		for (var key of Array.from(Object.keys(this.constructor.attributes))) {
			if (key === "id") {
				continue;
			}
			var attr = this.constructor.attributes[key];
			var attrValue = this[key];
			if (attrValue === undefined) {
				attrValue = attr.defaultValue;
			}
			if (attrValue === undefined) {
				continue;
			}
			if (
				attr instanceof Attributes.AttributeJoinedData &&
				options.joined === false
			) {
				continue;
			}
			json[attr.jsonKey] = attr.toJSON(attrValue);
		}
		json.id = this.id;
		return json;
	}

	toString() {
		return JSON.stringify(this.toJSON());
	}

	// Public: Evaluates the model against one or more {Matcher} objects.
	//
	// - `criteria` An {Array} of {Matcher}s to run on the model.
	//
	// Returns true if the model matches the criteria.
	//
	matches(criteria) {
		if (!Array.isArray(criteria)) {
			return false;
		}
		for (var matcher of Array.from(criteria)) {
			if (!matcher.evaluate(this)) {
				return false;
			}
		}
		return true;
	}
}
Model.initClass();

module.exports = Model;
