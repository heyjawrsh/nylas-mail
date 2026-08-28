import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => {
	const ipcRenderer = { send: vi.fn(), on: vi.fn() };
	const app = { relaunch: vi.fn(), quit: vi.fn() };
	const remote = { app };
	const actions = {
		logoutNylasIdentity: { name: "logout" },
		willMakeAPIRequest: vi.fn(),
		didMakeAPIRequest: vi.fn(),
	};
	const utils = {
		deepClone: vi.fn((value) => structuredClone(value)),
		generateTempId: vi.fn(() => "request-1"),
		isTempId: vi.fn(() => false),
	};
	return {
		ipcRenderer, app, remote, actions, utils,
		request: vi.fn(), fromQuery: vi.fn(), subscribe: vi.fn(), dispose: vi.fn(),
		listenTo: vi.fn(), stopListeningToAll: vi.fn(), trigger: vi.fn(),
		findJSONBlob: vi.fn((key) => ({ key })), run: vi.fn(), inTransaction: vi.fn(),
		persistJSONBlob: vi.fn(), replacePassword: vi.fn(), deletePassword: vi.fn(),
		getPassword: vi.fn(), reportError: vi.fn(), onProps: vi.fn(), onDidChange: vi.fn(),
	};
});

vi.mock("node:module", () => {
	const createRequire = () => (id) => {
		if (id === "nylas-store") return { default: class NylasStore {
			listenTo(...args) { return m.listenTo(...args); }
			stopListeningToAll(...args) { return m.stopListeningToAll(...args); }
			trigger(...args) { return m.trigger(...args); }
		} };
		if (id === "electron") return { default: { ipcRenderer: m.ipcRenderer }, ipcRenderer: m.ipcRenderer };
		if (id === "@electron/remote") return { default: m.remote, remote: m.remote, app: m.app };
		if (id === "rx-lite") return { Observable: { fromQuery: m.fromQuery } };
		if (id.endsWith("request-compat.js")) return { default: m.request };
		if (id.endsWith("models/utils.js")) return { default: m.utils };
		if (id.endsWith("actions.js")) return { default: m.actions };
		return {};
	};
	return { default: { createRequire }, createRequire };
});
vi.mock("nylas-store", () => ({ default: class NylasStore {
	listenTo(...args) { return m.listenTo(...args); }
	stopListeningToAll(...args) { return m.stopListeningToAll(...args); }
	trigger(...args) { return m.trigger(...args); }
} }));
vi.mock("electron", () => ({ default: { ipcRenderer: m.ipcRenderer }, ipcRenderer: m.ipcRenderer }));
vi.mock("@electron/remote", () => ({ default: m.remote, remote: m.remote, app: m.app }));
vi.mock("rx-lite", () => ({ default: { Observable: { fromQuery: m.fromQuery } }, Observable: { fromQuery: m.fromQuery } }));
vi.mock("../src/request-compat.js", () => ({ default: m.request }));
vi.mock("../src/flux/models/utils.js", () => ({ default: m.utils }));
vi.mock("../src/flux/actions.js", () => ({ default: m.actions }));

globalThis.DatabaseStore = {
	findJSONBlob: m.findJSONBlob, run: m.run, inTransaction: m.inTransaction,
};
globalThis.KeyManager = {
	replacePassword: m.replacePassword, deletePassword: m.deletePassword, getPassword: m.getPassword,
};
globalThis.APIError = class APIError extends Error {
	constructor(details) { super("API request failed"); Object.assign(this, details); }
};

const { default: identitySingleton } = await import("../src/flux/stores/identity-store.js");

