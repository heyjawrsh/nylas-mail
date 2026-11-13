const Sqlite3 = require("better-sqlite3");
const dbs = {};

const deathDelay = 5000;
let deathTimer = setTimeout(() => process.exit(0), deathDelay);

// better-sqlite3 opens synchronously and has no open/close events.
const getDatabase = (dbpath) => {
	if (!dbs[dbpath]) {
		dbs[dbpath] = new Sqlite3(dbpath, {});
	}
	return Promise.resolve(dbs[dbpath]);
};

process.on("message", (m) => {
	clearTimeout(deathTimer);
	const { query, values, id, dbpath } = m;
	const start = Date.now();

	getDatabase(dbpath).then((db) => {
		clearTimeout(deathTimer);
		const fn = query.startsWith("SELECT") ? "all" : "run";
		const stmt = db.prepare(query);
		const results = stmt[fn](values);
		process.send({
			type: "results",
			results,
			id,
			agentTime: Date.now() - start,
		});

		clearTimeout(deathTimer);
		deathTimer = setTimeout(() => process.exit(0), deathDelay);
	});
});
