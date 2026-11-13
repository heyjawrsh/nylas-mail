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
	// a fake agent per fork; emit() fires the handlers the store registered
	const agents = [];
	const makeAgent = () => {
		const handlers = {};
		const agent = {
			stdout: { on: vi.fn() },
			stderr: { on: vi.fn() },
			on: vi.fn((event, fn) => {
				handlers[event] = fn;
			}),
			emit: (event, ...args) => handlers[event]?.(...args),
			send: vi.fn(),
			kill: vi.fn(),
		};
		agents.push(agent);
		return agent;
	};
	return { agents, fork: vi.fn(makeAgent) };
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
	it("is one of the work window's packages, with no INVALID PACKAGE", async () => {
		// read manifests from disk, not the bundled-package cache
		globalThis.NylasEnv.packages = { devMode: true, resourcePath: "/not-the-app" };
		globalThis.NylasEnv.fileListCache = () => ({});
		const errors = vi.spyOn(console, "error").mockImplementation(() => {});
		const { default: PackageManager } = await import("../src/package-manager.js");
		const manager = new PackageManager({
			configDirPath: "/tmp/nylas-spec",
			devMode: false,
			safeMode: true,
			resourcePath: packageRoot,
			specMode: false,
		});
		const clientSync = path.join(packageRoot, "internal_packages", "client-sync");

		const workPaths = manager.getAvailablePackagePaths("work");

		expect(workPaths).toContain(clientSync);
		// the filter applied: a main-window-only package is left out
		expect(workPaths).not.toContain(
			path.join(packageRoot, "internal_packages", "account-sidebar"),
		);
		expect(
			errors.mock.calls.filter(([msg]) => String(msg).includes(clientSync)),
		).toEqual([]);
		errors.mockRestore();
	});
});

describe("client-sync imports", () => {
	// names the app hands out at runtime (register-bundled-modules, electron)
	const APP_PROVIDED = new Set([
		"electron",
		"@electron/remote",
		"nylas-exports",
		"nylas-component-kit",
		"nylas-store",
		"nylas-observables",
		"react",
		"react-dom",
		"react/jsx-runtime",
	]);
	const BARE = /(?:\bfrom\s+|\brequire\(\s*|\bimport\s+)["']([^"'./][^"']*)["']/g;

	const sourceFiles = (dir) =>
		fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
			const full = path.join(dir, entry.name);
			if (entry.isDirectory()) return sourceFiles(full);
			return /\.jsx?$/.test(entry.name) ? [full] : [];
		});

	it("resolves every bare import from the package itself", () => {
		const clientSync = fs.realpathSync(
			path.join(packageRoot, "internal_packages", "client-sync"),
		);
		const files = [
			path.join(clientSync, "main.js"),
			...sourceFiles(path.join(clientSync, "src")),
		];
		const specifiers = new Set();
		for (const file of files) {
			for (const [, name] of fs.readFileSync(file, "utf8").matchAll(BARE)) {
				if (!name.startsWith("node:") && !APP_PROVIDED.has(name)) {
					specifiers.add(name);
				}
			}
		}
		const fromClientSync = createRequire(path.join(clientSync, "src", "index.js"));
		const missing = [...specifiers].filter((name) => {
			try {
				fromClientSync.resolve(name);
				return false;
			} catch {
				return true;
			}
		});
		expect(specifiers).toContain("isomorphic-core/src/database-extensions.js");
		expect(missing).toEqual([]);
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
		expect(mocks.agents.at(-1).send).toHaveBeenCalledWith(
			expect.objectContaining({ query: "SELECT 1", values: [] }),
		);
	});
});

describe("background queries the agent can't answer", () => {
	const freshStore = async () => {
		globalThis.NylasEnv.getLoadSettings = () => ({ resourcePath: packageRoot });
		const { default: store } = await import("../src/flux/stores/database-store.js");
		store._agent = null;
		vi.spyOn(store, "_executeLocally").mockImplementation(async (query) => [
			{ local: query },
		]);
		return store;
	};
	const sentId = (agent, n = 0) => agent.send.mock.calls[n][0].id;

	it("run locally when the agent replies with an error", async () => {
		const store = await freshStore();
		const pending = store._executeInBackground("SELECT 2", [1]);
		const agent = mocks.agents.at(-1);

		agent.emit("message", { type: "error", id: sentId(agent), error: "SQLITE_BUSY" });

		await expect(pending).resolves.toEqual({
			results: [{ local: "SELECT 2" }],
			backgroundTime: 0,
		});
		expect(store._executeLocally).toHaveBeenCalledWith("SELECT 2", [1]);
	});

	it("all settle locally when the agent dies mid-query", async () => {
		const store = await freshStore();
		const first = store._executeInBackground("SELECT 3", []);
		const second = store._executeInBackground("SELECT 4", []);
		const agent = mocks.agents.at(-1);
		expect(agent.send).toHaveBeenCalledTimes(2);

		agent.emit("close", 1);

		await expect(first).resolves.toMatchObject({ results: [{ local: "SELECT 3" }] });
		await expect(second).resolves.toMatchObject({ results: [{ local: "SELECT 4" }] });
		expect(store._agent).toBeNull();
	});

	it("reach the caller as a rejection if the local run fails too", async () => {
		const store = await freshStore();
		store._executeLocally.mockRejectedValueOnce(new Error("malformed"));
		const pending = store._executeInBackground("SELECT 5", []);

		mocks.agents.at(-1).emit("error", new Error("spawn failed"));

		await expect(pending).rejects.toThrow("malformed");
	});
});

describe("database agent process", () => {
	it("replies with an error instead of dying when a query throws", async () => {
		const { fork } = await vi.importActual("node:child_process");
		const agent = fork(path.join(packageRoot, "src/flux/stores/database-agent.js"), [], {
			// better-sqlite3 is built for Electron; the stub stands in under node
			execArgv: ["--require", path.join(packageRoot, "spec/fixtures/stub-better-sqlite3.cjs")],
			silent: true,
		});
		const replies = [];
		const replied = (n) =>
			new Promise((resolve) => {
				agent.on("message", (m) => {
					replies.push(m);
					if (replies.length === n) resolve(replies);
				});
			});
		const done = replied(2);
		agent.send({ query: "SELECT bad", values: [], id: "q1", dbpath: "/tmp/x.db" });
		agent.send({ query: "SELECT 1", values: [], id: "q2", dbpath: "/tmp/x.db" });
		await done;
		agent.kill();

		expect(replies[0]).toMatchObject({ type: "error", id: "q1" });
		expect(replies[0].error).toContain("bad");
		expect(replies[1]).toMatchObject({ type: "results", id: "q2", results: [{ ok: 1 }] });
	});
});
