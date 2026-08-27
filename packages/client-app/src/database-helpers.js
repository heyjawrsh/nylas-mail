import { createRequire } from "node:module";

const nodeRequire =
	typeof import.meta.url === "string" && import.meta.url.startsWith("file:")
		? createRequire(import.meta.url)
		: require;
import path from "node:path";
import Sqlite3 from "better-sqlite3";

let app;
let errorLogger;

if (process.type === "renderer") {
	const remote = nodeRequire("@electron/remote");
	app = remote.getGlobal("application");
	// NylasEnv is assigned by the window bootstrap after module init.
	errorLogger = new Proxy(
		{},
		{
			get:
				(_t, prop) =>
				(...args) =>
					NylasEnv.errorLogger[prop](...args),
		},
	);
} else {
	app = global.application;
	errorLogger = global.errorLogger;
}

export function handleUnrecoverableDatabaseError(
	err = new Error(`Manually called handleUnrecoverableDatabaseError`),
) {
	const fingerprint = [
		"{{ default }}",
		"unrecoverable database error",
		err.message,
	];
	errorLogger.reportError(err, {
		fingerprint,
		rateLimit: {
			ratePerHour: 30,
			key: `handleUnrecoverableDatabaseError:${err.message}`,
		},
	});
	if (!app) {
		throw new Error("handleUnrecoverableDatabaseError: `app` is not ready!");
	}
	app.rebuildDatabase({ detail: err.toString() });
}

export async function openDatabase(dbPath) {
	try {
		// better-sqlite3 13 is synchronous with no event emitter: open is
		// immediate, pragmas apply inline.
		const db = new Sqlite3(dbPath, {});
		// https://www.sqlite.org/wal.html
		// WAL provides more concurrency as readers do not block writers and a writer
		// does not block readers. Reading and writing can proceed concurrently.
		db.pragma(`journal_mode = WAL`);

		// https://www.sqlite.org/intern-v-extern-blob.html
		// A database page size of 8192 or 16384 gives the best performance for large BLOB I/O.
		db.pragma(`main.page_size = 8192`);
		db.pragma(`main.cache_size = 20000`);
		db.pragma(`main.synchronous = NORMAL`);
		return db;
	} catch (err) {
		handleUnrecoverableDatabaseError(err);
		return null;
	}
}

export function databasePath(configDirPath, specMode = false) {
	let dbPath = path.join(configDirPath, "edgehill.db");
	if (specMode) {
		dbPath = path.join(configDirPath, "edgehill.test.db");
	}
	return dbPath;
}

// Dual CJS surface for native renderer loads (module is undefined in ESM).
if (typeof module !== "undefined" && module.exports) {
	module.exports = {
		openDatabase,
		handleUnrecoverableDatabaseError,
		databasePath,
	};
	module.exports.default = module.exports;
}
