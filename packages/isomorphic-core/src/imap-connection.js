import { ImapFlow } from "imapflow";
import _ from "underscore";
import xoauth2 from "xoauth2";
import EventEmitter from "events";
import IMAPBox from "./imap-box.js";
import { INSECURE_TLS_OPTIONS, SECURE_TLS_OPTIONS } from "./tls-utils.js";
import { RetryableError } from "./errors.js";
import { decodeXOAuth2String } from "./imap-translators.js";
import {
	convertImapError,
	IMAPConnectionTimeoutError,
	IMAPConnectionNotReadyError,
	IMAPConnectionEndedError,
} from "./imap-errors.js";

const Capabilities = {
	Gmail: "X-GM-EXT-1",
	Quota: "QUOTA",
	UIDPlus: "UIDPLUS",
	Condstore: "CONDSTORE",
	Search: "ESEARCH",
	Sort: "SORT",
};
const ONE_HOUR_SECS = 60 * 60;
const AUTH_TIMEOUT_MS = 30 * 1000;
const DEFAULT_SOCKET_TIMEOUT_MS = 30 * 1000;

/**
 * IMAPConnection wraps a current `imapflow` client behind the connection
 * API this codebase has always consumed (openBox/getBoxes/runOperation/...).
 * The 2026 modernization replaced the underlying node-imap fork; the public
 * surface is unchanged so client-sync's sync tasks keep working.
 */
export default class IMAPConnection extends EventEmitter {
	static DefaultSocketTimeout = DEFAULT_SOCKET_TIMEOUT_MS;

	static connect(...args) {
		return new IMAPConnection(...args).connect();
	}

	/**
	 * Resolve provider settings into an imapflow connection configuration.
	 * TLS floor: TLS 1.2 minimum everywhere; certificates are verified unless
	 * the account explicitly opted into insecure SSL (self-signed providers).
	 */
	static asyncResolveIMAPSettings(baseSettings) {
		const secure =
			baseSettings.imap_security === "SSL / TLS" ||
			baseSettings.ssl_required ||
			String(baseSettings.imap_port) === "993";

		const settings = {
			host: baseSettings.imap_host,
			port: Number(baseSettings.imap_port) || (secure ? 993 : 143),
			secure,
			socketTimeout: baseSettings.socketTimeout || DEFAULT_SOCKET_TIMEOUT_MS,
			authTimeout: baseSettings.authTimeout || AUTH_TIMEOUT_MS,
			tls:
				baseSettings.imap_allow_insecure_ssl === true
					? { ...INSECURE_TLS_OPTIONS }
					: { ...SECURE_TLS_OPTIONS },
		};

		if (process.env.NYLAS_DEBUG) {
			settings.emitLogs = true;
		}

		// This account uses XOAuth2, and we have the client_id + refresh token
		if (baseSettings.refresh_token) {
			const xoauthFields = [
				"client_id",
				"client_secret",
				"imap_username",
				"refresh_token",
			];
			if (Object.keys(_.pick(baseSettings, xoauthFields)).length !== 4) {
				return Promise.reject(
					new Error(
						`IMAPConnection: Expected ${xoauthFields.join(",")} when given refresh_token`,
					),
				);
			}
			return new Promise((resolve, reject) => {
				xoauth2
					.createXOAuth2Generator({
						clientId: baseSettings.client_id,
						clientSecret: baseSettings.client_secret,
						user: baseSettings.imap_username,
						refreshToken: baseSettings.refresh_token,
					})
					.getToken((err, token) => {
						if (err) {
							return reject(err);
						}
						const { accessToken } = decodeXOAuth2String(token);
						settings.auth = { user: baseSettings.imap_username, accessToken };
						settings.expiry_date =
							Math.floor(Date.now() / 1000) + ONE_HOUR_SECS;
						return resolve(settings);
					});
			});
		}

		// This account uses XOAuth2, and we have a token given to us by the
		// backend, which has the client secret.
		if (baseSettings.xoauth2) {
			const { accessToken } = decodeXOAuth2String(baseSettings.xoauth2);
			settings.auth = { user: baseSettings.imap_username, accessToken };
			settings.expiry_date = baseSettings.expiry_date;
			return Promise.resolve(settings);
		}

		settings.auth = {
			user: baseSettings.imap_username,
			pass: baseSettings.imap_password,
		};
		return Promise.resolve(settings);
	}

