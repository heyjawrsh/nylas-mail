import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => {
	const display = { workAreaSize: { width: 1440, height: 900 } };
	const win = { id: 7 };
	const application = {
		databasePhase: vi.fn(() => "setup"),
		setDatabasePhase: vi.fn(),
	};
	return {
		display,
		win,
		application,
		ipcOn: vi.fn(),
		ipcSend: vi.fn(),
		showMessageBox: vi.fn(),
		queryInstances: [],
		queryResults: [],
		writerInstances: [],
		transactionEvents: [],
	};
});

vi.mock("node:module", () => {
	const createRequire = () => vi.fn(() => () => ({}));
	return { default: { createRequire }, createRequire };
});
vi.mock("node:path", () => {
	const path = {
		join: (...parts) => parts.join("/"),
		dirname: (value) => value.split("/").slice(0, -1).join("/"),
	};
	return { default: path, ...path };
});
vi.mock("debug", () => {
	const createDebug = vi.fn(() => Object.assign(vi.fn(), { enabled: false }));
	return { default: createDebug, createDebug };
});
vi.mock("node:child_process", () => {
	const childProcess = { fork: vi.fn() };
	return { default: childProcess, ...childProcess };
});
vi.mock("promise-queue", () => ({
	default: class PromiseQueue {
		constructor() { this.tail = Promise.resolve(); }
		add(fn) {
			const result = this.tail.then(fn);
			this.tail = result.catch(() => {});
			return result;
		}
	},
}));
vi.mock("electron", () => {
	const ipcRenderer = { on: m.ipcOn, send: m.ipcSend };
	const remote = {
		app: { quit: vi.fn(), getVersion: () => "0", getPath: () => "/tmp" },
		screen: { getPrimaryDisplay: () => m.display },
		dialog: { showMessageBox: m.showMessageBox },
		getCurrentWindow: () => m.win,
		getGlobal: () => m.application,
	};
	return { default: { ipcRenderer, remote }, ipcRenderer, remote };
});
vi.mock("@electron/remote", () => {
	const ipcRenderer = { on: m.ipcOn, send: m.ipcSend };
	const remote = {
		app: { quit: vi.fn(), getVersion: () => "0", getPath: () => "/tmp" },
		screen: { getPrimaryDisplay: () => m.display },
		dialog: { showMessageBox: m.showMessageBox },
		getCurrentWindow: () => m.win,
		getGlobal: () => m.application,
	};
	return {
		default: { remote, ipcRenderer }, remote, ipcRenderer,
		app: remote.app, screen: remote.screen, dialog: remote.dialog,
		getCurrentWindow: remote.getCurrentWindow,
	};
});
vi.mock("lru-cache", () => {
	class LRUCache {
		constructor() { this.cache = new Map(); }
		get(key) { return this.cache.get(key); }
		set(key, value) { this.cache.set(key, value); }
		del(key) { this.cache.delete(key); }
	}
	return { default: { LRUCache }, LRUCache };
});
vi.mock("isomorphic-core", () => {
	const core = {
		StringUtils: { trimTo: (value) => value },
		ExponentialBackoffScheduler: class ExponentialBackoffScheduler {},
	};
	return { default: core, ...core };
});
vi.mock("../src/global/nylas-store.js", () => ({
	default: class NylasStore {
		setupEmitter() {
			this._emitter = {
				setMaxListeners: vi.fn(), on: vi.fn(), removeListener: vi.fn(), emit: vi.fn(),
			};
		}
		trigger(value) {
			this._triggered = this._triggered || [];
			this._triggered.push(value);
		}
	},
}));
vi.mock("../src/flux/models/utils.js", () => ({
	default: {
		isTempId: (id) => id.startsWith("temp-"),
		generateTempId: vi.fn(() => "temp-generated"),
	},
}));
vi.mock("../src/flux/models/query.js", () => ({
	default: class Query {
		constructor(klass, store) {
			this.klass = klass;
			this.store = store;
			this.calls = [];
			m.queryInstances.push(this);
		}
		where(value) { this.calls.push(["where", value]); return this; }
		order(value) { this.calls.push(["order", value]); return this; }
		limit(value) { this.calls.push(["limit", value]); return this; }
		markNotBackgroundable() { this.calls.push(["markNotBackgroundable"]); return this; }
		then(resolve, reject) { return Promise.resolve(m.queryResults.shift() || []).then(resolve, reject); }
	},
}));
vi.mock("../src/flux/stores/database-change-record.js", () => ({
	default: class DatabaseChangeRecord {
		constructor(change) { Object.assign(this, change); }
	},
}));
vi.mock("../src/flux/stores/database-writer.js", () => ({
	default: class DatabaseWriter {
		constructor(store) { this.store = store; m.writerInstances.push(this); }
		async executeInTransaction(fn) {
			m.transactionEvents.push("begin");
			try {
				const result = await fn(this);
				m.transactionEvents.push("commit");
				return result;
			} catch (error) {
				m.transactionEvents.push("rollback");
				throw error;
			}
		}
		execute(fn) { return fn(this); }
	},
}));
vi.mock("../src/flux/stores/database-setup-query-builder.js", () => ({
	default: class DatabaseSetupQueryBuilder { setupQueries() { return []; } },
}));
vi.mock("../src/database-helpers.js", () => ({
	default: {},
	openDatabase: vi.fn(),
	handleUnrecoverableDatabaseError: vi.fn(),
	databasePath: vi.fn((dir) => `${dir}/mail.db`),
}));

