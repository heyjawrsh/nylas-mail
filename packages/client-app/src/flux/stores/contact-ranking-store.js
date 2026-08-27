/*
 * decaffeinate suggestions:
 * DS002: Fix invalid constructor
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
const Rx = require("rx-lite");
const NylasStore = require("nylas-store");
const DatabaseStore = require("./database-store").default;
const AccountStore = require("./account-store").default;

class ContactRankingStore extends NylasStore {
	constructor() {
		this._registerObservables = this._registerObservables.bind(this);
		this._onRankingsChanged = this._onRankingsChanged.bind(this);
		this._onAccountsChanged = this._onAccountsChanged.bind(this);
		this.valueFor = this.valueFor.bind(this);
		this.valuesForAllAccounts = this.valuesForAllAccounts.bind(this);
		this.reset = this.reset.bind(this);
		this._values = {};
		this._valuesAllAccounts = null;
		this._disposables = {};
		this.listenTo(AccountStore, this._onAccountsChanged);
		this._registerObservables(AccountStore.accounts());
	}

	_registerObservables(accounts) {
		const nextDisposables = {};

		// Create new observables, reusing existing ones when possible
		// (so they don't trigger with initial state unnecesarily)
		for (var acct of Array.from(accounts)) {
			if (this._disposables[acct.id]) {
				nextDisposables[acct.id] = this._disposables[acct.id];
				delete this._disposables[acct.id];
			} else {
				var query = DatabaseStore.findJSONBlob(`ContactRankingsFor${acct.id}`);
				var callback = this._onRankingsChanged.bind(this, acct.id);
				nextDisposables[acct.id] =
					Rx.Observable.fromQuery(query).subscribe(callback);
			}
		}

		// Remove unused observables in the old set
		for (var key in this._disposables) {
			var disposable = this._disposables[key];
			disposable.dispose();
		}

		return (this._disposables = nextDisposables);
	}

	_onRankingsChanged(accountId, json) {
		this._values[accountId] = json ? json.value : null;
		this._valuesAllAccounts = null;
		return this.trigger();
	}

	_onAccountsChanged() {
		return this._registerObservables(AccountStore.accounts());
	}

	valueFor(accountId) {
		return this._values[accountId];
	}

	valuesForAllAccounts() {
		if (!this._valuesAllAccounts) {
			const combined = {};
			for (var acctId in this._values) {
				var values = this._values[acctId];
				for (var email in values) {
					var score = values[email];
					if (combined[email]) {
						combined[email] = Math.max(combined[email], score);
					} else {
						combined[email] = score;
					}
				}
			}
			this._valuesAllAccounts = combined;
		}

		return this._valuesAllAccounts;
	}

	reset() {
		this._valuesAllAccounts = null;
		return (this._values = {});
	}
}

module.exports = new ContactRankingStore();
