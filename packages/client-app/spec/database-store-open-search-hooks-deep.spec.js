import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => {
	const application = {
		databasePhase: vi.fn(() => "setup"),
		setDatabasePhase: vi.fn(),
	};
	return {
		application,
		ipcOn: vi.fn(),
		openDatabase: vi.fn(),
		handleUnrecoverableDatabaseError: vi.fn(),
		setupQueries: vi.fn(() => []),
		queryInstances: [],
	};
});

vi.mock("node:module", () => {
	const createRequire = () => vi.fn(() => () => ({}));
	return { default: { createRequire }, createRequire };
});
vi.mock("node:path", () => {
	const path = { join: (...parts) => parts.join("/"), dirname: (value) => value.split("/").slice(0, -1).join("/") };
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
		add(fn) { const result = this.tail.then(fn); this.tail = result.catch(() => {}); return result; }
	},
}));
vi.mock("electron", () => {
	const ipcRenderer = { on: m.ipcOn, send: vi.fn() };
	const remote = {
		app: { quit: vi.fn(), getVersion: vi.fn(() => "0"), getPath: vi.fn(() => "/tmp") },
		screen: { getPrimaryDisplay: vi.fn(() => ({ workAreaSize: { width: 100, height: 100 } })) },
		dialog: { showMessageBox: vi.fn() },
		getCurrentWindow: vi.fn(() => ({})),
		getGlobal: vi.fn(() => m.application),
	};
	return { default: { ipcRenderer, remote }, ipcRenderer, remote };
});
vi.mock("@electron/remote", () => {
	const ipcRenderer = { on: m.ipcOn, send: vi.fn() };
	const remote = {
		app: { quit: vi.fn(), getVersion: vi.fn(() => "0"), getPath: vi.fn(() => "/tmp") },
		screen: { getPrimaryDisplay: vi.fn(() => ({ workAreaSize: { width: 100, height: 100 } })) },
		dialog: { showMessageBox: vi.fn() },
		getCurrentWindow: vi.fn(() => ({})),
		getGlobal: vi.fn(() => m.application),
	};
	return {
		default: { remote, ipcRenderer }, remote, ipcRenderer,
		app: remote.app, screen: remote.screen, dialog: remote.dialog,
		getCurrentWindow: remote.getCurrentWindow, getGlobal: remote.getGlobal,
	};
});
vi.mock("lru-cache", () => {
	class LRUCache {
		constructor() { this.values = new Map(); }
		get(key) { return this.values.get(key); }
		set(key, value) { this.values.set(key, value); }
		del(key) { this.values.delete(key); }
	}
	return { default: { LRUCache }, LRUCache };
});
vi.mock("isomorphic-core", () => {
	const core = { StringUtils: { trimTo: (value) => value }, ExponentialBackoffScheduler: class ExponentialBackoffScheduler {} };
	return { default: core, ...core };
});
vi.mock("../src/global/nylas-store.js", () => ({
	default: class NylasStore {
		setupEmitter() {
			const listeners = new Map();
			this._emitter = {
				setMaxListeners: vi.fn(),
				on: vi.fn((name, fn) => listeners.set(name, fn)),
				removeListener: vi.fn((name) => listeners.delete(name)),
				emit: vi.fn((name, value) => listeners.get(name)?.(value)),
			};
		}
		trigger(value) { (this._triggered ||= []).push(value); }
	},
}));
vi.mock("../src/flux/models/utils.js", () => ({
	default: { isTempId: (id) => id.startsWith("temp-"), generateTempId: vi.fn(() => "temp-id") },
}));
vi.mock("../src/flux/models/query.js", () => ({
	default: class Query {
		constructor(klass, store) { this.klass = klass; this.store = store; this.calls = []; m.queryInstances.push(this); }
		where(value) { this.calls.push(["where", value]); return this; }
		one() { this.calls.push(["one"]); return this; }
		count() { this.calls.push(["count"]); return this; }
	},
}));
vi.mock("../src/flux/stores/database-change-record.js", () => ({
	default: class DatabaseChangeRecord { constructor(change) { Object.assign(this, change); } },
}));
vi.mock("../src/flux/stores/database-writer.js", () => ({
	default: class DatabaseWriter { executeInTransaction(fn) { return fn(this); } execute(fn) { return fn(this); } },
}));
vi.mock("../src/flux/stores/database-setup-query-builder.js", () => ({
	default: class DatabaseSetupQueryBuilder { setupQueries() { return m.setupQueries(); } },
}));
vi.mock("../src/database-helpers.js", () => ({
	default: {},
	openDatabase: m.openDatabase,
	handleUnrecoverableDatabaseError: m.handleUnrecoverableDatabaseError,
	databasePath: vi.fn((dir) => `${dir}/mail.db`),
}));