	constructor({ db, account, settings, logger } = {}) {
		super();

		if (!(settings instanceof Object)) {
			throw new Error("IMAPConnection: Must be instantiated with `settings`");
		}
		if (!logger) {
			throw new Error("IMAPConnection: Must be instantiated with `logger`");
		}

		this._logger = logger;
		this._db = db;
		this._account = account;
		this._queue = [];
		this._currentOperation = null;
		this._baseSettings = settings;
		this._resolvedSettings = null;
		this._imap = null;
		this._ready = false;
		this._connectPromise = null;
		this._isOpeningBox = false;
		this._lastOpenDuration = null;
		this._uidvalidityByBox = {};
	}

	async connect() {
		if (!this._connectPromise) {
			this._connectPromise = new Promise(async (resolve, reject) => {
				try {
					this._resolvedSettings =
						await IMAPConnection.asyncResolveIMAPSettings(this._baseSettings);
					await this._buildUnderlyingConnection();
					resolve(this);
				} catch (err) {
					reject(
						convertImapError(this._sourceTaggedError(err), {
							connectionSettings: this._resolvedSettings || {},
						}),
					);
				}
			});
		}
		return this._connectPromise;
	}

	/** Tag imapflow-shaped errors with the `source` field convertImapError reads. */
	_sourceTaggedError(err) {
		if (err && !err.source) {
			if (
				err.authenticationFailed ||
				(err.responseStatus && /auth/i.test(String(err.responseStatus)))
			) {
				err.source = "authentication";
			} else if (
				err.code === "ETIMEDOUT" ||
				err.code === "ESOCKETTIMEDOUT" ||
				/timeout/i.test(err.message || "")
			) {
				err.source = "timeout";
			} else if (
				/socket|ECONNRESET|ECONNREFUSED|EPIPE|closed/i.test(
					`${err.code || ""} ${err.message || ""}`,
				)
			) {
				err.source = "socket";
			}
		}
		return err;
	}

	end() {
		if (this._imap) {
			const imap = this._imap;
			this._imap = null;
			this._ready = false;
			try {
				imap.close(); // force-terminate; logout() waits on the server
			} catch (_) {
				/* already closed */
			}
		}
		this._queue = [];
		this._openBoxPath = undefined;
		this._connectPromise = null;
	}

	async _buildUnderlyingConnection() {
		this._imap = new ImapFlow({
			...this._resolvedSettings,
			logger: false, // imapflow's pino logger off; NYLAS_DEBUG uses emitLogs
		});

		this._imap.on("close", () => {
			this._logger.warn("Underlying IMAP connection has ended");
			this._ready = false;
			this.emit("ended");
			this.end();
		});

		this._imap.on("error", () => {
			this.end();
		});

		// `exists` fires when the message count of the open mailbox changes —
		// the new-mail signal node-imap exposed as `mail`.
		this._imap.on("exists", ({ path } = {}) => {
			if (this._isOpeningBox) {
				return;
			}
			if (!this._imap) {
				return;
			}
			if (!path || path === this.getOpenBoxName()) {
				this.emit("mail");
			}
		});

		// Message metadata (flags, labels) changed externally.
		this._imap.on("flags", ({ path } = {}) => {
			if (!path || path === this.getOpenBoxName()) {
				this.emit("update");
			}
		});

		this._imap.on("expunge", () => this.emit("update"));

		this._imap.on("alert", (msg) => {
			this._logger.info({ imap_server_msg: msg }, `IMAP server message`);
		});

		await this._imap.connect();
		this._ready = true;
	}

