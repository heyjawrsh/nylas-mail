import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => {
	const display = { workAreaSize: { width: 1920, height: 1080 } };
	const win = {};
	return {
		display,
		win,
		config: new Map(),
		deletePassword: vi.fn(),
		getPassword: vi.fn((key) => `key:${key}`),
		ipcOn: vi.fn(),
		ipcSend: vi.fn(),
		listenTo: vi.fn(),
		replacePassword: vi.fn(),
		retryDeltaConnection: vi.fn(),
		showMessageBox: vi.fn(),
		trigger: vi.fn(),
	};
});

vi.mock("node:module", () => {
	const createRequire = () => (id) => {
		if (id === "electron") return { ipcRenderer: { on: m.ipcOn, send: m.ipcSend } };
		return { default: {} };
	};
	return { default: { createRequire }, createRequire };
});
vi.mock("nylas-store", () => ({
	default: class NylasStore {
		listenTo(...args) { return m.listenTo(...args); }
		trigger(...args) { return m.trigger(...args); }
	},
}));
vi.mock("../src/key-manager.js", () => ({ default: {
	deletePassword: m.deletePassword,
	getPassword: m.getPassword,
	replacePassword: m.replacePassword,
} }));
vi.mock("../src/flux/actions.js", () => ({ default: {
	apiAuthError: vi.fn(),
	focusDefaultMailboxPerspectiveForAccounts: vi.fn(),
	removeAccount: vi.fn(),
	reorderAccount: vi.fn(),
	retryDeltaConnection: m.retryDeltaConnection,
	setCollapsedSidebarItem: vi.fn(),
	updateAccount: vi.fn(),
} }));
vi.mock("../src/flux/models/account.js", () => {
	class Account {
		static N1_CLOUD_STATE_AUTH_FAILED = "cloud-auth-failed";
		static SYNC_STATE_AUTH_FAILED = "sync-auth-failed";
		static SYNC_STATE_RUNNING = "running";
		constructor(attrs = {}) { Object.assign(this, attrs); this.aliases ||= []; }
		fromJSON(json) {
			Object.assign(this, json, { emailAddress: json.email_address ?? json.emailAddress });
			this.aliases ||= [];
			return this;
		}
		toJSON() { return { ...this, email_address: this.emailAddress }; }
		me() { return { accountId: this.id, email: this.emailAddress }; }
		meUsingAlias(email) { return { accountId: this.id, email }; }
		hasSyncStateError() { return Boolean(this.syncError); }
	}
	return { default: Account };
});
vi.mock("../src/flux/models/utils.js", () => ({ default: {
	emailIsEquivalent: (a, b) => typeof a === "string" && typeof b === "string" && a.toLowerCase() === b.toLowerCase(),
} }));
vi.mock("../src/flux/stores/database-store.js", () => ({ default: { inTransaction: vi.fn() } }));
vi.mock("fs-plus", () => ({ default: {} }));
vi.mock("node:path", () => {
	const path = { join: (...parts) => parts.join("/") };
	return { default: path, ...path };
});
vi.mock("electron", () => {
	const remote = {
		app: {}, screen: { getPrimaryDisplay: () => m.display },
		dialog: { showMessageBox: m.showMessageBox }, getCurrentWindow: () => m.win,
	};
	const ipcRenderer = { on: m.ipcOn, send: m.ipcSend };
	return { default: { ipcRenderer, remote }, ipcRenderer, remote };
});
vi.mock("@electron/remote", () => {
	const remote = {
		app: {}, screen: { getPrimaryDisplay: () => m.display },
		dialog: { showMessageBox: m.showMessageBox }, getCurrentWindow: () => m.win,
	};
	return { default: remote, ...remote, remote };
});
vi.mock("underscore", () => {
	const u = {
		any: (items, fn) => items.some(fn),
		compact: (items) => items.filter(Boolean),
		debounce: (fn) => fn,
		defer: (fn) => fn(),
		difference: (items, others) => items.filter((item) => !others.includes(item)),
		extend: Object.assign,
		filter: (items, fn) => items.filter(fn),
		findIndex: (items, fn) => items.findIndex(fn),
		findWhere: (items, attrs) => items.find((item) => Object.entries(attrs).every(([key, value]) => item[key] === value)),
		pluck: (items, key) => (items || []).map((item) => item[key]),
		uniq: (items, fn) => { const seen = new Set(); return items.filter((item) => { const key = fn ? fn(item) : item; if (seen.has(key)) return false; seen.add(key); return true; }); },
		unique: (items) => [...new Set(items)],
		values: (obj) => Object.values(obj || {}),
		without: (items, removed) => items.filter((item) => item !== removed),
	};
	return { default: u, ...u };
});

