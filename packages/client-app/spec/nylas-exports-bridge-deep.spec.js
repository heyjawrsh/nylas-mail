import { describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => {
	const makeRegistry = () => ({ register: vi.fn(), get: vi.fn() });
	const remote = {
		app: { getPath: vi.fn(() => "/tmp"), quit: vi.fn(), relaunch: vi.fn() },
		getCurrentWindow: vi.fn(),
		getGlobal: vi.fn(),
	};
	const electron = { ipcRenderer: { on: vi.fn(), send: vi.fn() }, remote };
	return {
		databaseObjectRegistry: makeRegistry(),
		electron,
		remote,
		storeRegistry: makeRegistry(),
		taskRegistry: makeRegistry(),
	};
});

vi.mock("electron", () => ({ default: m.electron, ...m.electron }));
vi.mock("@electron/remote", () => ({ default: m.remote, ...m.remote, remote: m.remote }));
vi.mock("../src/registries/task-registry.js", () => ({ default: m.taskRegistry }));
vi.mock("../src/registries/store-registry.js", () => ({ default: m.storeRegistry }));
vi.mock("../src/registries/database-object-registry.js", () => ({ default: m.databaseObjectRegistry }));

globalThis.NylasEnv = {
	isWorkWindow: vi.fn(() => true),
	inSpecMode: vi.fn(() => true),
	inDevMode: vi.fn(() => false),
	reportError: vi.fn(),
	config: { get: vi.fn(() => null), onDidChange: vi.fn(() => ({ dispose: vi.fn() })) },
	getConfigDirPath: vi.fn(() => "/tmp"),
	getPath: vi.fn(() => "/tmp"),
	getResourcePath: vi.fn(() => "/tmp"),
	getVersion: vi.fn(() => "0.0.0"),
};

const exportsStub = await import("./stubs/nylas-exports.js");
const bridge = exportsStub.default;

describe("nylas-exports bridge surfaces", () => {
	it("publishes the bridge as $n", () => {
		expect(globalThis.$n).toBe(bridge);
	});

	it("publishes the source require helper", () => {
		expect(globalThis.$nylasRequireSrc).toEqual(expect.any(Function));
	});


	it("exposes the database object registry directly", () => {
		expect(bridge.DatabaseObjectRegistry).toBe(m.databaseObjectRegistry);
	});

	it("exposes the task registry directly", () => {
		expect(bridge.TaskRegistry).toBe(m.taskRegistry);
	});
});

describe("nylas-exports lazy models", () => {
	it("resolves Model", () => {
		expect(bridge.Model).toBeDefined();
	});

	it("resolves Account", () => {
		expect(bridge.Account).toBeDefined();
	});

	it("resolves Message", () => {
		expect(bridge.Message).toBeDefined();
	});

	it("resolves Thread", () => {
		expect(bridge.Thread).toBeDefined();
	});

	it("resolves Contact", () => {
		expect(bridge.Contact).toBeDefined();
	});

	it("resolves Category", () => {
		expect(bridge.Category).toBeDefined();
	});

	it("resolves Event", () => {
		expect(bridge.Event).toBeDefined();
	});
});

describe("nylas-exports lazy tasks", () => {
	it("resolves Task", () => {
		expect(bridge.Task).toBeDefined();
	});


	it("resolves BaseDraftTask", () => {
		expect(bridge.BaseDraftTask).toBeDefined();
	});


	it("resolves DestroyModelTask", () => {
		expect(bridge.DestroyModelTask).toBeDefined();
	});

	it("resolves SyncbackEventTask", () => {
		expect(bridge.SyncbackEventTask).toBeDefined();
	});

	it("resolves SyncbackCategoryTask", () => {
		expect(bridge.SyncbackCategoryTask).toBeDefined();
	});
});

describe("nylas-exports lazy stores", () => {
	it("resolves AccountStore", () => {
		expect(bridge.AccountStore).toBeDefined();
	});


	it("resolves ContactStore", () => {
		expect(bridge.ContactStore).toBeDefined();
	});

	it("resolves CategoryStore", () => {
		expect(bridge.CategoryStore).toBeDefined();
	});



});

describe("nylas-exports lazy utilities", () => {
	it("resolves Utils", () => {
		expect(bridge.Utils).toBeDefined();
	});

	it("resolves DOMUtils", () => {
		expect(bridge.DOMUtils).toBeDefined();
	});

	it("resolves DateUtils", () => {
		expect(bridge.DateUtils).toBeDefined();
	});

	it("resolves RegExpUtils", () => {
		expect(bridge.RegExpUtils).toBeDefined();
	});

	it("resolves VirtualDOMUtils", () => {
		expect(bridge.VirtualDOMUtils).toBeDefined();
	});

	it("resolves DraftHelpers", () => {
		expect(bridge.DraftHelpers).toBeDefined();
	});

	it("resolves SearchQueryParser", () => {
		expect(bridge.SearchQueryParser).toBeDefined();
	});

	it("dereferences a named lazy proxy through the bridge", () => {
		expect(exportsStub.Model.prototype).toBe(bridge.Model.prototype);
	});
});
