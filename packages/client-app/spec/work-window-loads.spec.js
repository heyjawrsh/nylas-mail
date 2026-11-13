import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

// Story 13.11: the work window loads client-sync, worker-ui gets the Rx that
// carries fromQuery, and the database agent forks from its real path.
const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nodeRequire = createRequire(import.meta.url);

const mocks = vi.hoisted(() => {
	globalThis.NylasEnv = {
		...globalThis.NylasEnv,
		getConfigDirPath: () => "/tmp/nylas-spec",
		inSpecMode: () => true,
		isWorkWindow: () => true,
	};
	const agent = {
		stdout: { on: vi.fn() },
		stderr: { on: vi.fn() },
		on: vi.fn(),
		send: vi.fn(),
	};
	return { agent, fork: vi.fn(() => agent) };
});

vi.mock("node:child_process", () => ({
	default: { fork: mocks.fork },
	fork: mocks.fork,
}));
vi.mock("../src/database-helpers.js", () => ({
	databasePath: vi.fn(() => "/tmp/mail.db"),
	openDatabase: vi.fn(),
	handleUnrecoverableDatabaseError: vi.fn(),
}));
vi.mock("electron", () => ({ ipcRenderer: { on: vi.fn(), send: vi.fn() } }));
vi.mock("@electron/remote", () => ({
	default: { getGlobal: vi.fn(() => ({})), getCurrentWebContents: vi.fn(() => ({ getId: () => -1 })) },
	getGlobal: vi.fn(() => ({})),
	getCurrentWebContents: vi.fn(() => ({ getId: () => -1 })),
}));

describe("client-sync manifest", () => {
	it("passes the package loader's checks for the work window", async () => {
		globalThis.NylasEnv.packages = { devMode: true, resourcePath: "/not-the-app" };
		const { default: Package } = await import("../src/package.js");
		const metadata = Package.loadMetadata(
			path.join(packageRoot, "internal_packages", "client-sync"),
		);
		// the two checks getAvailablePackagePaths("work") makes
		expect(metadata.engines?.nylas).toBeTruthy();
		expect(metadata.windowTypes?.work).not.toBeUndefined();
		expect(metadata.main).toBe("./main.js");
	});
});

describe("nylas-exports Rx", () => {
	it("is rx-lite with the nylas-observables helpers", async () => {
		const { default: $n } = await import("../src/global/nylas-exports.js");
		const Rx = $n.Rx;
		expect(Rx).toBe(nodeRequire("rx-lite"));
		for (const helper of [
			"fromQuery",
			"fromNamedQuerySubscription",
			"fromStore",
			"fromListSelection",
			"fromConfig",
			"fromAction",
		]) {
			expect(typeof Rx.Observable[helper], helper).toBe("function");
		}
		// rx-lite APIs the existing consumers use
		expect(typeof Rx.Disposable.create).toBe("function");
		expect(typeof Rx.Observable.combineLatest).toBe("function");
		expect(typeof Rx.Observable.fromPromise).toBe("function");
	});
});

describe("database agent fork", () => {
	it("resolves to the agent source under a resource path", async () => {
		const { databaseAgentPath } = await import("../src/flux/stores/database-store.js");
		const agentPath = databaseAgentPath(packageRoot);
		expect(agentPath).toBe(path.join(packageRoot, "src/flux/stores/database-agent.js"));
		expect(fs.existsSync(agentPath)).toBe(true);
	});

	it("forks the agent from the window's resource path", async () => {
		globalThis.NylasEnv.getLoadSettings = () => ({ resourcePath: packageRoot });
		const { default: store } = await import("../src/flux/stores/database-store.js");
		store._agent = null;
		store._executeInBackground("SELECT 1", []);
		expect(mocks.fork).toHaveBeenCalledTimes(1);
		const [agentPath] = mocks.fork.mock.calls[0];
		expect(agentPath).toBe(path.join(packageRoot, "src/flux/stores/database-agent.js"));
		expect(fs.existsSync(agentPath)).toBe(true);
		expect(mocks.agent.send).toHaveBeenCalledWith(
			expect.objectContaining({ query: "SELECT 1", values: [] }),
		);
	});
});
