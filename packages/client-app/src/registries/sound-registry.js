/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS205: Consider reworking code to avoid use of IIFEs
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
const _ = require("underscore");
const path = require("node:path");

class SoundRegistry {
	constructor() {
		this._sounds = {};
	}

	playSound(name) {
		if (NylasEnv.inSpecMode()) {
			return;
		}
		const src = this._sounds[name];
		if (!src) {
			return;
		}

		const a = new Audio();

		if (_.isString(src)) {
			if (src.indexOf("nylas://") === 0) {
				a.src = src;
			} else {
				a.src = path.join(resourcePath, "static", "sounds", src);
			}
		} else if (_.isArray(src)) {
			const { resourcePath: resolvedPath } = NylasEnv.getLoadSettings();
			const args = [resolvedPath].concat(src);
			a.src = path.join.apply(this, args);
		}

		a.autoplay = true;
		return a.play();
	}

	register(name, path) {
		if (_.isObject(name)) {
			return (() => {
				const result = [];
				for (var key in name) {
					path = name[key];
					result.push((this._sounds[key] = path));
				}
				return result;
			})();
		} else if (_.isString(name)) {
			return (this._sounds[name] = path);
		}
	}

	unregister(name) {
		if (_.isArray(name)) {
			return Array.from(name).map((key) => delete this._sounds[key]);
		} else if (_.isString(name)) {
			return delete this._sounds[name];
		}
	}
}

module.exports = new SoundRegistry();
