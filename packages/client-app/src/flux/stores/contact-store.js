/*
 * decaffeinate suggestions:
 * DS002: Fix invalid constructor
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS104: Avoid inline assignments
 * DS201: Simplify complex destructure assignments
 * DS204: Change includes calls to have a more natural evaluation order
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
import _fs from "node:fs";
import _path from "node:path";
import _Reflux from "reflux";
import _Rx from "rx-lite";
import _Actions from "../actions.js";
import Contact from "../models/contact.js";
import * as _UtilsNS from "../models/utils.js";
const _Utils = _UtilsNS.default || _UtilsNS;
import NylasStore from "nylas-store";
import * as RegExpUtilsNS from "../../regexp-utils.js";
const RegExpUtils = RegExpUtilsNS.default || RegExpUtilsNS;
import DatabaseStore from "./database-store.js";
import AccountStore from "./account-store.js";
import ComponentRegistry from "../../registries/component-registry.js";
import ContactRankingStore from "./contact-ranking-store.js";
import _ from "underscore";
import * as _WindowBridgeNS from "../../window-bridge.js";
const _WindowBridge = _WindowBridgeNS.default || _WindowBridgeNS;

/*
Public: ContactStore provides convenience methods for searching contacts and
formatting contacts. When Contacts become editable, this store will be expanded
with additional actions.

Section: Stores
*/
class ContactStore extends NylasStore {
	constructor() {
		super();
		this.searchContacts = this.searchContacts.bind(this);
		this.isValidContact = this.isValidContact.bind(this);
		this.parseContactsInString = this.parseContactsInString.bind(this);
		this._updateRankedContactCache = this._updateRankedContactCache.bind(this);
		this._distinctByEmail = this._distinctByEmail.bind(this);
		this._resetCache = this._resetCache.bind(this);
		this._rankedContacts = [];
		this.listenTo(ContactRankingStore, () => this._updateRankedContactCache());
		this._updateRankedContactCache();
	}

	// Public: Search the user's contact list for the given search term.
	// This method compares the `search` string against each Contact's
	// `name` and `email`.
	//
	// - `search` {String} A search phrase, such as `ben@n` or `Ben G`
	// - `options` (optional) {Object} If you will only be displaying a few results,
	//   you should pass a limit value. {::searchContacts} will return as soon
	//   as `limit` matches have been found.
	//
	// Returns an {Array} of matching {Contact} models
	//
	searchContacts(search, options) {
		if (options == null) {
			options = {};
		}
		let { limit } = options;
		if (limit == null) {
			limit = 5;
		}
		limit = Math.max(limit, 0);

		search = search.toLowerCase();
		const accountCount = AccountStore.accounts().length;

		if (!search || search.length === 0) {
			return Promise.resolve([]);
		}

		// Search ranked contacts which are stored in order in memory
		let results = [];
		for (var contact of Array.from(this._rankedContacts)) {
			if (
				contact.email.toLowerCase().indexOf(search) !== -1 ||
				contact.name.toLowerCase().indexOf(search) !== -1
			) {
				results.push(contact);
			}
			if (results.length === limit) {
				break;
			}
		}

		// If we haven't found enough items in memory, query for more from the
		// database. Note that we ask for LIMIT * accountCount because we want to
		// return contacts with distinct email addresses, and the same contact
		// could exist in every account. Rather than make SQLite do a SELECT DISTINCT
		// (which is very slow), we just ask for more items.
		const query = DatabaseStore.findAll(Contact)
			.search(search)
			.limit(limit * accountCount);
		return query.then((queryResults) => {
			const existingEmails = _.pluck(results, "email");

			// remove query results that were already found in ranked contacts
			queryResults = _.reject(queryResults, (c) =>
				Array.from(existingEmails).includes(c.email),
			);
			queryResults = this._distinctByEmail(queryResults);

			results = results.concat(queryResults);

			const extensions = ComponentRegistry.findComponentsMatching({
				role: "ContactSearchResults",
			});
			return Promise.each(extensions, (ext) => {
				return ext.findAdditionalContacts(search, results).then((contacts) => {
					return (results = contacts);
				});
			}).then(() => {
				if (results.length > limit) {
					results.length = limit;
				}
				return Promise.resolve(results);
			});
		});
	}