globalThis.NylasEnv = {
	getConfigDirPath: vi.fn(() => "/config"),
	inSpecMode: vi.fn(() => true),
	inDevMode: vi.fn(() => false),
	isWorkWindow: vi.fn(() => true),
};

const { default: DatabaseStore } = await import("../src/flux/stores/database-store.js");

class Message {
	constructor(values = {}) { Object.assign(this, values); }
}
Message.attributes = {
	id: { in: vi.fn((values) => ({ column: "id", values })) },
	clientId: { in: vi.fn((values) => ({ column: "clientId", values })) },
};

class Thread extends Message {}

const change = (objects, overrides = {}) => ({
	objectClass: Message,
	type: "persist",
	objects,
	...overrides,
});

describe("DatabaseStore deep query fluency", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		m.queryInstances.length = 0;
		m.queryResults.length = 0;
	});

	it("constructs a query for the requested model class", () => {
		const query = DatabaseStore.findAll(Message);
		expect(query.klass).toBe(Message);
	});

	it("binds a new query to the database store", () => {
		const query = DatabaseStore.findAll(Message);
		expect(query.store).toBe(DatabaseStore);
	});

	it("starts with an empty where clause by default", () => {
		expect(DatabaseStore.findAll(Message).calls).toEqual([["where", []]]);
	});

	it("passes initial predicates without cloning them", () => {
		const predicates = [{ accountId: "a1" }];
		expect(DatabaseStore.findAll(Message, predicates).calls[0][1]).toBe(predicates);
	});

	it("keeps where fluent", () => {
		const query = DatabaseStore.findAll(Message);
		expect(query.where({ unread: true })).toBe(query);
	});

	it("keeps order fluent", () => {
		const query = DatabaseStore.findAll(Message);
		expect(query.order("date DESC")).toBe(query);
	});

	it("keeps limit fluent", () => {
		const query = DatabaseStore.findAll(Message);
		expect(query.limit(25)).toBe(query);
	});

	it("preserves a full where, order, and limit chain", () => {
		const query = DatabaseStore.findAll(Message, [{ folder: "inbox" }])
			.where({ unread: true }).order("date DESC").limit(25);
		expect(query.calls).toEqual([
			["where", [{ folder: "inbox" }]], ["where", { unread: true }],
			["order", "date DESC"], ["limit", 25],
		]);
	});
});