globalThis.NylasEnv = {
	getConfigDirPath: vi.fn(() => "/config"),
	inSpecMode: vi.fn(() => true),
	inDevMode: vi.fn(() => false),
	isWorkWindow: vi.fn(() => true),
};

const { default: singleton } = await import("../src/flux/stores/database-store.js");
const DatabaseStore = singleton.constructor;

const makeDb = (version = "23") => ({
	pragma: vi.fn((query) => query === "user_version" ? version : undefined),
	prepare: vi.fn(() => ({ run: vi.fn() })),
	close: vi.fn(),
});

const makeStore = () => {
	const store = new DatabaseStore();
	store._triggered = [];
	return store;
};

describe("DatabaseStore open and schema phases", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		m.setupQueries.mockReturnValue([]);
		m.application.databasePhase.mockReturnValue("setup");
		NylasEnv.inSpecMode.mockReturnValue(true);
		NylasEnv.isWorkWindow.mockReturnValue(true);
	});

	it("registers for database phase changes", () => {
		makeStore();
		expect(m.ipcOn).toHaveBeenCalledWith("database-phase-change", expect.any(Function));
	});

	it("emits ready immediately in spec mode", async () => {
		const store = makeStore();
		await store._onPhaseChange();
		expect(store._emitter.emit).toHaveBeenCalledWith("ready");
	});

	it("opens the database only once", async () => {
		const db = makeDb();
		m.openDatabase.mockResolvedValue(db);
		const store = makeStore();
		await store._openDatabase();
		await store._openDatabase();
		expect(m.openDatabase).toHaveBeenCalledTimes(1);
	});

	it("opens the configured database path", async () => {
		m.openDatabase.mockResolvedValue(makeDb());
		const store = makeStore();
		await store._openDatabase();
		expect(m.openDatabase).toHaveBeenCalledWith("/config/mail.db");
	});

	it("runs setup and advances the application to ready", async () => {
		NylasEnv.inSpecMode.mockReturnValue(false);
		const db = makeDb("0");
		m.openDatabase.mockResolvedValue(db);
		const store = makeStore();
		await store._onPhaseChange();
		expect(m.application.setDatabasePhase).toHaveBeenCalledWith("ready");
	});

	it("does not run setup in a non-work window", async () => {
		NylasEnv.inSpecMode.mockReturnValue(false);
		NylasEnv.isWorkWindow.mockReturnValue(false);
		const store = makeStore();
		await store._onPhaseChange();
		expect(m.openDatabase).not.toHaveBeenCalled();
	});

	it("opens queued work when the phase becomes ready", async () => {
		NylasEnv.inSpecMode.mockReturnValue(false);
		m.application.databasePhase.mockReturnValue("ready");
		m.openDatabase.mockResolvedValue(makeDb());
		const store = makeStore();
		const waiting = vi.fn();
		store._waiting = [waiting];
		await store._onPhaseChange();
		expect(waiting).toHaveBeenCalledOnce();
	});

	it("marks the store open and clears its ready queue", async () => {
		NylasEnv.inSpecMode.mockReturnValue(false);
		m.application.databasePhase.mockReturnValue("ready");
		m.openDatabase.mockResolvedValue(makeDb());
		const store = makeStore();
		store._waiting = [vi.fn()];
		await store._onPhaseChange();
		expect(store).toMatchObject({ _open: true, _waiting: [] });
	});

	it("optimizes and closes an open database", async () => {
		NylasEnv.inSpecMode.mockReturnValue(false);
		m.application.databasePhase.mockReturnValue("close");
		const store = makeStore();
		const db = makeDb();
		store._db = db;
		await store._onPhaseChange();
		expect(db.pragma).toHaveBeenCalledWith("optimize");
		expect(db.close).toHaveBeenCalledOnce();
	});

	it("handles close without an allocated database", async () => {
		NylasEnv.inSpecMode.mockReturnValue(false);
		m.application.databasePhase.mockReturnValue("close");
		const store = makeStore();
		await expect(store._onPhaseChange()).resolves.toBeUndefined();
		expect(store._open).toBe(false);
	});

	it("skips schema refresh outside a work window", async () => {
		NylasEnv.isWorkWindow.mockReturnValue(false);
		const store = makeStore();
		await expect(store.refreshDatabaseSchema()).resolves.toBeUndefined();
		expect(m.application.databasePhase).not.toHaveBeenCalled();
	});

	it("moves a ready application back to setup for refresh", () => {
		m.application.databasePhase.mockReturnValue("ready");
		const store = makeStore();
		store._asyncWaitForReady = vi.fn(() => Promise.resolve());
		store.refreshDatabaseSchema();
		expect(m.application.setDatabasePhase).toHaveBeenCalledWith("setup");
	});

	it("does not redundantly set an application already in setup", () => {
		const store = makeStore();
		store._asyncWaitForReady = vi.fn(() => Promise.resolve());
		store.refreshDatabaseSchema();
		expect(m.application.setDatabasePhase).not.toHaveBeenCalled();
	});

	it("accepts the current schema version", () => {
		const store = makeStore();
		store._db = makeDb("23");
		const ready = vi.fn();
		store._checkDatabaseVersion({}, ready);
		expect(ready).toHaveBeenCalledOnce();
	});

	it("accepts an unset version during setup", () => {
		const store = makeStore();
		store._db = makeDb("0");
		const ready = vi.fn();
		store._checkDatabaseVersion({ allowUnset: true }, ready);
		expect(ready).toHaveBeenCalledOnce();
	});

	it("reports an unexpected schema version", () => {
		const store = makeStore();
		store._db = makeDb("22");
		store._checkDatabaseVersion({}, vi.fn());
		expect(m.handleUnrecoverableDatabaseError).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining("22 not 23") }));
	});

	it("executes every setup query before setting the version", () => {
		const first = { run: vi.fn() };
		const second = { run: vi.fn() };
		const store = makeStore();
		store._db = makeDb();
		store._db.prepare.mockReturnValueOnce(first).mockReturnValueOnce(second);
		m.setupQueries.mockReturnValue(["CREATE A", "CREATE B"]);
		store._runDatabaseSetup(vi.fn());
		expect(store._db.prepare.mock.calls.map(([sql]) => sql)).toEqual(["CREATE A", "CREATE B"]);
		expect(first.run).toHaveBeenCalledOnce();
		expect(second.run).toHaveBeenCalledOnce();
	});

	it("reports a setup query failure without marking the version", () => {
		const failure = new Error("bad migration");
		const store = makeStore();
		store._db = makeDb();
		store._db.prepare.mockImplementation(() => { throw failure; });
		m.setupQueries.mockReturnValue(["BROKEN"]);
		store._runDatabaseSetup(vi.fn());
		expect(m.handleUnrecoverableDatabaseError).toHaveBeenCalledWith(failure);
		expect(store._db.pragma).not.toHaveBeenCalledWith("user_version=23");
	});
});