	/**
	 * @return {Promise} that resolves/rejects when the Promise returned by the
	 * passed-in callback resolves or rejects, and additionally will reject when
	 * the IMAP connection closes or times out.
	 */
	async _withPreparedConnection(callback) {
		if (!this._imap) {
			throw new IMAPConnectionNotReadyError(
				`IMAPConnection::_withPreparedConnection`,
			);
		}

		if (this._isOpeningBox) {
			throw new RetryableError(
				"IMAPConnection: Cannot operate on connection while opening a box.",
			);
		}

		let onEnded = null;
		let onErrored = null;

		try {
			return await new Promise(async (resolve, reject) => {
				const socketTimeout = setTimeout(() => {
					reject(new IMAPConnectionTimeoutError("Socket timed out"));
				}, this._resolvedSettings.socketTimeout);

				const wrappedResolve = (result) => {
					clearTimeout(socketTimeout);
					resolve(result);
				};
				const wrappedReject = (error) => {
					clearTimeout(socketTimeout);
					const convertedError = convertImapError(
						this._sourceTaggedError(error),
						{ connectionSettings: this._resolvedSettings },
					);
					reject(convertedError);
					this.end();
				};

				onEnded = () => {
					wrappedReject(new IMAPConnectionEndedError());
				};
				onErrored = (error) => {
					wrappedReject(error);
				};
				this._imap.on("error", onErrored);
				this._imap.on("close", onEnded);

				try {
					const result = await callback(this._imap);
					wrappedResolve(result);
				} catch (error) {
					wrappedReject(error);
				}
			});
		} finally {
			if (this._imap) {
				this._imap.removeListener("error", onErrored);
				this._imap.removeListener("close", onEnded);
			}
		}
	}

	getResolvedSettings() {
		return this._resolvedSettings;
	}

	getOpenBoxName() {
		if (this._openBoxPath !== undefined) {
			return this._openBoxPath;
		}
		return this._imap && this._imap.mailbox ? this._imap.mailbox.path : null;
	}

	serverSupports(capability) {
		if (!this._imap) {
			throw new IMAPConnectionNotReadyError(`IMAPConnection::serverSupports`);
		}
		return this._imap.capabilities.has(capability);
	}

	getLastOpenDuration() {
		if (this._isOpeningBox) {
			throw new RetryableError(
				"IMAPConnection: Cannot operate on connection while opening a box.",
			);
		}
		return this._lastOpenDuration;
	}

	/**
	 * @return {Promise} that resolves to instance of IMAPBox
	 */
	async openBox(folderName, { readOnly = false, refetchBoxInfo = false } = {}) {
		if (!folderName) {
			throw new Error(
				"IMAPConnection::openBox - You must provide a folder name",
			);
		}
		if (!this._imap) {
			throw new IMAPConnectionNotReadyError(`IMAPConnection::openBox`);
		}
		if (!refetchBoxInfo && folderName === this.getOpenBoxName()) {
			return Promise.resolve(this._boxFor(folderName));
		}
		return this._withPreparedConnection(async (imap) => {
			try {
				this._isOpeningBox = true;
				this._lastOpenDuration = null;
				const before = Date.now();
				const mailbox = await imap.mailboxOpen(folderName, { readOnly });
				this._openBoxPath = mailbox.path;
				this._lastOpenDuration = Date.now() - before;
				const previousUidValidity = this._uidvalidityByBox[mailbox.path];
				this._uidvalidityByBox[mailbox.path] = mailbox.uidValidity;
				if (
					previousUidValidity !== undefined &&
					previousUidValidity !== mailbox.uidValidity
				) {
					this.emit("uidvalidity");
				}
				return this._boxFor(mailbox.path);
			} finally {
				this._isOpeningBox = false;
			}
		});
	}

	_boxFor(path) {
		return new IMAPBox(this, { name: path });
	}

	async getLatestBoxStatus(folderName) {
		if (!folderName) {
			throw new Error(
				"IMAPConnection::getLatestBoxStatus - You must provide a folder name",
			);
		}
		if (folderName === this.getOpenBoxName()) {
			// If the box is already open, we need to re-issue a SELECT in order to
			// get the latest stats from the box (e.g. latest uidnext, etc)
			return this.openBox(folderName, { refetchBoxInfo: true }).then(() =>
				this._statusFor(folderName),
			);
		}
		return this._statusFor(folderName);
	}

