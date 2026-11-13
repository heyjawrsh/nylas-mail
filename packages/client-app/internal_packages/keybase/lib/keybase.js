/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
const _ = require("underscore");

// Makes the GET the `request` library used to make. Any HTTP response hands
// its body to the callback as (null, response, body): parsed when `json` is
// set and the body is JSON, text otherwise. Only a network failure is an
// error, as with `request`. A throw in the callback is reported, not left
// unhandled.
function keybaseFetch(url, { json = false } = {}, callback) {
	return fetch(url, { headers: { "User-Agent": "request" } })
		.then((resp) =>
			resp.text().then((text) => {
				let body = text;
				if (json) {
					try {
						body = JSON.parse(text);
					} catch (_err) {
						// Not JSON: `request` hands over the text as is.
					}
				}
				return [resp, body];
			}),
		)
		.then(
			([resp, body]) => callback(null, resp, body),
			(err) => callback(err),
		)
		.catch((err) => NylasEnv.reportError(err));
}

class KeybaseAPI {
	constructor() {
		this.getUser = this.getUser.bind(this);
		this.getKey = this.getKey.bind(this);
		this.autocomplete = this.autocomplete.bind(this);
		this._keybaseRequest = this._keybaseRequest.bind(this);
		this.baseUrl = "https://keybase.io";
	}

	getUser(key, keyType, callback) {
		if (
			[
				"usernames",
				"domain",
				"twitter",
				"github",
				"reddit",
				"hackernews",
				"coinbase",
				"key_fingerprint",
			].includes(!keyType)
		) {
			console.error("keyType must be a supported Keybase query type.");
		}

		return this._keybaseRequest(
			`/_/api/1.0/user/lookup.json?${keyType}=${key}`,
			(err, _resp, obj) => {
				if (err) {
					return callback(err, null);
				}
				if (obj == null || obj.them == null) {
					return callback(new Error("Empty response!"), null);
				}
				if (obj.status != null) {
					if (obj.status.name !== "OK") {
						return callback(new Error(obj.status.desc), null);
					}
				}

				return callback(null, _.map(obj.them, this._regularToAutocomplete));
			},
		);
	}

	getKey(username, callback) {
		return keybaseFetch(
			`${this.baseUrl}/${username}/key.asc`,
			{},
			(err, _resp, obj) => {
				if (err) {
					return callback(err, null);
				}
				if (obj == null) {
					return callback(new Error(`No key found for ${username}`), null);
				}
				if (!obj.startsWith("-----BEGIN PGP PUBLIC KEY BLOCK-----")) {
					return callback(
						new Error(`No key returned from keybase for ${username}`),
						null,
					);
				}
				return callback(null, obj);
			},
		);
	}

	autocomplete(query, callback) {
		// `request` sent q as a form body on a GET, which fetch can't send. The
		// endpoint reads q from the query string.
		const url = `/_/api/1.0/user/autocomplete.json?${new URLSearchParams({ q: query })}`;
		return keybaseFetch(
			this.baseUrl + url,
			{ json: true },
			(err, _resp, obj) => {
				if (err) {
					return callback(err, null);
				}
				if (obj.status != null) {
					if (obj.status.name !== "OK") {
						return callback(new Error(obj.status.desc), null);
					}
				}

				return callback(null, obj.completions);
			},
		);
	}

	_keybaseRequest(url, callback) {
		return keybaseFetch(this.baseUrl + url, { json: true }, callback);
	}

	_regularToAutocomplete(profile) {
		// converts a keybase profile to the weird format used in the autocomplete
		// endpoint for backward compatability
		// (does NOT translate accounts - e.g. twitter, github - yet)
		// TODO this should be the other way around
		const cleanedProfile = { components: {} };
		cleanedProfile.thumbnail = null;
		if (
			(profile.pictures != null ? profile.pictures.primary : undefined) != null
		) {
			cleanedProfile.thumbnail = profile.pictures.primary.url;
		}
		const safe_name = profile.profile != null ? profile.profile.full_name : "";
		cleanedProfile.components = {
			full_name: { val: safe_name },
			username: { val: profile.basics.username },
		};
		_.each(profile.proofs_summary.all, (connectedAccount) => {
			const component = {};
			component[connectedAccount.proof_type] = {
				val: connectedAccount.nametag,
			};
			return (cleanedProfile.components = _.extend(
				cleanedProfile.components,
				component,
			));
		});
		return cleanedProfile;
	}
}

module.exports = new KeybaseAPI();
