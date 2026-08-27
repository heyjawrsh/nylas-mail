/*
 * decaffeinate suggestions:
 * DS206: Consider reworking classes to avoid initClass
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
import RefluxCoffee from "../flux/modules/reflux-coffee.js";

const Listener = RefluxCoffee?.Listener ?? RefluxCoffee?.default?.Listener;
const Publisher = RefluxCoffee?.Publisher ?? RefluxCoffee?.default?.Publisher;
import CoffeeHelpers from "../flux/coffee-helpers.js";

// A simple Flux implementation
class NylasStore {
	static initClass() {
		NylasStore.include = CoffeeHelpers.includeModule;

		NylasStore.include(Publisher);
		NylasStore.include(Listener);
	}
}
NylasStore.initClass();

export default NylasStore;
