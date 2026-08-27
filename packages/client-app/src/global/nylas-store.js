/*
 * decaffeinate suggestions:
 * DS206: Consider reworking classes to avoid initClass
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
const { Listener, Publisher } = require("../flux/modules/reflux-coffee");
const CoffeeHelpers = require("../flux/coffee-helpers");

// A simple Flux implementation
class NylasStore {
	static initClass() {
		NylasStore.include = CoffeeHelpers.includeModule;

		NylasStore.include(Publisher);
		NylasStore.include(Listener);
	}
}
NylasStore.initClass();

module.exports = NylasStore;
