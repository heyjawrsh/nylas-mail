/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
const _ = require("underscore");
const _str = require("underscore.string");
const { EventEmitter } = require("node:events");

const callbackName = (string) =>
	`on${string.charAt(0).toUpperCase()}${string.slice(1)}`;

/**
 * Extract child listenables from a parent from their
 * children property and return them in a keyed Object
 *
 * @param {Object} listenable The parent listenable
 */

const mapChildListenables = (listenable) => {
	let i = 0;
	const children = {};
	let childName;
	while (i < (listenable.children || []).length) {
		childName = listenable.children[i];
		if (listenable[childName]) {
			children[childName] = listenable[childName];
		}
		++i;
	}
	return children;
};

/**
 * Make a flat dictionary of all listenables including their
 * possible children (recursively), concatenating names in camelCase.
 *
 * @param {Object} listenables The top-level listenables
 */

var flattenListenables = (listenables) => {
	const flattened = {};
	for (var key in listenables) {
		var listenable = listenables[key];
		var childMap = mapChildListenables(listenable);
		// recursively flatten children
		var children = flattenListenables(childMap);
		// add the primary listenable and chilren
		flattened[key] = listenable;
		for (var childKey in children) {
			var childListenable = children[childKey];
			flattened[key + _str.capitalize(childKey)] = childListenable;
		}
	}
	return flattened;
};

module.exports = {
	Listener: {
		hasListener(listenable) {
			let i = 0;
			let j;
			let listener;
			let listenables;
			while (i < (this.subscriptions || []).length) {
				listenables = [].concat(this.subscriptions[i].listenable);
				j = 0;
				while (j < listenables.length) {
					listener = listenables[j];
					if (listener === listenable || listener.hasListener?.(listenable)) {
						return true;
					}
					j++;
				}
				++i;
			}
			return false;
		},

		listenToMany(listenables) {
			const allListenables = flattenListenables(listenables);
			for (var key in allListenables) {
				var cbname = callbackName(key);
				var localname = this[cbname] ? cbname : this[key] ? key : undefined;
				if (localname) {
					this.listenTo(
						allListenables[key],
						localname,
						this[`${cbname}Default`] ||
							this[`${localname}Default`] ||
							localname,
					);
				}
			}
		},

		validateListening(listenable) {
			if (listenable === this) {
				return "Listener is not able to listen to itself";
			}
			if (!_.isFunction(listenable.listen)) {
				console.log(require("node:util").inspect(listenable));
				console.log(new Error().stack);
				return `${listenable} is missing a listen method`;
			}
			if (listenable.hasListener?.(this)) {
				return "Listener cannot listen to this listenable because of circular loop";
			}
		},

		listenTo(listenable, callback, defaultCallback) {
			let desub;
			let unsubscriber;
			let subscriptionobj;
			const subs = (this.subscriptions = this.subscriptions || []);
			const err = this.validateListening(listenable);
			if (err) {
				throw err;
			}
			this.fetchInitialState(listenable, defaultCallback);

			const resolvedCallback = this[callback] || callback;
			if (!resolvedCallback) {
				throw new Error("@listenTo called with undefined callback");
			}
			desub = listenable.listen(resolvedCallback, this);

			unsubscriber = () => {
				const index = subs.indexOf(subscriptionobj);
				if (index === -1) {
					throw new Error(
						"Tried to remove listen already gone from subscriptions list!",
					);
				}
				subs.splice(index, 1);
				desub();
			};

			subscriptionobj = {
				stop: unsubscriber,
				listenable,
			};
			subs.push(subscriptionobj);
			return subscriptionobj;
		},

		stopListeningTo(listenable) {
			let sub;
			let i = 0;
			const subs = this.subscriptions || [];
			while (i < subs.length) {
				sub = subs[i];
				if (sub.listenable === listenable) {
					sub.stop();
					if (subs.indexOf(sub) !== -1) {
						throw new Error("Failed to remove listen from subscriptions list!");
					}
					return true;
				}
				i++;
			}
			return false;
		},

		stopListeningToAll() {
			let remaining;
			const subs = this.subscriptions || [];
			while ((remaining = subs.length)) {
				subs[0].stop();
				if (subs.length !== remaining - 1) {
					throw new Error("Failed to remove listen from subscriptions list!");
				}
			}
		},

		fetchInitialState(listenable, defaultCallback) {
			defaultCallback =
				(defaultCallback && this[defaultCallback]) || defaultCallback;
			const me = this;
			if (
				_.isFunction(defaultCallback) &&
				_.isFunction(listenable.getInitialState)
			) {
				const data = listenable.getInitialState();
				if (data && _.isFunction(data.then)) {
					data.then(function () {
						defaultCallback.apply(me, arguments);
					});
				} else {
					defaultCallback.call(this, data);
				}
			}
		},
	},

	Publisher: {
		setupEmitter() {
			if (this._emitter) {
				return;
			}
			if (this._emitter == null) {
				this._emitter = new EventEmitter();
			}
			return this._emitter.setMaxListeners(50);
		},

		listen(callback, bindContext) {
			if (!callback) {
				throw new Error("@listen called with undefined callback");
			}

			this.setupEmitter();
			if (bindContext == null) {
				bindContext = this;
			}
			let aborted = false;
			const eventHandler = (args) => {
				if (aborted) {
					return;
				}
				return callback.apply(bindContext, args);
			};
			this._emitter.addListener("trigger", eventHandler);
			return () => {
				aborted = true;
				return this._emitter.removeListener("trigger", eventHandler);
			};
		},

		trigger() {
			this.setupEmitter();
			return this._emitter.emit("trigger", arguments);
		},
	},
};