describe("IdentityStore deep identity lifecycle", () => {
	let store;

	beforeEach(() => {
		vi.clearAllMocks();
		m.getPassword.mockReturnValue("keychain-token");
		m.persistJSONBlob.mockResolvedValue(undefined);
		m.inTransaction.mockImplementation((fn) => fn({ persistJSONBlob: m.persistJSONBlob }));
		m.run.mockResolvedValue(null);
		m.subscribe.mockReturnValue({ dispose: m.dispose });
		m.fromQuery.mockReturnValue({ subscribe: m.subscribe });
		globalThis.NylasEnv = {
			config: { get: vi.fn(() => "production"), onDidChange: m.onDidChange },
			isEmptyWindow: vi.fn(() => false), isMainWindow: vi.fn(() => true),
			onWindowPropsReceived: m.onProps, reportError: m.reportError,
		};
		store = new identitySingleton.constructor();
		store.URLRoot = "https://billing.test";
	});

	it("moves a supplied token into the keychain before persistence", async () => {
		const identity = { id: "i1", token: "secret" };
		await store.saveIdentity(identity);
		expect(m.replacePassword).toHaveBeenCalledWith("Nylas Account", "secret");
	});


	it("deletes the keychain token when clearing identity", async () => {
		await store.saveIdentity(null);
		expect(m.deletePassword).toHaveBeenCalledWith("Nylas Account");
	});

	it("persists identity changes inside a transaction", async () => {
		await store.saveIdentity({ id: "i1" });
		expect(m.inTransaction).toHaveBeenCalledOnce();
	});

	it("hydrates a missing identity token from the keychain", () => {
		store._onIdentityChanged({ id: "i1", name: "Ada" });
		expect(store._identity.token).toBe("keychain-token");
	});

	it("preserves an identity token already in memory", () => {
		store._onIdentityChanged({ id: "i1", token: "fresh" });
		expect(m.getPassword).not.toHaveBeenCalled();
	});

	it("notifies the main process when the identity id changes", () => {
		store._onIdentityChanged({ id: "i1" });
		expect(m.ipcRenderer.send).toHaveBeenCalledWith("command", "onIdentityChanged");
	});

	it("does not notify the main process for updates to the same identity", () => {
		store._identity = { id: "i1", token: "old" };
		store._onIdentityChanged({ id: "i1", token: "new" });
		expect(m.ipcRenderer.send).not.toHaveBeenCalled();
	});

	it("publishes every identity cache update", () => {
		store._onIdentityChanged({ id: "i1" });
		expect(m.trigger).toHaveBeenCalledOnce();
	});

	it("fetches the remote identity with the N1 user path", async () => {
		store._identity = { id: "i1", token: "token" };
		store.fetchPath = vi.fn().mockResolvedValue({ id: "i1", name: "Ada" });
		store.saveIdentity = vi.fn();
		await store._fetchIdentity();
		expect(store.fetchPath).toHaveBeenCalledWith("/n1/user");
	});

	it("merges remote fields into the cached identity", async () => {
		store._identity = { id: "i1", token: "token", local: true };
		store.fetchPath = vi.fn().mockResolvedValue({ id: "i1", name: "Ada" });
		store.saveIdentity = vi.fn();
		await store._fetchIdentity();
		expect(store.saveIdentity).toHaveBeenCalledWith({ id: "i1", token: "token", local: true, name: "Ada" });
	});

	it("saves a remotely updated display name", async () => {
		store._identity = { id: "i1", token: "token", name: "Old Name" };
		store.fetchPath = vi.fn().mockResolvedValue({ id: "i1", name: "New Name" });
		store.saveIdentity = vi.fn();
		await store._fetchIdentity();
		expect(store.saveIdentity).toHaveBeenCalledWith(expect.objectContaining({ name: "New Name" }));
	});

	it("saves a remotely updated email address", async () => {
		store._identity = { id: "i1", token: "token", email: "old@example.com" };
		store.fetchPath = vi.fn().mockResolvedValue({ id: "i1", email: "new@example.com" });
		store.saveIdentity = vi.fn();
		await store._fetchIdentity();
		expect(store.saveIdentity).toHaveBeenCalledWith(expect.objectContaining({ email: "new@example.com" }));
	});

	it("skips remote fetches without an identity token", async () => {
		store._identity = { id: "i1" };
		store.fetchPath = vi.fn();
		await store._fetchIdentity();
		expect(store.fetchPath).not.toHaveBeenCalled();
	});

	it("reports a remote identity with a mismatched id", async () => {
		store._identity = { id: "i1", token: "token" };
		store.fetchPath = vi.fn().mockResolvedValue({ id: "other" });
		vi.spyOn(console, "error").mockImplementation(() => {});
		await store._fetchIdentity();
		expect(m.reportError).toHaveBeenCalledWith(expect.any(Error), { id: "other" });
	});

	it("returns true after an explicit identity refresh", async () => {
		store._fetchIdentity = vi.fn().mockResolvedValue(undefined);
		await expect(store.asyncRefreshIdentity()).resolves.toBe(true);
	});

	it("builds GET requests beneath the configured billing root", async () => {
		store.nylasIDRequest = vi.fn().mockResolvedValue({ id: "i1" });
		await store.fetchPath("/n1/user");
		expect(store.nylasIDRequest).toHaveBeenCalledWith(expect.objectContaining({ method: "GET", url: "https://billing.test/n1/user" }));
	});

	it("reports request failures and resolves fetchPath to null", async () => {
		const error = new Error("offline");
		store.nylasIDRequest = vi.fn().mockRejectedValue(error);
		await expect(store.fetchPath("/n1/user")).resolves.toBeNull();
		expect(m.reportError).toHaveBeenCalledWith(error);
	});

	it("authenticates Nylas ID requests with the identity token", async () => {
		store._identity = { id: "i1", token: "secret" };
		m.request.mockImplementation((options, callback) => callback(null, { statusCode: 200 }, { ok: true }));
		const options = {};
		await store.nylasIDRequest(options);
		expect(options.auth).toEqual({ username: "secret", password: "", sendImmediately: true });
	});

	it("dispatches request-start instrumentation", async () => {
		store._identity = { token: "secret" };
		m.request.mockImplementation((options, callback) => callback(null, { statusCode: 200 }, {}));
		const options = {};
		await store.nylasIDRequest(options);
		expect(m.actions.willMakeAPIRequest).toHaveBeenCalledWith({ request: options, requestId: "request-1" });
	});

	it("rejects HTTP error responses as API errors", async () => {
		store._identity = { token: "secret" };
		m.request.mockImplementation((options, callback) => callback(null, { statusCode: 500 }, { message: "bad" }));
		await expect(store.nylasIDRequest({})).rejects.toBeInstanceOf(globalThis.APIError);
	});





	it("uses BILLING_URL for local development", () => {
		const previous = process.env.BILLING_URL;
		process.env.BILLING_URL = "https://local-billing.test";
		NylasEnv.config.get.mockReturnValue("local");
		store._onEnvChanged();
		expect(store.URLRoot).toBe("https://local-billing.test");
		if (previous === undefined) delete process.env.BILLING_URL; else process.env.BILLING_URL = previous;
	});

	it("uses the staging billing root", () => {
		NylasEnv.config.get.mockReturnValue("staging");
		store._onEnvChanged();
		expect(store.URLRoot).toBe("https://billing-staging.nylas.com");
	});

	it("logs out by clearing identity before relaunching", async () => {
		store.saveIdentity = vi.fn().mockResolvedValue(undefined);
		await store._onLogoutNylasIdentity();
		expect(store.saveIdentity).toHaveBeenCalledWith(null);
		expect(m.app.relaunch).toHaveBeenCalledOnce();
		expect(m.app.quit).toHaveBeenCalledOnce();
	});

	it("disposes the database subscription during deactivation", () => {
		store._disp = { dispose: m.dispose };
		store.deactivate();
		expect(m.dispose).toHaveBeenCalledOnce();
	});
});
