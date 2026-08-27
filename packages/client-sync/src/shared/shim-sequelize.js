import _ from "underscore";

const DEFAULT_SEQUELIZE_SHIM_TIMEOUT = 60 * 1000; // 1 min

const shimObject = (obj) => {
	// Class methods are non-enumerable — include them, but never rebind
	// accessors or the constructor.
	const keys = Object.getOwnPropertyNames(obj).filter((key) => {
		if (key === "constructor" || key.startsWith("_")) return false;
		const desc = Object.getOwnPropertyDescriptor(obj, key);
		return !!(desc && desc.value !== undefined);
	});
	keys.forEach((key) => {
		// Skip internal methods.
		if (key.startsWith("_")) {
			return;
		}

		const prop = obj[key];
		// Only patch methods.
		if (!_.isFunction(prop)) {
			return;
		}

		obj[key] = function (...args) {
			// eslint-disable-line
			const result = prop.call(this, ...args);
			if (result && _.isFunction(result.then)) {
				return Promise.race([
					Promise.resolve(result),
					new Promise((resolve, reject) =>
						setTimeout(
							() => reject(new Error(`${key} timed out`)),
							DEFAULT_SEQUELIZE_SHIM_TIMEOUT,
						),
					),
				]);
			}
			return result;
		};
	});
};

export default function shimSequelize(Sequelize) {
	shimObject(Sequelize.Model);
	shimObject(Sequelize.Model.prototype);
}