describe("DatabaseStore modelify chains", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		m.queryInstances.length = 0;
		m.queryResults.length = 0;
		Promise.props = (values) => Promise.all(
			Object.entries(values).map(async ([key, value]) => [key, await value]),
		).then((entries) => Object.fromEntries(entries));
	});

	it("returns an empty array for undefined input", async () => {
		await expect(DatabaseStore.modelify(Message)).resolves.toEqual([]);
	});

	it("returns an empty array for an object input", async () => {
		await expect(DatabaseStore.modelify(Message, {})).resolves.toEqual([]);
	});

	it("returns the same array when every model has a server id", async () => {
		const models = [new Message({ id: "m1", serverId: "s1" })];
		await expect(DatabaseStore.modelify(Message, models)).resolves.toBe(models);
	});

	it("does not query server-backed model instances", async () => {
		await DatabaseStore.modelify(Message, [new Message({ serverId: "s1" })]);
		expect(m.queryInstances).toHaveLength(0);
	});

	it("rejects a model of a different class", () => {
		expect(() => DatabaseStore.modelify(Thread, [new Message({ id: "m1" })]))
			.toThrow("Not sure how to convert");
	});

	it("groups ordinary ids into one id query", async () => {
		m.queryResults.push([new Message({ id: "m1" }), new Message({ id: "m2" })]);
		await DatabaseStore.modelify(Message, ["m1", "m2"]);
		expect(Message.attributes.id.in).toHaveBeenCalledWith(["m1", "m2"]);
	});

	it("groups temporary ids into one client-id query", async () => {
		m.queryResults.push([new Message({ clientId: "temp-1" }), new Message({ clientId: "temp-2" })]);
		await DatabaseStore.modelify(Message, ["temp-1", "temp-2"]);
		expect(Message.attributes.clientId.in).toHaveBeenCalledWith(["temp-1", "temp-2"]);
	});

	it("marks the ordinary-id query as foreground-only", async () => {
		m.queryResults.push([]);
		await DatabaseStore.modelify(Message, ["m1"]);
		expect(m.queryInstances[0].calls.at(-1)).toEqual(["markNotBackgroundable"]);
	});

	it("marks the client-id query as foreground-only", async () => {
		m.queryResults.push([]);
		await DatabaseStore.modelify(Message, ["temp-1"]);
		expect(m.queryInstances[0].calls.at(-1)).toEqual(["markNotBackgroundable"]);
	});

	it("runs separate chains for ordinary and temporary ids", async () => {
		m.queryResults.push([new Message({ id: "m1" })], [new Message({ clientId: "temp-1" })]);
		await DatabaseStore.modelify(Message, ["m1", "temp-1"]);
		expect(m.queryInstances).toHaveLength(2);
	});

	it("restores mixed query results to input order", async () => {
		const byId = new Message({ id: "m1" });
		const byClientId = new Message({ clientId: "temp-1" });
		m.queryResults.push([byId], [byClientId]);
		await expect(DatabaseStore.modelify(Message, ["temp-1", "m1"]))
			.resolves.toEqual([byClientId, byId]);
	});

	it("preserves an unsynced instance while querying its client id", async () => {
		const local = new Message({ clientId: "temp-local" });
		m.queryResults.push([new Message({ clientId: "temp-local" })]);
		await expect(DatabaseStore.modelify(Message, [local])).resolves.toEqual([local]);
	});
});

describe("DatabaseStore transaction queue", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		m.writerInstances.length = 0;
		m.transactionEvents.length = 0;
		DatabaseStore._transactionQueue = null;
	});

	it("resolves with the transaction callback value after commit", async () => {
		await expect(DatabaseStore.inTransaction(() => "saved")).resolves.toBe("saved");
		expect(m.transactionEvents).toEqual(["begin", "commit"]);
	});

	it("waits for an asynchronous callback before commit", async () => {
		await DatabaseStore.inTransaction(async () => {
			await Promise.resolve();
			m.transactionEvents.push("write");
		});
		expect(m.transactionEvents).toEqual(["begin", "write", "commit"]);
	});

	it("rejects with the callback error after rollback", async () => {
		const failure = new Error("write failed");
		await expect(DatabaseStore.inTransaction(() => { throw failure; })).rejects.toBe(failure);
		expect(m.transactionEvents).toEqual(["begin", "rollback"]);
	});

	it("rolls back an asynchronously rejected callback", async () => {
		await expect(DatabaseStore.inTransaction(async () => { throw new Error("async failure"); }))
			.rejects.toThrow("async failure");
		expect(m.transactionEvents.at(-1)).toBe("rollback");
	});

	it("serializes overlapping transactions", async () => {
		let release;
		const held = new Promise((resolve) => { release = resolve; });
		const first = DatabaseStore.inTransaction(async () => { await held; });
		const second = DatabaseStore.inTransaction(() => "second");
		await Promise.resolve();
		expect(m.transactionEvents).toEqual(["begin"]);
		release();
		await Promise.all([first, second]);
		expect(m.transactionEvents).toEqual(["begin", "commit", "begin", "commit"]);
	});

	it("continues the queue after a rollback", async () => {
		const failed = DatabaseStore.inTransaction(() => { throw new Error("nope"); });
		const succeeded = DatabaseStore.inTransaction(() => "recovered");
		await expect(failed).rejects.toThrow("nope");
		await expect(succeeded).resolves.toBe("recovered");
		expect(m.transactionEvents).toEqual(["begin", "rollback", "begin", "commit"]);
	});
});