	isValidContact(contact) {
		if (!(contact instanceof Contact)) {
			return false;
		}
		return contact.isValid();
	}

	parseContactsInString(contactString, options) {
		let match;
		let email, name;
		if (options == null) {
			options = {};
		}
		const { skipNameLookup } = options;

		const detected = [];
		const emailRegex = RegExpUtils.emailRegex();
		let lastMatchEnd = 0;

		while ((match = emailRegex.exec(contactString))) {
			var needle, needle1, needle2;
			email = match[0];
			name = null;

			var startsWithQuote = ["'", '"'].includes(email[0]);
			var hasTrailingQuote =
				((needle = contactString[match.index + email.length]),
				["'", '"'].includes(needle));
			if (startsWithQuote && hasTrailingQuote) {
				email = email.slice(1);
			}

			var hasLeadingParen =
				((needle1 = contactString[match.index - 1]),
				["(", "<"].includes(needle1));
			var hasTrailingParen =
				((needle2 = contactString[match.index + email.length]),
				[")", ">"].includes(needle2));

			if (hasLeadingParen && hasTrailingParen) {
				var nameStart = lastMatchEnd;
				for (var char of [",", "\n", "\r"]) {
					var i = contactString.lastIndexOf(char, match.index);
					if (i + 1 > nameStart) {
						nameStart = i + 1;
					}
				}
				name = contactString
					.substr(nameStart, match.index - 1 - nameStart)
					.trim();
			}

			// The "nameStart" for the next match must begin after lastMatchEnd
			lastMatchEnd = match.index + email.length;
			if (hasTrailingParen) {
				lastMatchEnd += 1;
			}

			if (!name || name.length === 0) {
				name = email;
			}

			// If the first and last character of the name are quotation marks, remove them
			var firstChar = name[0],
				lastChar = name[name.length - 1];
			if (['"', "'"].includes(firstChar) && ['"', "'"].includes(lastChar)) {
				name = name.slice(1, -1);
			}

			detected.push(new Contact({ email, name }));
		}

		if (skipNameLookup) {
			return Promise.resolve(detected);
		}

		return Promise.all(
			detected.map((contact) => {
				if (contact.name !== contact.email) {
					return contact;
				}
				return this.searchContacts(contact.email, { limit: 1 }).then(
					(...args) => {
						let match;
						[match] = Array.from(args[0]);
						if (match && match.email === contact.email) {
							return match;
						}
						return contact;
					},
				);
			}),
		);
	}

	_updateRankedContactCache() {
		const rankings = ContactRankingStore.valuesForAllAccounts();
		let emails = Object.keys(rankings);

		if (emails.length === 0) {
			this._rankedContacts = [];
			return;
		}

		// Sort the emails by rank and then clip to 400 so that our ranked cache
		// has a bounded size.
		emails = _.sortBy(emails, (email) => {
			let left;
			return -((left = rankings[email.toLowerCase()]) != null ? left : 0) / 1;
		});
		if (emails.length > 400) {
			emails.length = 400;
		}

		return DatabaseStore.findAll(Contact, { email: emails })
			.background()
			.then((contacts) => {
				contacts = this._distinctByEmail(contacts);
				for (var contact of Array.from(contacts)) {
					var left;
					contact._rank =
						-((left = rankings[contact.email.toLowerCase()]) != null
							? left
							: 0) / 1;
				}
				return (this._rankedContacts = _.sortBy(
					contacts,
					(contact) => contact._rank,
				));
			});
	}

	_distinctByEmail(contacts) {
		// remove query results that are duplicates, prefering ones that have names
		const uniq = {};
		for (var contact of Array.from(contacts)) {
			if (!contact.email) {
				continue;
			}
			var key = contact.email.toLowerCase();
			var existing = uniq[key];
			if (!existing?.name || existing.name === existing.email) {
				uniq[key] = contact;
			}
		}
		return _.values(uniq);
	}

	_resetCache() {
		this._rankedContacts = [];
		ContactRankingStore.reset();
		return this.trigger(this);
	}
}

export default new ContactStore();
