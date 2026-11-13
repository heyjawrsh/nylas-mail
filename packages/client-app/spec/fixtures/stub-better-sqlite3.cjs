// Preload for forking database-agent.js under plain node in specs: the real
// better-sqlite3 binary is built for Electron's ABI.
const Module = require("node:module");

const originalLoad = Module._load;
Module._load = function load(request, ...rest) {
	if (request === "better-sqlite3") {
		return class Database {
			prepare(query) {
				if (query.includes("bad")) throw new Error(`SQLITE_ERROR: near "bad"`);
				return { all: () => [{ ok: 1 }], run: () => ({ changes: 0 }) };
			}
		};
	}
	return originalLoad.call(this, request, ...rest);
};