import AccountStore from "../src/flux/stores/account-store.js";
import Actions from "../src/flux/actions.js";

const accountJSON = (id, email, overrides = {}) => ({
	id, email_address: email, provider: "gmail", aliases: [], ...overrides,
});

describe("AccountStore selection, ordering, and token surfaces", () => {
	let store;

	beforeEach(() => {
		vi.clearAllMocks();
		m.config = new Map([
			["nylas.accounts", [
				accountJSON("a1", "one@example.com", { aliases: ["z@example.com", "a@example.com"], signature: "First", platform: "linux" }),
				accountJSON("a2", "two@example.com", { aliases: ["second@example.com"], signature: "Second", platform: "darwin", disabled: true }),
				accountJSON("a3", "three@example.com", { signature: "Third", platform: "linux" }),
			]],
			["nylas.accountsVersion", 4],
		]);
		globalThis.NylasEnv = {
			config: {
				get: vi.fn((key) => m.config.get(key)),
				set: vi.fn((key, value) => m.config.set(key, value)),
				onDidChange: vi.fn(),
			},
			isMainWindow: vi.fn(() => true),
			reportError: vi.fn(),
			showErrorDialog: vi.fn(),
		};
		store = AccountStore;
		store._accounts = undefined;
		store._tokens = {};
		store._loadAccounts();
		vi.clearAllMocks();
	});

	it("uses configuration order as the default account order", () => {
		expect(store.accountIds()).toEqual(["a1", "a2", "a3"]);
	});

	it("exposes the first configured account first", () => {
		expect(store.accounts()[0].id).toBe("a1");
	});

	it("moves an account to the requested index", () => {
		store._onReorderAccount("a3", 0);
		expect(store.accountIds()).toEqual(["a3", "a1", "a2"]);
	});

	it("persists reordered accounts", () => {
		store._onReorderAccount("a3", 0);
		expect(NylasEnv.config.set).toHaveBeenCalledWith("nylas.accounts", expect.arrayContaining([expect.objectContaining({ id: "a3" })]));
	});

	it("does not save when reorder targets an unknown account", () => {
		store._onReorderAccount("missing", 0);
		expect(NylasEnv.config.set).not.toHaveBeenCalled();
	});

	it("preserves the platform attribute from configuration", () => {
		expect(store.accountForId("a2").platform).toBe("darwin");
	});

	it("allows callers to select accounts for a platform", () => {
		expect(store.accounts().filter((account) => account.platform === "linux").map((account) => account.id)).toEqual(["a1", "a3"]);
	});

	it("keeps disabled accounts in the public account list", () => {
		expect(store.accounts().map((account) => account.id)).toContain("a2");
	});

	it("preserves the disabled attribute", () => {
		expect(store.accountForId("a2").disabled).toBe(true);
	});

	it("places each primary address before its aliases", () => {
		expect(store.aliases().slice(0, 3).map((contact) => contact.email)).toEqual(["one@example.com", "z@example.com", "a@example.com"]);
	});

	it("preserves configured alias order", () => {
		expect(store.aliasesFor(["a1"]).map((contact) => contact.email)).toEqual(["one@example.com", "z@example.com", "a@example.com"]);
	});

	it("keeps account groups in account order in the alias list", () => {
		expect(store.aliases().map((contact) => contact.accountId)).toEqual(["a1", "a1", "a1", "a2", "a2", "a3"]);
	});

	it("marks only generated alias contacts as aliases", () => {
		expect(store.aliasesFor(["a2"]).map((contact) => contact.isAlias)).toEqual([undefined, true]);
	});

	it("preserves signatures on their configured accounts", () => {
		expect(store.accounts().map((account) => account.signature)).toEqual(["First", "Second", "Third"]);
	});

	it("loads the local-sync token for each account", () => {
		expect(store.tokensForAccountId("a1").localSync).toBe("key:one@example.com.localSync");
	});

	it("loads the cloud token for each account", () => {
		expect(store.tokensForAccountId("a1").n1Cloud).toBe("key:one@example.com.n1Cloud");
	});


	it("updates stored tokens when adding account JSON", () => {
		store.addAccountFromJSON(accountJSON("a4", "four@example.com"), "local-new", "cloud-new");
		expect(store.tokensForAccountId("a4")).toEqual({ localSync: "local-new", n1Cloud: "cloud-new" });
	});

	it("writes a refreshed local token to the key manager", () => {
		store.addAccountFromJSON(accountJSON("a4", "four@example.com"), "local-new", "cloud-new");
		expect(m.replacePassword).toHaveBeenCalledWith("four@example.com.localSync", "local-new");
	});

	it("writes a refreshed cloud token to the key manager", () => {
		store.addAccountFromJSON(accountJSON("a4", "four@example.com"), "local-new", "cloud-new");
		expect(m.replacePassword).toHaveBeenCalledWith("four@example.com.n1Cloud", "cloud-new");
	});

	it("appends a newly authenticated account", () => {
		store.addAccountFromJSON(accountJSON("a4", "four@example.com"), "local-new", "cloud-new");
		expect(store.accountIds()).toEqual(["a1", "a2", "a3", "a4"]);
	});

	it("refreshes an existing account without duplicating it", () => {
		store.addAccountFromJSON(accountJSON("a1", "one@example.com", { name: "Updated" }), "local-new", "cloud-new");
		expect(store.accountIds()).toEqual(["a1", "a2", "a3"]);
	});

	it("marks a refreshed existing account as running", () => {
		store.addAccountFromJSON(accountJSON("a1", "one@example.com"), "local-new", "cloud-new");
		expect(store.accountForId("a1").syncState).toBe("running");
	});

	it("retries delta connection after existing account credentials change", () => {
		store.addAccountFromJSON(accountJSON("a1", "one@example.com"), "local-new", "cloud-new");
		expect(m.retryDeltaConnection).toHaveBeenCalledOnce();
	});

	it("marks local sync auth failed for its matching token", async () => {
		await store._onAPIAuthError({}, { auth: { user: store.tokensForAccountId("a1").localSync } }, "LocalSyncAPI");
		expect(store.accountForId("a1").syncState).toBe("sync-auth-failed");
	});

	it("marks cloud auth failed for its matching token", async () => {
		await store._onAPIAuthError({}, { auth: { user: store.tokensForAccountId("a1").n1Cloud } }, "N1CloudAPI");
		expect(store.accountForId("a1").n1CloudState).toBe("cloud-auth-failed");
	});

	it("does not update an account when auth has no token", async () => {
		await store._onAPIAuthError({}, { auth: {} }, "LocalSyncAPI");
		expect(NylasEnv.config.set).not.toHaveBeenCalled();
	});

	it("does not update an account for an unknown auth token", async () => {
		await store._onAPIAuthError({}, { auth: { user: "unknown" } }, "LocalSyncAPI");
		expect(NylasEnv.config.set).not.toHaveBeenCalled();
	});

	it("rejects new account JSON without an email address", () => {
		const error = vi.spyOn(console, "error").mockImplementation(() => {});
		const log = vi.spyOn(console, "log").mockImplementation(() => {});
		expect(() => store.addAccountFromJSON({ id: "bad", provider: "gmail" })).toThrow("Returned account data is invalid");
		error.mockRestore(); log.mockRestore();
	});

	it("rejects new account JSON without a provider", () => {
		const error = vi.spyOn(console, "error").mockImplementation(() => {});
		const log = vi.spyOn(console, "log").mockImplementation(() => {});
		expect(() => store.addAccountFromJSON({ id: "bad", email_address: "bad@example.com" })).toThrow("Returned account data is invalid");
		error.mockRestore(); log.mockRestore();
	});

	it("filters an account without an email address during load", () => {
		m.config.set("nylas.accounts", [accountJSON("ok", "ok@example.com"), { id: "bad", provider: "gmail" }]);
		store._loadAccounts();
		expect(store.accountIds()).toEqual(["ok"]);
	});

	it("filters a duplicate account id during load", () => {
		m.config.set("nylas.accounts", [accountJSON("same", "one@example.com"), accountJSON("same", "two@example.com")]);
		store._loadAccounts();
		expect(store.accounts().map((account) => account.emailAddress)).toEqual(["one@example.com"]);
	});

	it("filters a duplicate email address during load", () => {
		m.config.set("nylas.accounts", [accountJSON("one", "same@example.com"), accountJSON("two", "same@example.com")]);
		store._loadAccounts();
		expect(store.accountIds()).toEqual(["one"]);
	});

	it("shows a validity error in the main window", () => {
		m.config.set("nylas.accounts", [accountJSON("same", "one@example.com"), accountJSON("same", "two@example.com")]);
		store._loadAccounts();
		expect(NylasEnv.showErrorDialog).toHaveBeenCalledWith(expect.stringContaining("same ID"));
	});

	it("suppresses validity dialogs outside the main window", () => {
		NylasEnv.isMainWindow.mockReturnValue(false);
		m.config.set("nylas.accounts", [accountJSON("same", "one@example.com"), accountJSON("same", "two@example.com")]);
		store._loadAccounts();
		expect(NylasEnv.showErrorDialog).not.toHaveBeenCalled();
	});
});