describe("DatabaseStore notification batching", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		DatabaseStore._triggerPromise = null;
		DatabaseStore._resolve = null;
		DatabaseStore._changeAccumulated = null;
		DatabaseStore._changeAccumulatedLookup = null;
		DatabaseStore._changeFireTimer = null;
		DatabaseStore._triggered = [];
	});

	afterEach(() => {
		vi.runOnlyPendingTimers();
		vi.useRealTimers();
	});

	it("does not notify before the batching window expires", () => {
		DatabaseStore.accumulateAndTrigger(change([{ id: "m1" }]));
		vi.advanceTimersByTime(9);
		expect(DatabaseStore._triggered).toEqual([]);
	});

	it("notifies once after ten milliseconds", () => {
		DatabaseStore.accumulateAndTrigger(change([{ id: "m1" }]));
		vi.advanceTimersByTime(10);
		expect(DatabaseStore._triggered).toHaveLength(1);
	});

	it("wraps the emitted value in a change record", () => {
		DatabaseStore.accumulateAndTrigger(change([{ id: "m1" }]));
		vi.advanceTimersByTime(10);
		expect(DatabaseStore._triggered[0]).toMatchObject({ type: "persist", objects: [{ id: "m1" }] });
	});

	it("returns one promise for compatible accumulated changes", () => {
		const first = DatabaseStore.accumulateAndTrigger(change([{ id: "m1" }]));
		const second = DatabaseStore.accumulateAndTrigger(change([{ id: "m2" }]));
		expect(second).toBe(first);
	});

	it("resolves the batching promise when the notification fires", async () => {
		const pending = DatabaseStore.accumulateAndTrigger(change([{ id: "m1" }]));
		vi.advanceTimersByTime(10);
		await expect(pending).resolves.toBeUndefined();
	});

	it("combines distinct objects from compatible changes", () => {
		DatabaseStore.accumulateAndTrigger(change([{ id: "m1" }]));
		DatabaseStore.accumulateAndTrigger(change([{ id: "m2" }]));
		vi.advanceTimersByTime(10);
		expect(DatabaseStore._triggered[0].objects).toEqual([{ id: "m1" }, { id: "m2" }]);
	});

	it("replaces a repeated object already beyond the first position", () => {
		DatabaseStore.accumulateAndTrigger(change([{ id: "m1", value: 1 }, { id: "m2", value: 1 }]));
		DatabaseStore.accumulateAndTrigger(change([{ id: "m2", value: 2 }]));
		vi.advanceTimersByTime(10);
		expect(DatabaseStore._triggered[0].objects).toEqual([
			{ id: "m1", value: 1 }, { id: "m2", value: 2 },
		]);
	});

	it("flushes the current batch when the type changes", () => {
		DatabaseStore.accumulateAndTrigger(change([{ id: "m1" }]));
		DatabaseStore.accumulateAndTrigger(change([{ id: "m2" }], { type: "unpersist" }));
		expect(DatabaseStore._triggered[0]).toMatchObject({ type: "persist" });
	});

	it("flushes the current batch when the model class changes", () => {
		DatabaseStore.accumulateAndTrigger(change([{ id: "m1" }]));
		DatabaseStore.accumulateAndTrigger(change([{ id: "t1" }], { objectClass: Thread }));
		expect(DatabaseStore._triggered[0].objectClass).toBe(Message);
	});

	it("starts a fresh promise after a timed flush", () => {
		const first = DatabaseStore.accumulateAndTrigger(change([{ id: "m1" }]));
		vi.advanceTimersByTime(10);
		const second = DatabaseStore.accumulateAndTrigger(change([{ id: "m2" }]));
		expect(second).not.toBe(first);
	});

	it("clears accumulated state after a timed flush", () => {
		DatabaseStore.accumulateAndTrigger(change([{ id: "m1" }]));
		vi.advanceTimersByTime(10);
		expect(DatabaseStore._changeAccumulated).toBeNull();
		expect(DatabaseStore._changeAccumulatedLookup).toBeNull();
	});
});
