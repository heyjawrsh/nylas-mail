/*
 * decaffeinate suggestions:
 * DS002: Fix invalid constructor
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS104: Avoid inline assignments
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
import _ from "underscore";
import Rx from "rx-lite";
import NylasStore from "nylas-store";
import AccountStore from "./account-store.js";
import Account from "../models/account.js";
// Deferred: category.js imports back through the flux layer; requiring it
// eagerly at module scope creates a require(esm) cycle.
let _standardCategoryNames = null;
const getStandardCategoryNames = () =>
	_standardCategoryNames ||
	(_standardCategoryNames = require("../models/category.js").default
		.StandardCategoryNames);
import { Categories } from "nylas-observables";

const asAccount = (a) => {
	if (!a) {
		throw new Error("You must pass an Account or Account Id");
	}
	if (a instanceof Account) {
		return a;
	} else {
		return AccountStore.accountForId(a);
	}
};

const asAccountId = (a) => {
	if (!a) {
		throw new Error("You must pass an Account or Account Id");
	}
	if (a instanceof Account) {
		return a.id;
	} else {
		return a;
	}
};

class CategoryStore extends NylasStore {
	constructor() {
		super();
		this.getStandardCategory = this.getStandardCategory.bind(this);
		this.getStandardCategories = this.getStandardCategories.bind(this);
		this.getArchiveCategory = this.getArchiveCategory.bind(this);
		this.getAllMailCategory = this.getAllMailCategory.bind(this);
		this.getInboxCategory = this.getInboxCategory.bind(this);
		this.getTrashCategory = this.getTrashCategory.bind(this);
		this.getSpamCategory = this.getSpamCategory.bind(this);
		this._onCategoriesChanged = this._onCategoriesChanged.bind(this);
		this._categoryCache = {};
		this._standardCategories = {};
		this._userCategories = {};
		this._hiddenCategories = {};

		NylasEnv.config.onDidChange("core.workspace.showImportant", () => {
			if (!this._categoryResult) {
				return;
			}
			return this._onCategoriesChanged(this._categoryResult);
		});

		Categories.forAllAccounts().sort().subscribe(this._onCategoriesChanged);
	}

	byId(accountOrId, categoryId) {
		let left;
		const categories =
			(left = this._categoryCache[asAccountId(accountOrId)]) != null
				? left
				: {};
		return categories[categoryId];
	}

	// Public: Returns an array of all categories for an account, both
	// standard and user generated. The items returned by this function will be
	// either {Folder} or {Label} objects.
	//
	categories(accountOrId = null) {
		if (accountOrId) {
			let left;
			return (left = _.values(this._categoryCache[asAccountId(accountOrId)])) !=
				null
				? left
				: [];
		} else {
			let all = [];
			for (var accountId in this._categoryCache) {
				var categories = this._categoryCache[accountId];
				all = all.concat(_.values(categories));
			}
			return all;
		}
	}

	// Public: Returns all of the standard categories for the given account.
	//
	standardCategories(accountOrId) {
		let left;
		return (left = this._standardCategories[asAccountId(accountOrId)]) != null
			? left
			: [];
	}

	hiddenCategories(accountOrId) {
		let left;
		return (left = this._hiddenCategories[asAccountId(accountOrId)]) != null
			? left
			: [];
	}

	// Public: Returns all of the categories that are not part of the standard
	// category set.
	//
	userCategories(accountOrId) {
		let left;
		return (left = this._userCategories[asAccountId(accountOrId)]) != null
			? left
			: [];
	}

	// Public: Returns the Folder or Label object for a standard category name and
	// for a given account.
	// ('inbox', 'drafts', etc.) It's possible for this to return `null`.
	// For example, Gmail likely doesn't have an `archive` label.
	//
	getStandardCategory(accountOrId, name) {
		if (!accountOrId) {
			return null;
		}

		if (!Array.from(getStandardCategoryNames()).includes(name)) {
			throw new Error(`'${name}' is not a standard category`);
		}

		return _.findWhere(this._standardCategories[asAccountId(accountOrId)], {
			name,
		});
	}

	// Public: Returns the set of all standard categories that match the given
	// names for each of the provided accounts
	getStandardCategories(accountsOrIds, ...names) {
		if (Array.isArray(accountsOrIds)) {
			let res = [];
			for (var accOrId of Array.from(accountsOrIds)) {
				var cats = names.map((name) => this.getStandardCategory(accOrId, name));
				res = res.concat(_.compact(cats));
			}
			return res;
		} else {
			return _.compact(
				names.map((name) => this.getStandardCategory(accountsOrIds, name)),
			);
		}
	}

	// Public: Returns the Folder or Label object that should be used for "Archive"
	// actions. On Gmail, this is the "all" label. On providers using folders, it
	// returns any available "Archive" folder, or null if no such folder exists.
	//
	getArchiveCategory(accountOrId) {
		if (!accountOrId) {
			return null;
		}
		const account = asAccount(accountOrId);
		if (!account) {
			return null;
		}

		if (account.usesFolders()) {
			return this.getStandardCategory(account.id, "archive");
		} else {
			return this.getStandardCategory(account.id, "all");
		}
	}

	// Public: Returns Label object for "All mail"
	//
	getAllMailCategory(accountOrId) {
		if (!accountOrId) {
			return null;
		}
		const account = asAccount(accountOrId);
		if (!account) {
			return null;
		}
		if (!account.usesLabels()) {
			return null;
		}

		return this.getStandardCategory(account.id, "all");
	}

	// Public: Returns the Folder or Label object that should be used for
	// the inbox or null if it doesn't exist
	//
	getInboxCategory(accountOrId) {
		return this.getStandardCategory(accountOrId, "inbox");
	}

	// Public: Returns the Folder or Label object that should be used for
	// "Move to Trash", or null if no trash folder exists.
	//
	getTrashCategory(accountOrId) {
		return this.getStandardCategory(accountOrId, "trash");
	}

	// Public: Returns the Folder or Label object that should be used for
	// "Move to Spam", or null if no trash folder exists.
	//
	getSpamCategory(accountOrId) {
		return this.getStandardCategory(accountOrId, "spam");
	}

	_onCategoriesChanged(categories) {
		let cat;
		this._categoryResult = categories;
		this._categoryCache = {};
		for (cat of Array.from(categories)) {
			if (this._categoryCache[cat.accountId] == null) {
				this._categoryCache[cat.accountId] = {};
			}
			this._categoryCache[cat.accountId][cat.id] = cat;
		}

		const filteredByAccount = (fn) => {
			const result = {};
			for (cat of Array.from(categories)) {
				if (!fn(cat)) {
					continue;
				}
				if (result[cat.accountId] == null) {
					result[cat.accountId] = [];
				}
				result[cat.accountId].push(cat);
			}
			return result;
		};

		this._standardCategories = filteredByAccount((cat) =>
			cat.isStandardCategory(),
		);
		this._userCategories = filteredByAccount((cat) => cat.isUserCategory());
		this._hiddenCategories = filteredByAccount((cat) => cat.isHiddenCategory());

		// Ensure standard categories are always sorted in the correct order
		for (var accountId in this._standardCategories) {
			var _items = this._standardCategories[accountId];
			this._standardCategories[accountId].sort(
				(a, b) =>
					getStandardCategoryNames().indexOf(a.name) -
					getStandardCategoryNames().indexOf(b.name),
			);
		}

		return this.trigger();
	}
}

export default new CategoryStore();
