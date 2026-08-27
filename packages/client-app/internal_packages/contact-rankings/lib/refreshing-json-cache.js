/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
const _ = require("underscore");
const { NylasStore, DatabaseStore } = require("nylas-exports");

class RefreshingJSONCache {
	constructor({ key, version, refreshInterval, maxRefreshInterval }) {
		this.refresh = this.refresh.bind(this);
		this.fetchData = this.fetchData.bind(this);
		this.key = key;
		this.version = version;
		this.refreshInterval = refreshInterval;
		this.maxRefreshInterval = maxRefreshInterval;
		this._timeoutId = null;
	}

	start() {
		// Clear any scheduled actions
		this.end();

		// Look up existing data from db
		return DatabaseStore.findJSONBlob(this.key).then((json) => {
			if (json?.refreshInterval) {
				this.refreshInterval = json.refreshInterval;
			}

			// Refresh immediately if json is missing or version is outdated. Otherwise,
			// compute next refresh time and schedule
			let timeUntilRefresh = 0;
			if (json != null && json.version === this.version) {
				timeUntilRefresh = Math.max(
					0,
					this.refreshInterval - (Date.now() - json.time),
				);
			}

			return (this._timeoutId = setTimeout(this.refresh, timeUntilRefresh));
		});
	}

	reset() {
		// Clear db value, turn off any scheduled actions
		DatabaseStore.inTransaction((t) => t.persistJSONBlob(this.key, {}));
		return this.end();
	}

	end() {
		// Turn off any scheduled actions
		if (this._timeoutId) {
			clearInterval(this._timeoutId);
		}
		return (this._timeoutId = null);
	}

	refresh() {
		// Set up next refresh call
		if (this._timeoutId) {
			clearTimeout(this._timeoutId);
		}
		this._timeoutId = setTimeout(this.refresh, this.refreshInterval);

		// Call fetch data function, save it to the database
		return this.fetchData((newValue) => {
			return DatabaseStore.inTransaction((t) => {
				return t.persistJSONBlob(this.key, {
					version: this.version,
					time: Date.now(),
					value: newValue,
					refreshInterval: this.refreshInterval,
				});
			});
		});
	}

	fetchData(_callback) {
		throw new Error("Subclasses should override this method.");
	}
}

module.exports = RefreshingJSONCache;