describe("DatabaseStore count and search-index branches", () => {
	beforeEach(() => { vi.clearAllMocks(); m.queryInstances.length = 0; });

	it("counts with the default empty predicate list", () => {
		class Message {}
		expect(makeStore().count(Message).calls).toEqual([["where", []], ["count"]]);
	});

	it("counts after applying caller predicates", () => {
		class Message {}
		const predicates = [{ accountId: "a1" }];
		expect(makeStore().count(Message, predicates).calls[0][1]).toBe(predicates);
	});

	it("creates a search index through the query runner", async () => {
		class Message {}
		Message.searchFields = ["subject", "body"];
		const store = makeStore();
		store._query = vi.fn(() => Promise.resolve("created"));
		await expect(store.createSearchIndex(Message)).resolves.toBe("created");
		expect(store._query).toHaveBeenCalledWith(expect.stringContaining("MessageSearch"));
	});

	it("rejects dropping an index without a model class", () => {
		expect(() => makeStore().dropSearchIndex()).toThrow("must provide a class");
	});

	it("drops the search table before clearing model flags", async () => {
		class Message {}
		const store = makeStore();
		store._query = vi.fn(() => Promise.resolve());
		await store.dropSearchIndex(Message);
		expect(store._query.mock.calls.map(([sql]) => sql)).toEqual([
			"DROP TABLE IF EXISTS `MessageSearch`",
			"UPDATE `Message` SET `is_search_indexed` = 0 WHERE `is_search_indexed` = 1",
		]);
	});
});

