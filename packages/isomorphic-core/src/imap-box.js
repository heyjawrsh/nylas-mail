import _ from "underscore";
import { RetryableError } from "./errors.js";
import { IMAPConnectionNotReadyError } from "./imap-errors.js";
import {
	bodySpecToFetchQuery,
	criteriaToSearchQuery,
	imapflowStructToLegacy,
} from "./imap-translators.js";

/*
IMAPBox uses Proxy to wrap the mailbox exposed by the connection. It provides
higher-level primitives, but you can still call through to properties /
methods of the underlying mailbox, ala `imapbox.uidvalidity`.
*/
class IMAPBox {
	constructor(imapConn, box) {
		this._conn = imapConn;
		this._box = box;

		return new Proxy(this, {
			get(obj, prop) {
				const val = prop in obj ? obj[prop] : obj._box[prop];

				if (_.isFunction(val)) {
					const myBox = obj._box.name;
					const openBox = obj._conn.getOpenBoxName();
					if (myBox !== openBox) {
						return () => {
							throw new RetryableError(
								`IMAPBox::${prop} - Mailbox is no longer selected on the IMAPConnection (${myBox} != ${openBox}).`,
							);
						};
					}
				}

				return val;
			},
		});
	}

	_withPreparedConnection(cb) {
		return this._conn._withPreparedConnection(cb);
	}

	/**
	 * @param {array|string} range - can be a single message identifier,
	 * a message identifier range (e.g. '2504:2507' or '*' or '2504:*'),
	 * an array of message identifiers, or an array of message identifier ranges.
	 * @param {Object} options - {struct: true} and/or {bodies: [...specs]}
	 * @param {function} forEachMessageCallback - function to be called with each
	 * message as it comes in, as ({attributes, headers, parts})
	 * @return {Promise} that resolves when every message has been fed to the
	 * callback
	 */
	async fetchEach(range, options, forEachMessageCallback) {
		if (!options) {
			throw new Error("IMAPBox.fetch now requires an options object.");
		}
		if (Array.isArray(range) && range.length === 0) {
			return Promise.resolve();
		}

		return this._withPreparedConnection(async (imap) => {
			const query = {
				uid: true,
				flags: true,
				internalDate: true,
				emailId: true,
				threadId: true,
			};
			if (options.struct) {
				query.bodyStructure = true;
			}

			const bodySpecs = [];
			const headerSpecs = [];
			let wantsSource = false;
			for (const spec of options.bodies || []) {
				const { query: fragment, key } = bodySpecToFetchQuery(spec);
				if (fragment.headers) {
					headerSpecs.push({
						key,
						fields: fragment.headers === true ? true : fragment.headers,
					});
					if (fragment.headers === true) {
						query.headers = true;
					} else {
						query.headers =
							query.headers === true
								? true
								: [].concat(query.headers || [], fragment.headers);
					}
				} else if (fragment.source) {
					wantsSource = true;
				} else if (fragment.bodyParts) {
					bodySpecs.push({ key, part: fragment.bodyParts[0] });
					query.bodyParts = [].concat(
						query.bodyParts || [],
						fragment.bodyParts,
					);
				}
			}

			for await (const message of imap.fetch(_rangeToString(range), query, {
				uid: true,
			})) {
				const attributes = _legacyAttributes(message);
				const parts = {};
				let headers = null;

				if (message.bodyStructure) {
					attributes.struct = imapflowStructToLegacy(message.bodyStructure);
				}
				if (message.headers) {
					const headerBuffer = await _collect(message.headers);
					for (const { key, fields } of headerSpecs) {
						if (fields === true) {
							headers = headerBuffer;
						} else {
							parts[key] = _filterHeaderFields(headerBuffer, fields);
						}
					}
					if (!headerSpecs.some((s) => s.fields === true)) {
						headers = headerBuffer;
					}
				}
				if (message.bodyParts) {
					for (const [key, content] of message.bodyParts) {
						parts[String(key).toUpperCase()] = await _collect(content);
					}
				}
				if (wantsSource && message.source) {
					const raw = await _collect(message.source);
					const split = raw.indexOf("\r\n\r\n");
					parts.TEXT = split >= 0 ? raw.slice(split + 4) : raw;
					if (headers === null) {
						headers = split >= 0 ? raw.slice(0, split) : raw;
					}
				}

				forEachMessageCallback({ attributes, headers, parts });
			}
		});
	}

	/**
	 * @return {Promise} that resolves to requested message
	 */
	async fetchMessage(uid) {
		if (!uid) {
			throw new Error("IMAPConnection.fetchMessage requires a message uid.");
		}
		let message;
		await this.fetchEach([uid], { bodies: ["HEADER", "TEXT"] }, (msg) => {
			message = msg;
		});
		return message;
	}

	async fetchMessageStream(uid, { fetchOptions, onFetchComplete } = {}) {
		if (!uid) {
			throw new Error("IMAPConnection.fetchStream requires a message uid.");
		}
		if (!fetchOptions) {
			throw new Error("IMAPConnection.fetchStream requires an options object.");
		}
		return this._withPreparedConnection(async (imap) => {
			for await (const message of imap.fetch(
				String(uid),
				{ source: true },
				{ uid: true },
			)) {
				const stream = message.source;
				if (onFetchComplete) {
					stream.on && stream.on("end", onFetchComplete);
				}
				return stream;
			}
			throw new Error(
				`IMAPConnection.fetchMessageStream: no message with uid ${uid}`,
			);
		});
	}

