import { beforeEach, describe, expect, it, vi } from "vitest";

// Selection note: task-queue.js is larger, but is top-level CommonJS and is
// intentionally not imported or tested here.
const mocks = vi.hoisted(() => {
	globalThis.NylasEnv = {
		getConfigDirPath: () => "/tmp/nylas-spec",
		inSpecMode: () => true,
		isWorkWindow: () => true,
	};
	return { ipcOn: vi.fn(), databasePath: vi.fn(() => "/tmp/mail.db") };
});

vi.mock("../src/global/nylas-store.js", () => ({
	default: class NylasStore {
		constructor() {
			this._emitter = { setMaxListeners: vi.fn(), emit: vi.fn(), on: vi.fn(), removeListener: vi.fn() };
		}
		// Publisher mixin surface (coffee-helpers include provides these on
		// the real NylasStore).
		setupEmitter() {}
		listen() { return () => {}; }
		trigger() {}
	},
}));
vi.mock("../src/flux/models/utils.js", () => ({ default: { isTempId: (id) => id.startsWith("temp-") } }));
vi.mock("../src/flux/models/query.js", () => ({
	default: class Query {
		constructor(klass) { this.klass = klass; }
		where(value) { this.predicates = value; return this; }
		one() { this.isOne = true; return this; }
		count() { this.isCount = true; return this; }
	},
}));
vi.mock("../src/flux/stores/database-change-record.js", () => ({ default: class DatabaseChangeRecord {} }));
vi.mock("../src/flux/stores/database-writer.js", () => ({ default: class DatabaseWriter {} }));
vi.mock("../src/flux/stores/database-setup-query-builder.js", () => ({ default: class DatabaseSetupQueryBuilder {} }));
vi.mock("../src/database-helpers.js", () => ({
	databasePath: mocks.databasePath,
	openDatabase: vi.fn(),
	handleUnrecoverableDatabaseError: vi.fn(),
}));
vi.mock("electron", () => ({ ipcRenderer: { on: mocks.ipcOn } }));
vi.mock("@electron/remote", () => ({
	default: { getGlobal: vi.fn(() => ({})), getCurrentWebContents: vi.fn(() => ({ getId: () => -1 })) },
	remote: { getGlobal: vi.fn(() => ({})), getCurrentWebContents: vi.fn(() => ({ getId: () => -1 })) },
	ipcRenderer: { on: vi.fn(), send: vi.fn() },
}));

import databaseStore from "../src/flux/stores/database-store.js";

describe("DatabaseStore", () => {
	let store;

	beforeEach(() => {
		vi.clearAllMocks();
		store = new databaseStore.constructor();
		vi.spyOn(store, "trigger").mockImplementation(() => {});
	});

	it("builds a one-result query for a string id", () => {
		class Message {}
		const query = store.find(Message, "m1");
		expect(query.predicates).toEqual({ id: "m1" });
		expect(query.isOne).toBe(true);
	});

	it("rejects a non-string id", () => {
		expect(() => store.find(class Message {}, 4)).toThrow("provide a string id");
	});

	it("builds all-results and count queries", () => {
		class Message {}
		expect(store.findAll(Message, [{ unread: true }]).predicates).toEqual([{ unread: true }]);
		expect(store.count(Message).isCount).toBe(true);
	});

	it("validates query model classes", () => {
		expect(() => store.findBy(null)).toThrow("provide a class");
		expect(() => store.findAll(null)).toThrow("provide a class");
		expect(() => store.count(null)).toThrow("provide a class");
	});

	it("adds and removes complete mutation hooks", () => {
		const hook = { beforeDatabaseChange: vi.fn(), afterDatabaseChange: vi.fn() };
		store.addMutationHook(hook);
		expect(store.mutationHooks()).toEqual([hook]);
		store.removeMutationHook(store.mutationHooks()[0]);
		expect(store.mutationHooks()).toEqual([]);
	});

	it("rejects incomplete mutation hooks", () => {
		expect(() => store.addMutationHook({ afterDatabaseChange: vi.fn() })).toThrow("beforeDatabaseChange");
		expect(() => store.addMutationHook({ beforeDatabaseChange: vi.fn() })).toThrow("afterDatabaseChange");
	});

	it("creates FTS SQL from model search fields", () => {
		class Message {}
		Message.searchFields = ["subject", "body"];
		const sql = store.createSearchIndexSql(Message);
		expect(sql).toContain("`MessageSearch`");
		expect(sql).toContain("subject, body");
	});

	it("requires search fields before creating FTS SQL", () => {
		expect(() => store.createSearchIndexSql(class Message {})).toThrow("searchFields");
	});
});
