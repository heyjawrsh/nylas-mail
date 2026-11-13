const Sqlite3 = require("better-sqlite3");
const dbs = {};

const deathDelay = 5000;
let deathTimer = setTimeout(() => process.exit(0), deathDelay);

// better-sqlite3 opens synchronously and has no open/close events.
const getDatabase = (dbpath) => {
	if (!dbs[dbpath]) {
		dbs[dbpath] = new Sqlite3(dbpath, {});
	}
	return dbs[dbpath];
};

// Every message gets a reply. On an error the parent runs the query itself.
process.on("message", (m) => {
	clearTimeout(deathTimer);
	const { query, values, id, dbpath } = m;
	const start = Date.now();

	try {
		const db = getDatabase(dbpath);
		const fn = query.startsWith("SELECT") ? "all" : "run";
		const results = db.prepare(query)[fn](values);
		process.send({
			type: "results",
			results,
			id,
			agentTime: Date.now() - start,
		});
	} catch (err) {
		process.send({ type: "error", id, error: String(err) });
	}

	clearTimeout(deathTimer);
	deathTimer = setTimeout(() => process.exit(0), deathDelay);
});