	/**
	 * @param {array|string} range - can be a single message identifier,
	 * a message identifier range (e.g. '2504:2507' or '*' or '2504:*'),
	 * an array of message identifiers, or an array of message identifier ranges.
	 * @return {Promise} that resolves to a map of uid -> attributes for every
	 * message in the range
	 */
	async fetchUIDAttributes(range, fetchOptions = {}) {
		return this._withPreparedConnection(async (imap) => {
			const attributesByUID = {};
			const query = {
				uid: true,
				flags: true,
				internalDate: true,
				emailId: true,
				threadId: true,
			};
			if (fetchOptions.struct) {
				query.bodyStructure = true;
			}
			const options = { uid: true };
			if (fetchOptions.modifiers && fetchOptions.modifiers.changedsince) {
				options.changedSince = fetchOptions.modifiers.changedsince;
			}
			for await (const message of imap.fetch(
				_rangeToString(range),
				query,
				options,
			)) {
				attributesByUID[message.uid] = _legacyAttributes(message);
				if (message.bodyStructure) {
					attributesByUID[message.uid].struct = imapflowStructToLegacy(
						message.bodyStructure,
					);
				}
			}
			return attributesByUID;
		});
	}

	addFlags(range, flags) {
		if (!this._conn._imap) {
			throw new IMAPConnectionNotReadyError(`IMAPBox::addFlags`);
		}
		return this._withPreparedConnection((imap) =>
			imap.messageFlagsAdd(_rangeToString(range), flags, { uid: true }),
		);
	}

	delFlags(range, flags) {
		if (!this._conn._imap) {
			throw new IMAPConnectionNotReadyError(`IMAPBox::delFlags`);
		}
		return this._withPreparedConnection((imap) =>
			imap.messageFlagsRemove(_rangeToString(range), flags, { uid: true }),
		);
	}

	moveFromBox(range, folderName) {
		if (!this._conn._imap) {
			throw new IMAPConnectionNotReadyError(`IMAPBox::moveFromBox`);
		}
		return this._withPreparedConnection((imap) =>
			imap.messageMove(_rangeToString(range), folderName, { uid: true }),
		);
	}

	setLabels(range, labels) {
		if (!this._conn._imap) {
			throw new IMAPConnectionNotReadyError(`IMAPBox::setLabels`);
		}
		return this._withPreparedConnection((imap) =>
			imap.messageLabelsAdd(_rangeToString(range), labels, { uid: true }),
		);
	}

	removeLabels(range, labels) {
		if (!this._conn._imap) {
			throw new IMAPConnectionNotReadyError(`IMAPBox::removeLabels`);
		}
		return this._withPreparedConnection((imap) =>
			imap.messageLabelsRemove(_rangeToString(range), labels, { uid: true }),
		);
	}

	append(rawMime, options = {}) {
		if (!this._conn._imap) {
			throw new IMAPConnectionNotReadyError(`IMAPBox::append`);
		}
		const path = options.mailbox || this._box.name;
		return this._withPreparedConnection((imap) =>
			imap.append(path, rawMime, { flags: options.flags, date: options.date }),
		);
	}

	search(criteria) {
		if (!this._conn._imap) {
			throw new IMAPConnectionNotReadyError(`IMAPBox::search`);
		}
		return this._withPreparedConnection((imap) =>
			imap.search(criteriaToSearchQuery(criteria), { uid: true }),
		);
	}

	closeBox({ expunge = true } = {}) {
		if (!this._conn._imap) {
			throw new IMAPConnectionNotReadyError(`IMAPBox::closeBox`);
		}
		return this._withPreparedConnection((imap) => imap.mailboxClose());
	}
}

function _rangeToString(range) {
	if (Array.isArray(range)) {
		return range.join(",");
	}
	return String(range);
}

function _legacyAttributes(message) {
	const attributes = {
		uid: message.uid,
		flags: message.flags ? [...message.flags] : [],
		date: message.internalDate,
	};
	if (message.threadId) {
		attributes["x-gm-thrid"] = message.threadId;
	}
	if (message.emailId) {
		attributes["x-gm-msgid"] = message.emailId;
	}
	if (message.labels) {
		attributes["x-gm-labels"] = [...message.labels];
	}
	if (message.modseq !== undefined) {
		attributes.modseq = message.modseq;
	}
	return attributes;
}

async function _collect(content) {
	if (content == null) {
		return Buffer.alloc(0);
	}
	if (Buffer.isBuffer(content)) {
		return content;
	}
	if (typeof content === "string") {
		return Buffer.from(content);
	}
	// Readable stream
	const chunks = [];
	for await (const chunk of content) {
		chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
	}
	return Buffer.concat(chunks);
}

function _filterHeaderFields(headerBuffer, fields) {
	const wanted = new Set(fields.map((f) => f.toLowerCase()));
	const lines = headerBuffer.toString("utf8").split(/\r?\n/);
	const kept = [];
	let inWanted = false;
	for (const line of lines) {
		const isContinuation = /^\s/.test(line);
		if (!isContinuation) {
			const name = line.split(":")[0];
			inWanted = wanted.has(name.toLowerCase());
		}
		if (inWanted && line !== "") {
			kept.push(line);
		}
	}
	return Buffer.from(`${kept.join("\r\n")}\r\n`);
}

export default IMAPBox;