	async _statusFor(folderName) {
		return this._withPreparedConnection(async (imap) => {
			const status = await imap.status(folderName, {
				messages: true,
				uidNext: true,
				uidValidity: true,
				highestModSeq: true,
				unseen: true,
			});
			return {
				name: folderName,
				uidnext: status.uidNext,
				uidvalidity: status.uidValidity,
				messages: status.messages,
				unseen: status.unseen,
				highestmodseq: status.highestModSeq,
			};
		});
	}

	async getBoxes() {
		if (!this._imap) {
			throw new IMAPConnectionNotReadyError(`IMAPConnection::getBoxes`);
		}
		return this._withPreparedConnection(async (imap) => {
			const boxes = await imap.list();
			return this._boxesToTree(boxes);
		});
	}

	/**
	 * Rebuild the nested node-imap box tree {children, attribs, delimiter}
	 * from imapflow's flat list() output.
	 */
	_boxesToTree(boxes) {
		const delimiter = (boxes.find((b) => b.delimiter) || {}).delimiter || "/";
		const root = { attribs: [], delimiter, children: {} };
		for (const box of boxes) {
			const segments = box.path.split(box.delimiter || delimiter);
			let node = root;
			for (let i = 0; i < segments.length; i++) {
				const name = segments[i];
				if (!name) {
					continue;
				}
				node.children[name] = node.children[name] || {
					attribs: [],
					delimiter: box.delimiter || delimiter,
					children: {},
					path: segments.slice(0, i + 1).join(box.delimiter || delimiter),
				};
				node = node.children[name];
			}
			if (box.specialUse) {
				node.attribs.push(`\\${box.specialUse}`);
			}
		}
		const markDepth = (node) => {
			const childNames = Object.keys(node.children);
			node.attribs.push(
				childNames.length ? "\\HasChildren" : "\\HasNoChildren",
			);
			childNames.forEach((n) => markDepth(node.children[n]));
		};
		markDepth(root);
		return root;
	}

	async addBox(folderName) {
		if (!this._imap) {
			throw new IMAPConnectionNotReadyError(`IMAPConnection::addBox`);
		}
		return this._withPreparedConnection((imap) =>
			imap.mailboxCreate(folderName),
		);
	}

	async renameBox(oldFolderName, newFolderName) {
		if (!this._imap) {
			throw new IMAPConnectionNotReadyError(`IMAPConnection::renameBox`);
		}
		return this._withPreparedConnection((imap) =>
			imap.mailboxRename(oldFolderName, newFolderName),
		);
	}

	async delBox(folderName) {
		if (!this._imap) {
			throw new IMAPConnectionNotReadyError(`IMAPConnection::delBox`);
		}
		return this._withPreparedConnection((imap) =>
			imap.mailboxDelete(folderName),
		);
	}

	async runOperation(operation, ctx) {
		if (!this._imap) {
			throw new IMAPConnectionNotReadyError(`IMAPConnection::runOperation`);
		}
		return new Promise((resolve, reject) => {
			this._queue.push({ operation, ctx, resolve, reject });
			if (this._ready && !this._currentOperation) {
				this._processNextOperation();
			}
		});
	}

	_processNextOperation() {
		if (this._currentOperation) {
			return;
		}
		this._currentOperation = this._queue.shift();
		if (!this._currentOperation) {
			this.emit("queue-empty");
			return;
		}

		const { operation, ctx, resolve, reject } = this._currentOperation;
		const resultPromise = operation.run(this._db, this, ctx);
		if (!resultPromise || typeof resultPromise.then !== "function") {
			reject(
				new Error(`Expected ${operation.constructor.name} to return promise.`),
			);
			return;
		}

		resultPromise
			.then((maybeResult) => {
				this._currentOperation = null;
				resolve(maybeResult);
				this._processNextOperation();
			})
			.catch((err) => {
				this._currentOperation = null;
				this._logger.error(
					{
						err: err,
						operation_type: operation.constructor.name,
						operation_description: operation.description(),
					},
					`IMAPConnection - operation errored`,
				);
				reject(err);
			});
	}
}

IMAPConnection.Capabilities = Capabilities;
