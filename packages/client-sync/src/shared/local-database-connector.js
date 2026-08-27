import * as IsomorphicCore from "isomorphic-core";
import "../../../isomorphic-core/src/database-extensions.js"; // streamAll — relative so spec mocks of the package don't strip the side effect
import createDebug from "debug";
import Sequelize from "sequelize";
import fs from "fs";
import path from "path";
const {
	StringUtils,
	loadModels,
	HookIncrementVersionOnSave,
	HookTransactionLog,
} = IsomorphicCore;
import TransactionConnector from "./transaction-connector.js";

const debugVerbose = createDebug("sync:K2DB:all");

class LocalDatabaseConnector {
	constructor() {
		this._cache = {};
	}

	_sequelizePoolForDatabase(dbname) {
		const storage = NylasEnv.inSpecMode()
			? ":memory:"
			: path.join(process.env.NYLAS_HOME, `${dbname}.sqlite`);
		const dbLog = (q, time) => {
			debugVerbose(StringUtils.trimTo(`🔷 (${time}ms) ${q}`));
		};
		const sequelize = new Sequelize(dbname, "", "", {
			storage: storage,
			dialect: "sqlite",
			benchmark: debugVerbose.enabled,
			logging: debugVerbose.enabled ? dbLog : false,
		});
		sequelize.query("PRAGMA page_size = 8192");
		sequelize.query("PRAGMA cache_size = 4096");
		return sequelize;
	}

	forAccount(accountId) {
		if (!accountId) {
			return Promise.reject(
				new Error(`You need to pass an accountId to init the database!`),
			);
		}

		if (this._cache[accountId]) {
			return this._cache[accountId];
		}

		const newSequelize = this._sequelizePoolForDatabase(`a-${accountId}`);

		this._cache[accountId] = loadModels(Sequelize, newSequelize, {
			modelDirs: [path.resolve(__dirname, "..", "models")],
		}).then((db) => {
			HookTransactionLog(db, newSequelize, {
				onCreatedTransaction: (transaction) => {
					TransactionConnector.notifyDelta(db.accountId, transaction);
				},
			});

			HookIncrementVersionOnSave(db, newSequelize);

			db.sequelize = newSequelize;
			db.Sequelize = Sequelize;
			db.accountId = accountId;

			return newSequelize
				.authenticate()
				.then(() => newSequelize.sync())
				.then(() => db);
		});

		return this._cache[accountId];
	}

	ensureAccountDatabase(accountId) {
		return this.forAccount(accountId).then((db) => {
			// this is a bit of a hack, because sequelize.sync() doesn't work with
			// schemas. It's necessary to sync models individually and in the right order.
			const models = [
				"Contact",
				"Folder",
				"Label",
				"Transaction",
				"Thread",
				"ThreadLabel",
				"ThreadFolder",
				"Message",
				"MessageLabel",
				"Reference",
				"MessageReference",
				"File",
				"SyncbackRequest",
			];
			return models.reduce(
				(promise, name) => promise.then(() => db[name].sync()),
				Promise.resolve(),
			);
		});
	}

	async destroyAccountDatabase(accountId) {
		if (NylasEnv.inSpecMode()) {
			// The db is in memory, so we don't have to unlink it. Just drop the data.
			return this.forAccount(accountId).then((db) => {
				delete this._cache[accountId];
				return db.sequelize.drop();
			});
		}

		const dbname = `a-${accountId}`;
		const dbpath = path.join(process.env.NYLAS_HOME, `${dbname}.sqlite`);

		try {
			const err = fs.accessSync(dbpath, fs.F_OK);
			if (!err) {
				fs.unlinkSync(dbpath);
			}
		} catch (err) {
			// Ignored
		}

		delete this._cache[accountId];
		return Promise.resolve();
	}

	async _sequelizeForShared() {
		const sequelize = this._sequelizePoolForDatabase(`shared`);
		const db = await loadModels(Sequelize, sequelize);

		db.sequelize = sequelize;
		db.Sequelize = Sequelize;

		await sequelize.authenticate();
		await sequelize.sync();
		return db;
	}

	forShared() {
		this._cache.shared = this._cache.shared || this._sequelizeForShared();
		return this._cache.shared;
	}
}

export default new LocalDatabaseConnector();
