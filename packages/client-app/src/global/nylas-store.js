/*
 * decaffeinate suggestions:
 * DS206: Consider reworking classes to avoid initClass
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
const RefluxCoffeeNS = require("../flux/modules/reflux-coffee.js");
const RefluxCoffee =
	RefluxCoffeeNS.default || RefluxCoffeeNS.Listener || RefluxCoffeeNS;
const Listener = RefluxCoffee?.Listener ?? RefluxCoffeeNS?.Listener;
const Publisher = RefluxCoffee?.Publisher ?? RefluxCoffeeNS?.Publisher;
const CoffeeHelpersNS = require("../flux/coffee-helpers.js");
const CoffeeHelpers = CoffeeHelpersNS.default || CoffeeHelpersNS;

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
// biome-ignore lint: dual CJS/ESM surface for transformed consumers
module.exports.default = NylasStore;
