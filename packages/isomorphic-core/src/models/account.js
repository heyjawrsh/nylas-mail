import crypto from "node:crypto";

import { JSONColumn, JSONArrayColumn } from "../database-types.js";
import {
	credentialsForProvider,
	smtpConfigFromSettings,
} from "../auth-helpers.js";
import { MAX_INDEXABLE_LENGTH } from "../db-utils.js";

const { DB_ENCRYPTION_ALGORITHM, DB_ENCRYPTION_PASSWORD } = process.env;

// Modern credential crypto: aes-XXX via createCipheriv with a random IV
// (createCipher was removed from Node). Format: hex(iv) + ":" + hex(cipher).
function deriveKey() {
	return crypto
		.createHash("sha256")
		.update(String(DB_ENCRYPTION_PASSWORD), "utf8")
		.digest();
}

function encryptJson(json) {
	const iv = crypto.randomBytes(16);
	const cipher = crypto.createCipheriv(
		DB_ENCRYPTION_ALGORITHM,
		deriveKey(),
		iv,
	);
	let crypted = cipher.update(JSON.stringify(json), "utf8", "hex");
	crypted += cipher.final("hex");
	return `${iv.toString("hex")}:${crypted}`;
}

function decryptJson(payload) {
	const [ivHex, body] = String(payload).split(":");
	const decipher = crypto.createDecipheriv(
		DB_ENCRYPTION_ALGORITHM,
		deriveKey(),
		Buffer.from(ivHex, "hex"),
	);
	let dec = decipher.update(body, "hex", "utf8");
	dec += decipher.final("utf8");
	return dec;
}

export default (sequelize, Sequelize) => {
	const Account = sequelize.define(
		"account",
		{
			id: { type: Sequelize.STRING(65), primaryKey: true },
			name: Sequelize.STRING,
			provider: Sequelize.STRING,
			emailAddress: Sequelize.STRING(MAX_INDEXABLE_LENGTH),
			connectionSettings: JSONColumn("connectionSettings"),
			connectionCredentials: Sequelize.TEXT,
			syncPolicy: JSONColumn("syncPolicy"),
			syncError: JSONColumn("syncError"),
			firstSyncCompletion: {
				type: Sequelize.STRING(14),
				allowNull: true,
				defaultValue: null,
			},
			lastSyncCompletions: JSONArrayColumn("lastSyncCompletions"),
		},
		{
			indexes: [{ unique: true, fields: ["id"] }],
		},
	);

	Account.associate = (data = {}) => {
		Account.hasMany(data.AccountToken, {
			as: "tokens",
			onDelete: "cascade",
			hooks: true,
		});
	};
	Account.hash = ({ emailAddress, connectionSettings } = {}) => {
		const idString = `${emailAddress}${JSON.stringify(connectionSettings)}`;
		return crypto.createHash("sha256").update(idString, "utf8").digest("hex");
	};
	Account.upsertWithCredentials = (accountParams, credentials) => {
		if (
			!accountParams ||
			!credentials ||
			!accountParams.emailAddress ||
			!accountParams.connectionSettings
		) {
			throw new Error(
				"Need to pass accountParams and credentials to upsertWithCredentials",
			);
		}
		const id = Account.hash(accountParams);
		return Account.findByPk(id).then((existing) => {
			const account =
				existing || Account.build(Object.assign({ id }, accountParams));
			account.setCredentials(credentials);
			return account.save().then((saved) => {
				return sequelize.models.accountToken
					.create({ accountId: saved.id })
					.then((token) => ({ account: saved, token }));
			});
		});
	};

	Account.prototype.toJSON = function toJSON() {
		return {
			id: this.id,
			name: this.name,
			object: "account",
			organization_unit: this.provider === "gmail" ? "label" : "folder",
			provider: this.provider,
			email_address: this.emailAddress,
			connection_settings: this.connectionSettings,
			sync_policy: this.syncPolicy,
			sync_error: this.syncError,
			first_sync_completion: this.firstSyncCompletion / 1,
			last_sync_completions: this.lastSyncCompletions,
			created_at: this.createdAt,
		};
	};
	Account.prototype.errored = function errored() {
		return this.syncError != null;
	};
	Account.prototype.setCredentials = function setCredentials(json) {
		if (!(json instanceof Object))
			throw new Error("Call setCredentials with JSON!");
		if (DB_ENCRYPTION_ALGORITHM && DB_ENCRYPTION_PASSWORD) {
			this.connectionCredentials = encryptJson(json);
		} else {
			this.connectionCredentials = JSON.stringify(json);
		}
	};
	Account.prototype.decryptedCredentials = function decryptedCredentials() {
		let dec = this.connectionCredentials;
		if (DB_ENCRYPTION_ALGORITHM && DB_ENCRYPTION_PASSWORD) {
			dec = decryptJson(this.connectionCredentials);
		}
		try {
			return JSON.parse(dec);
		} catch (_err) {
			return null;
		}
	};
	Account.prototype.smtpConfig = function smtpConfig() {
		const { connectionSettings, connectionCredentials } =
			credentialsForProvider({
				provider: this.provider,
				settings: Object.assign(
					{},
					this.decryptedCredentials(),
					this.connectionSettings,
				),
				email: this.emailAddress,
			});
		return smtpConfigFromSettings(
			this.provider,
			connectionSettings,
			connectionCredentials,
		);
	};

	return Account;
};
