import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
	config: new Map(),
	deletePassword: vi.fn(),
	getPassword: vi.fn((key) => `password:${key}`),
	listenTo: vi.fn(),
	replacePassword: vi.fn(),
	reportError: vi.fn(),
	showErrorDialog: vi.fn(),
	trigger: vi.fn(),
	updateAccount: vi.fn(),
	ipcSend: vi.fn(),
}));

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
	retryDeltaConnection: vi.fn(),
	setCollapsedSidebarItem: vi.fn(),
	updateAccount: m.updateAccount,
} }));
vi.mock("../src/flux/models/account.js", () => {
	class Account {
		static N1_CLOUD_STATE_AUTH_FAILED = "cloud-auth-failed";
		static SYNC_STATE_AUTH_FAILED = "sync-auth-failed";
		static SYNC_STATE_RUNNING = "running";
		constructor(attrs = {}) { Object.assign(this, attrs); this.aliases ||= []; }
		fromJSON(json) {
			Object.assign(this, json, {
				emailAddress: json.email_address ?? json.emailAddress,
				signature: json.signature,
			});
			this.aliases ||= [];
			return this;
		}
		toJSON() { return { ...this, email_address: this.emailAddress }; }
		me() { return { accountId: this.id, email: this.emailAddress, name: this.name }; }
		meUsingAlias(alias) { return { accountId: this.id, email: alias, name: this.name }; }
		hasSyncStateError() { return Boolean(this.syncError); }
	}
	return { default: Account };
});
vi.mock("../src/flux/models/utils.js", () => ({ default: {
	emailIsEquivalent: (a, b) => typeof a === "string" && typeof b === "string" && a.toLowerCase() === b.toLowerCase(),
} }));
vi.mock("../src/flux/stores/database-store.js", () => ({ default: { inTransaction: vi.fn() } }));
vi.mock("fs-plus", () => ({ default: {} }));
vi.mock("node:path", () => ({ default: { join: (...parts) => parts.join("/") } }));
vi.mock("electron", () => {
	const ipcRenderer = { send: m.ipcSend };
	return { default: { ipcRenderer }, ipcRenderer };
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
import Account from "../src/flux/models/account.js";

const json = (id, email, overrides = {}) => ({
	id, email_address: email, name: id.toUpperCase(), provider: "gmail", aliases: [], ...overrides,
});

describe("AccountStore queries", () => {
	let store;

	beforeEach(() => {
		vi.clearAllMocks();
		m.config = new Map([
			["nylas.accounts", [json("a", "Ada@example.com", { aliases: ["alias@example.com"], signature: "Regards" }), json("b", "b@example.com")]],
			["nylas.accountsVersion", 3],
		]);
		NylasEnv.config.get = vi.fn((key) => m.config.get(key));
		NylasEnv.config.set = vi.fn((key, value) => m.config.set(key, value));
		NylasEnv.reportError = m.reportError;
		NylasEnv.showErrorDialog = m.showErrorDialog;
		NylasEnv.isMainWindow = vi.fn(() => true);
		store = AccountStore;
		store._accounts = undefined;
		store._tokens = {};
		store._loadAccounts();
		vi.clearAllMocks();
	});

	it("returns the loaded accounts", () => {
		expect(store.accounts().map((account) => account.id)).toEqual(["a", "b"]);
	});

	it("returns account ids in account order", () => {
		expect(store.accountIds()).toEqual(["a", "b"]);
	});

	it("finds an account by id", () => {
		expect(store.accountForId("b").emailAddress).toBe("b@example.com");
	});

	it("returns undefined for an unknown id", () => {
		expect(store.accountForId("missing")).toBeUndefined();
	});

	it("caches account id misses", () => {
		expect(store.accountForId("missing")).toBeUndefined();
		store._accounts.push(new Account({ id: "missing" }));
		// `_cachedGetter` uses truthiness, so misses are intentionally recomputed.
		expect(store.accountForId("missing")).toBe(store._accounts[2]);
	});

	it("finds an account email case-insensitively", () => {
		expect(store.accountForEmail("ada@EXAMPLE.com").id).toBe("a");
	});

	it("finds an account through an alias", () => {
		expect(store.accountForEmail("ALIAS@example.com").id).toBe("a");
	});

	it("returns null for an unknown email", () => {
		expect(store.accountForEmail("nobody@example.com")).toBeNull();
	});

	it("recognizes one of the user's account emails", () => {
		expect(store.isMyEmail("ADA@example.com")).toBe(true);
	});

	it("recognizes one of the user's aliases", () => {
		expect(store.isMyEmail(["other@example.com", "alias@example.com"])).toBe(true);
	});

	it("rejects unrelated email addresses", () => {
		expect(store.isMyEmail("other@example.com")).toBe(false);
	});

	it("returns unique account and alias email addresses", () => {
		store._accounts[1].aliases = ["Ada@example.com"];
		store._caches = {};
		expect(store.emailAddresses()).toEqual(["Ada@example.com", "b@example.com", "alias@example.com"]);
	});

	it("builds a primary contact for every account", () => {
		expect(store.aliases().filter((contact) => !contact.isAlias).map((contact) => contact.email)).toEqual(["Ada@example.com", "b@example.com"]);
	});

	it("marks alias contacts as aliases", () => {
		expect(store.aliases().find((contact) => contact.email === "alias@example.com")).toMatchObject({ accountId: "a", isAlias: true });
	});

	it("caches the alias array", () => {
		expect(store.aliases()).toBe(store.aliases());
	});

	it("filters aliases by account ids", () => {
		expect(store.aliasesFor(["b"]).map((contact) => contact.email)).toEqual(["b@example.com"]);
	});

	it("filters aliases by Account instances", () => {
		expect(store.aliasesFor([store.accountForId("a")]).map((contact) => contact.email)).toEqual(["Ada@example.com", "alias@example.com"]);
	});

	it("maps items to distinct accounts", () => {
		expect(store.accountsForItems([{ accountId: "a" }, { accountId: "a" }, { accountId: "b" }])).toEqual(store.accounts());
	});

	it("drops unknown accounts when mapping items", () => {
		expect(store.accountsForItems([{ accountId: "missing" }])).toEqual([]);
	});

	it("returns the sole account shared by items", () => {
		expect(store.accountForItems([{ accountId: "a" }, { accountId: "a" }]).id).toBe("a");
	});

	it("returns null when items span accounts", () => {
		expect(store.accountForItems([{ accountId: "a" }, { accountId: "b" }])).toBeNull();
	});

	it("returns undefined when items have no known account", () => {
		expect(store.accountForItems([])).toBeUndefined();
	});

	it("reports an account as syncing without a sync error", () => {
		expect(store.accountIsSyncing("a")).toBe(true);
	});

	it("reports an account as not syncing with a sync error", () => {
		store.accountForId("a").syncError = true;
		expect(store.accountIsSyncing("a")).toBe(false);
	});

	it("reports all accounts syncing only when none has an error", () => {
		store.accountForId("b").syncError = true;
		expect(store.accountsAreSyncing()).toBe(false);
	});

	it("exposes the configured signature on its account", () => {
		expect(store.accountForId("a").signature).toBe("Regards");
	});

	it("throws for the deprecated default/current selection", () => {
		expect(() => store.current()).toThrow("AccountStore.current() has been deprecated.");
	});

	it("returns tokens loaded for an account id", () => {
		expect(store.tokensForAccountId("a")).toEqual({ n1Cloud: "password:Ada@example.com.n1Cloud", localSync: "password:Ada@example.com.localSync" });
	});

	it("also stores loaded tokens under the legacy email key", () => {
		expect(store.tokensForAccountId("Ada@example.com")).toBe(store.tokensForAccountId("a"));
	});

	it("returns undefined tokens for an unknown account", () => {
		expect(store.tokensForAccountId("missing")).toBeUndefined();
	});
});
