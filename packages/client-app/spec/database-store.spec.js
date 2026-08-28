import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => {
	const application = {
		databasePhase: vi.fn(() => "setup"),
		setDatabasePhase: vi.fn(),
	};
	return {
		application,
		ipcOn: vi.fn(),
		ipcSend: vi.fn(),
		quit: vi.fn(),
		showMessageBox: vi.fn(),
		queryInstances: [],
		queryResults: [],
		writerInstances: [],
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
vi.mock("node:child_process", () => ({ default: { fork: vi.fn() }, fork: vi.fn() }));
vi.mock("promise-queue", () => ({
	default: class PromiseQueue {
		constructor(maxConcurrent, maxQueued) { this.maxConcurrent = maxConcurrent; this.maxQueued = maxQueued; this.tail = Promise.resolve(); }
		add(fn) { const result = this.tail.then(fn); this.tail = result.catch(() => {}); return result; }
	},
}));
vi.mock("electron", () => {
	const remote = {
		app: { quit: m.quit, getVersion: () => "0", getPath: () => "/tmp" },
		screen: { getPrimaryDisplay: () => ({ workAreaSize: { width: 100, height: 100 } }) },
		dialog: { showMessageBox: m.showMessageBox },
		getCurrentWindow: () => ({}), getGlobal: () => m.application,
	};
	return {
		default: { ipcRenderer: { on: m.ipcOn, send: m.ipcSend }, shell: {}, remote },
		ipcRenderer: { on: m.ipcOn, send: m.ipcSend }, shell: {}, remote,
	};
});
vi.mock("@electron/remote", () => {
	const remote = {
		app: { quit: m.quit, getVersion: () => "0", getPath: () => "/tmp" },
		screen: { getPrimaryDisplay: () => ({ workAreaSize: { width: 100, height: 100 } }) },
		dialog: { showMessageBox: m.showMessageBox },
		getCurrentWindow: () => ({}), getGlobal: () => m.application,
	};
	return {
		default: { remote, ipcRenderer: { on: m.ipcOn, send: m.ipcSend }, shell: {} }, remote,
		ipcRenderer: { on: m.ipcOn, send: m.ipcSend }, shell: {},
		screen: remote.screen, dialog: remote.dialog,
	};
});
vi.mock("lru-cache", () => {
	class LRUCache { constructor() { this.values = new Map(); } get(key) { return this.values.get(key); } set(key, value) { this.values.set(key, value); } del(key) { this.values.delete(key); } }
	return { default: { LRUCache }, LRUCache };
});
vi.mock("isomorphic-core", () => ({
	default: { StringUtils: { trimTo: (value) => value }, ExponentialBackoffScheduler: class {} },
	StringUtils: { trimTo: (value) => value }, ExponentialBackoffScheduler: class {},
}));
vi.mock("../src/global/nylas-store.js", () => ({
	default: class NylasStore {
		setupEmitter() {
			const listeners = new Map();
			this._emitter = {
				setMaxListeners: vi.fn(),
				on: (name, fn) => listeners.set(name, fn),
				removeListener: (name) => listeners.delete(name),
				emit: (name, value) => listeners.get(name)?.(value),
			};
		}
		trigger(value) { this._lastTriggered = value; }
	},
}));
vi.mock("../src/flux/models/utils.js", () => ({ default: { isTempId: (id) => id.startsWith("temp-"), generateTempId: vi.fn(() => "temp-query") } }));
vi.mock("../src/flux/models/query.js", () => ({
	default: class Query {
		constructor(klass, store) { this.klass = klass; this.store = store; this.calls = []; m.queryInstances.push(this); }
		where(value) { this.calls.push(["where", value]); return this; }
		order(value) { this.calls.push(["order", value]); return this; }
		limit(value) { this.calls.push(["limit", value]); return this; }
		one() { this.calls.push(["one"]); return this; }
		count() { this.calls.push(["count"]); return this; }
		markNotBackgroundable() { this.calls.push(["markNotBackgroundable"]); return this; }
		then(resolve, reject) { return Promise.resolve(m.queryResults.shift() ?? []).then(resolve, reject); }
	},
}));
vi.mock("../src/flux/stores/database-change-record.js", () => ({ default: class DatabaseChangeRecord { constructor(change) { Object.assign(this, change); } } }));
vi.mock("../src/flux/stores/database-writer.js", () => ({
	default: class DatabaseWriter {
		constructor(store) { this.store = store; this.executeInTransaction = vi.fn((fn) => fn(this)); this.execute = vi.fn((fn) => fn(this)); m.writerInstances.push(this); }
	},
}));
vi.mock("../src/flux/stores/database-setup-query-builder.js", () => ({ default: class DatabaseSetupQueryBuilder { setupQueries() { return []; } } }));
vi.mock("../src/database-helpers.js", () => ({
	default: {}, openDatabase: vi.fn(), handleUnrecoverableDatabaseError: vi.fn(), databasePath: vi.fn((dir, spec) => `${dir}/${spec ? "spec" : "mail"}.db`),
}));

globalThis.NylasEnv = {
	getConfigDirPath: vi.fn(() => "/config"), inSpecMode: vi.fn(() => true),
	inDevMode: vi.fn(() => false), isWorkWindow: vi.fn(() => true),
};

const { default: DatabaseStore } = await import("../src/flux/stores/database-store.js");

class Message {
	constructor({ id, clientId, serverId } = {}) { Object.assign(this, { id, clientId, serverId }); }
}
Message.attributes = {
	id: { in: vi.fn((values) => ({ field: "id", values })) },
	clientId: { in: vi.fn((values) => ({ field: "clientId", values })) },
};

describe("DatabaseStore query helpers", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		m.queryInstances.length = 0;
		m.queryResults.length = 0;
		m.writerInstances.length = 0;
		DatabaseStore._databaseMutationHooks = [];
		DatabaseStore._transactionQueue = null;
	});

	it("find requires a model class", () => {
		expect(() => DatabaseStore.find(null, "m1")).toThrow("must provide a class");
	});

	it("find requires a string id", () => {
		expect(() => DatabaseStore.find(Message, 1)).toThrow("must provide a string id");
	});

	it("find applies the id predicate and requests one result", () => {
		const query = DatabaseStore.find(Message, "m1");
		expect(query.calls).toEqual([["where", { id: "m1" }], ["one"]]);
	});

	it("findBy requires a model class", () => {
		expect(() => DatabaseStore.findBy(null)).toThrow("must provide a class");
	});

	it("findBy defaults to an empty predicate list", () => {
		const query = DatabaseStore.findBy(Message);
		expect(query.calls).toEqual([["where", []], ["one"]]);
	});

	it("findBy passes predicates through and requests one result", () => {
		const predicates = [{ unread: true }];
		const query = DatabaseStore.findBy(Message, predicates);
		expect(query.calls).toEqual([["where", predicates], ["one"]]);
	});

	it("findAll requires a model class", () => {
		expect(() => DatabaseStore.findAll(null)).toThrow("must provide a class");
	});

	it("findAll returns a query with default predicates", () => {
		const query = DatabaseStore.findAll(Message);
		expect(query.calls).toEqual([["where", []]]);
	});

	it("findAll preserves caller predicates", () => {
		const predicates = [{ starred: true }];
		const query = DatabaseStore.findAll(Message, predicates);
		expect(query.calls).toEqual([["where", predicates]]);
	});

	it("findAll leaves the query available for where, order, and limit chaining", () => {
		const query = DatabaseStore.findAll(Message).where({ unread: true }).order("date DESC").limit(20);
		expect(query.calls).toEqual([["where", []], ["where", { unread: true }], ["order", "date DESC"], ["limit", 20]]);
	});

	it("count requires a model class", () => {
		expect(() => DatabaseStore.count(null)).toThrow("must provide a class");
	});

	it("count applies predicates before requesting a count", () => {
		const predicates = [{ folder: "inbox" }];
		const query = DatabaseStore.count(Message, predicates);
		expect(query.calls).toEqual([["where", predicates], ["count"]]);
	});

	it("run inflates and formats query results", async () => {
		DatabaseStore._query = vi.fn(() => Promise.resolve([{ id: "m1" }]));
		const modelQuery = { sql: () => "SELECT * FROM Message", _background: true, _logQueryPlanDebugOutput: false, inflateResult: vi.fn(() => ["inflated"]), formatResult: vi.fn(() => ["formatted"]) };
		await expect(DatabaseStore.run(modelQuery)).resolves.toEqual(["formatted"]);
		expect(DatabaseStore._query).toHaveBeenCalledWith("SELECT * FROM Message", [], true, false);
	});

	it("run skips formatting when explicitly disabled", async () => {
		DatabaseStore._query = vi.fn(() => Promise.resolve([1]));
		const modelQuery = { sql: () => "SELECT 1", _background: false, inflateResult: vi.fn(() => ["inflated"]), formatResult: vi.fn() };
		await expect(DatabaseStore.run(modelQuery, { format: false })).resolves.toEqual(["inflated"]);
		expect(modelQuery.formatResult).not.toHaveBeenCalled();
	});
});