describe("DatabaseStore hook accumulation edge cases", () => {
	beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); });
	afterEach(() => { vi.runOnlyPendingTimers(); vi.useRealTimers(); });

	it("keeps the caller hook object out of its internal array", () => {
		const store = makeStore();
		const hook = { beforeDatabaseChange: vi.fn(), afterDatabaseChange: vi.fn() };
		store.addMutationHook(hook);
		expect(store.mutationHooks()[0]).not.toBe(hook);
	});

	it("retains duplicate hook registrations", () => {
		const store = makeStore();
		const hook = { beforeDatabaseChange: vi.fn(), afterDatabaseChange: vi.fn() };
		store.addMutationHook(hook);
		store.addMutationHook(hook);
		expect(store.mutationHooks()).toHaveLength(2);
	});

	it("does not remove a caller object after registration", () => {
		const store = makeStore();
		const hook = { beforeDatabaseChange: vi.fn(), afterDatabaseChange: vi.fn() };
		store.addMutationHook(hook);
		store.removeMutationHook(hook);
		expect(store.mutationHooks()).toHaveLength(1);
	});

	it("removes every occurrence of the same stored hook reference", () => {
		const store = makeStore();
		const stored = { beforeDatabaseChange: vi.fn(), afterDatabaseChange: vi.fn() };
		store._databaseMutationHooks = [stored, stored];
		store.removeMutationHook(stored);
		expect(store.mutationHooks()).toEqual([]);
	});

	it("appends a repeated id when the existing object is at index zero", () => {
		class Message {}
		const store = makeStore();
		store.accumulateAndTrigger({ objectClass: Message, type: "persist", objects: [{ id: "m1", value: 1 }] });
		store.accumulateAndTrigger({ objectClass: Message, type: "persist", objects: [{ id: "m1", value: 2 }] });
		vi.advanceTimersByTime(10);
		expect(store._triggered[0].objects).toEqual([{ id: "m1", value: 1 }, { id: "m1", value: 2 }]);
	});

	it("accumulates objects with missing ids under the same lookup key", () => {
		class Message {}
		const store = makeStore();
		store.accumulateAndTrigger({ objectClass: Message, type: "persist", objects: [{ value: 1 }] });
		store.accumulateAndTrigger({ objectClass: Message, type: "persist", objects: [{ value: 2 }] });
		vi.advanceTimersByTime(10);
		expect(store._triggered[0].objects).toEqual([{ value: 1 }, { value: 2 }]);
	});
});