describe("DatabaseStore modelify", () => {
	beforeEach(() => { vi.clearAllMocks(); m.queryInstances.length = 0; m.queryResults.length = 0; Promise.props = (object) => Promise.all(Object.entries(object).map(async ([key, value]) => [key, await value])).then((entries) => Object.fromEntries(entries)); });

	it("resolves an empty array for a non-array", async () => {
		await expect(DatabaseStore.modelify(Message, null)).resolves.toEqual([]);
	});

	it("resolves an empty array for an empty input", async () => {
		await expect(DatabaseStore.modelify(Message, [])).resolves.toEqual([]);
	});

	it("returns server-backed model instances without querying", async () => {
		const model = new Message({ id: "m1", serverId: "s1" });
		await expect(DatabaseStore.modelify(Message, [model])).resolves.toEqual([model]);
		expect(m.queryInstances).toHaveLength(0);
	});

	it("rejects values that are neither ids nor models", () => {
		expect(() => DatabaseStore.modelify(Message, [42])).toThrow("Not sure how to convert 42");
	});

	it("queries ordinary strings by id", async () => {
		const found = new Message({ id: "m1", serverId: "s1" }); m.queryResults.push([found]);
		await expect(DatabaseStore.modelify(Message, ["m1"])).resolves.toEqual([found]);
		expect(m.queryInstances[0].calls).toEqual([["where", []], ["where", { field: "id", values: ["m1"] }], ["markNotBackgroundable"]]);
	});

	it("queries temporary strings by client id", async () => {
		const found = new Message({ clientId: "temp-1" }); m.queryResults.push([found]);
		await expect(DatabaseStore.modelify(Message, ["temp-1"])).resolves.toEqual([found]);
		expect(m.queryInstances[0].calls[1]).toEqual(["where", { field: "clientId", values: ["temp-1"] }]);
	});

	it("queries unsynced model instances by client id but preserves the instance", async () => {
		const model = new Message({ clientId: "temp-local" }); m.queryResults.push([new Message({ clientId: "temp-local" })]);
		await expect(DatabaseStore.modelify(Message, [model])).resolves.toEqual([model]);
		expect(Message.attributes.clientId.in).toHaveBeenCalledWith(["temp-local"]);
	});

	it("preserves input order across id types", async () => {
		const server = new Message({ id: "m1", serverId: "s1" }); const local = new Message({ clientId: "temp-1" });
		m.queryResults.push([server], [local]);
		await expect(DatabaseStore.modelify(Message, ["temp-1", "m1"])).resolves.toEqual([local, server]);
	});

	it("leaves missing ids as undefined", async () => {
		m.queryResults.push([]);
		await expect(DatabaseStore.modelify(Message, ["missing"])).resolves.toEqual([undefined]);
	});
});

describe("DatabaseStore writes, hooks, and notifications", () => {
	beforeEach(() => {
		vi.useFakeTimers(); vi.clearAllMocks(); m.writerInstances.length = 0;
		DatabaseStore._databaseMutationHooks = []; DatabaseStore._transactionQueue = null;
		DatabaseStore._triggerPromise = null; DatabaseStore._changeAccumulated = null;
		DatabaseStore._changeAccumulatedLookup = null; DatabaseStore._changeFireTimer = null;
	});

	it("inTransaction delegates to a DatabaseWriter", async () => {
		const callback = vi.fn(() => "done");
		await expect(DatabaseStore.inTransaction(callback)).resolves.toBe("done");
		expect(m.writerInstances[0].executeInTransaction).toHaveBeenCalledWith(callback);
	});

	it("write delegates to a non-transactional writer execution", async () => {
		const callback = vi.fn(() => "done"); await DatabaseStore.write(callback);
		expect(m.writerInstances[0].execute).toHaveBeenCalledWith(callback);
	});

	it("addMutationHook requires a before callback", () => {
		expect(() => DatabaseStore.addMutationHook({ afterDatabaseChange: vi.fn() })).toThrow("beforeDatabaseChange");
	});

	it("addMutationHook requires an after callback", () => {
		expect(() => DatabaseStore.addMutationHook({ beforeDatabaseChange: vi.fn() })).toThrow("afterDatabaseChange");
	});

	it("adds and exposes mutation hooks", () => {
		const hook = { beforeDatabaseChange: vi.fn(), afterDatabaseChange: vi.fn() }; DatabaseStore.addMutationHook(hook);
		expect(DatabaseStore.mutationHooks()).toEqual([hook]);
	});

	it("removes only the requested mutation hook", () => {
		DatabaseStore._databaseMutationHooks.length = 0; // singleton: clear prior tests' hooks
		const first = { beforeDatabaseChange: vi.fn(), afterDatabaseChange: vi.fn() }; const second = { beforeDatabaseChange: vi.fn(), afterDatabaseChange: vi.fn() };
		DatabaseStore.addMutationHook(first); DatabaseStore.addMutationHook(second); DatabaseStore.removeMutationHook(DatabaseStore.mutationHooks()[0]);
		expect(DatabaseStore.mutationHooks()).toEqual([expect.objectContaining({ afterDatabaseChange: second.afterDatabaseChange })]);
	});

	it("delays a notification and resolves after it fires", async () => {
		const change = { objectClass: Message, type: "persist", objects: [{ id: "m1" }] }; const pending = DatabaseStore.accumulateAndTrigger(change);
		expect(DatabaseStore._lastTriggered).not.toEqual(expect.objectContaining(change)); vi.advanceTimersByTime(10); await pending;
		expect(DatabaseStore._lastTriggered.objects).toEqual([{ id: "m1" }]);
	});

	it("coalesces compatible notifications into one record", async () => {
		const pending = DatabaseStore.accumulateAndTrigger({ objectClass: Message, type: "persist", objects: [{ id: "m1" }] });
		DatabaseStore.accumulateAndTrigger({ objectClass: Message, type: "persist", objects: [{ id: "m2" }] }); vi.advanceTimersByTime(10); await pending;
		expect(DatabaseStore._lastTriggered.objects.map((item) => item.id)).toEqual(["m1", "m2"]);
	});

	it("flushes immediately when the notification type changes", () => {
		DatabaseStore.accumulateAndTrigger({ objectClass: Message, type: "persist", objects: [{ id: "m1" }] });
		DatabaseStore.accumulateAndTrigger({ objectClass: Message, type: "unpersist", objects: [{ id: "m2" }] });
		expect(DatabaseStore._lastTriggered.type).toBe("persist");
	});

	it("returns the same pending promise while changes accumulate", () => {
		const first = DatabaseStore.accumulateAndTrigger({ objectClass: Message, type: "persist", objects: [{ id: "m1" }] });
		const second = DatabaseStore.accumulateAndTrigger({ objectClass: Message, type: "persist", objects: [{ id: "m2" }] });
		expect(second).toBe(first);
	});
});
