import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
	config: new Map(),
	deletePassword: vi.fn(),
	getPassword: vi.fn((key) => `secret:${key}`),
	ipcOn: vi.fn(),
	ipcSend: vi.fn(),
	listenTo: vi.fn(),
	replacePassword: vi.fn(),
	trigger: vi.fn(),
}));

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
	retryDeltaConnection: vi.fn(),
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
		me() { return { accountId: this.id, email: this.emailAddress, signature: this.signature }; }
		meUsingAlias(email) { return { accountId: this.id, email, signature: this.signature }; }
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
	const ipcRenderer = { on: m.ipcOn, send: m.ipcSend };
	const remote = { app: {}, getCurrentWindow: vi.fn(), screen: {}, dialog: {} };
	return { default: { ipcRenderer, remote }, ipcRenderer, remote };
});
vi.mock("@electron/remote", () => {
	const remote = { app: {}, getCurrentWindow: vi.fn(), screen: {}, dialog: {} };
	return { default: remote, ...remote, remote };
});
vi.mock("underscore", () => {
	const underscore = {
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
		values: (object) => Object.values(object || {}),
		without: (items, removed) => items.filter((item) => item !== removed),
	};
	return { default: underscore, ...underscore };
});

import AccountStore from "../src/flux/stores/account-store.js";
import Actions from "../src/flux/actions.js";

const accountJSON = (id, email, overrides = {}) => ({
	id, email_address: email, provider: "gmail", aliases: [], ...overrides,
});

describe("AccountStore removal selection, aliases, and item edges", () => {
	let store;

	beforeEach(() => {
		vi.clearAllMocks();
		m.config = new Map([
			["nylas.accounts", [
				accountJSON("work", "work@example.com", { aliases: ["sales@example.com"], signature: "Work signature", platform: "linux" }),
				accountJSON("home", "home@example.com", { aliases: ["family@example.com"], signature: "Home signature", platform: "darwin" }),
				accountJSON("spare", "spare@example.com", { signature: "Spare signature" }),
			]],
			["nylas.accountsVersion", 8],
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

	it("leaves account selection unchanged when removal id is missing", () => {
		store._onRemoveAccount("missing");
		expect(store.accountIds()).toEqual(["work", "home", "spare"]);
	});

	it("does not focus a new selection when removal id is missing", () => {
		store._onRemoveAccount("missing");
		expect(Actions.focusDefaultMailboxPerspectiveForAccounts).not.toHaveBeenCalled();
	});

	it("deletes credentials using the removed account email", () => {
		store._onRemoveAccount("home");
		expect(m.deletePassword).toHaveBeenCalledWith("home@example.com");
	});

	it("selects every remaining account before removal is persisted", () => {
		store._onRemoveAccount("home");
		expect(Actions.focusDefaultMailboxPerspectiveForAccounts).toHaveBeenCalledWith([
			expect.objectContaining({ id: "work" }), expect.objectContaining({ id: "spare" }),
		]);
	});

	it("focuses the replacement selection before writing configuration", () => {
		store._onRemoveAccount("home");
		expect(Actions.focusDefaultMailboxPerspectiveForAccounts.mock.invocationCallOrder[0])
			.toBeLessThan(NylasEnv.config.set.mock.invocationCallOrder[0]);
	});

	it("removes only the selected account", () => {
		store._onRemoveAccount("home");
		expect(store.accountIds()).toEqual(["work", "spare"]);
	});

	it("persists the remaining account order", () => {
		store._onRemoveAccount("home");
		const saved = NylasEnv.config.set.mock.calls.find(([key]) => key === "nylas.accounts")[1];
		expect(saved.map(({ id }) => id)).toEqual(["work", "spare"]);
	});

	it("increments the accounts version after removal", () => {
		store._onRemoveAccount("home");
		expect(NylasEnv.config.set).toHaveBeenCalledWith("nylas.accountsVersion", 9);
	});

	it("collapses the inbox after selecting remaining accounts", () => {
		store._onRemoveAccount("home");
		expect(Actions.setCollapsedSidebarItem).toHaveBeenCalledWith("Inbox", true);
	});

	it("triggers subscribers after removal", () => {
		store._onRemoveAccount("home");
		expect(m.trigger).toHaveBeenCalledOnce();
	});

	it("does not relaunch while another account remains", () => {
		store._onRemoveAccount("home");
		expect(m.ipcSend).not.toHaveBeenCalled();
	});

	it("relaunches into initial windows after the last account is removed", () => {
		store._accounts = [store.accountForId("work")];
		store._onRemoveAccount("work");
		expect(m.ipcSend).toHaveBeenCalledWith("command", "application:relaunch-to-initial-windows", { resetDatabase: true });
	});

	it("selects an empty account list before relaunching", () => {
		store._accounts = [store.accountForId("work")];
		store._onRemoveAccount("work");
		expect(Actions.focusDefaultMailboxPerspectiveForAccounts).toHaveBeenCalledWith([]);
	});

	it("invalidates a cached id lookup when its account is removed", () => {
		expect(store.accountForId("home").id).toBe("home");
		store._onRemoveAccount("home");
		expect(store.accountForId("home")).toBeUndefined();
	});

	it("invalidates cached aliases when an account is removed", () => {
		store.aliases();
		store._onRemoveAccount("home");
		expect(store.aliases().map(({ email }) => email)).not.toContain("family@example.com");
	});

	it("returns no aliases for an unknown account id", () => {
		expect(store.aliasesFor(["missing"])).toEqual([]);
	});

	it("ignores missing ids mixed with a known alias selection", () => {
		expect(store.aliasesFor(["missing", "home"]).map(({ email }) => email))
			.toEqual(["home@example.com", "family@example.com"]);
	});

	it("returns no aliases for an empty account selection", () => {
		expect(store.aliasesFor([])).toEqual([]);
	});

	it("keeps the surviving account signature after another account is removed", () => {
		store._onRemoveAccount("home");
		expect(store.accountForId("work").signature).toBe("Work signature");
	});

	it("removes the deleted signature from the selectable account state", () => {
		store._onRemoveAccount("home");
		expect(store.accounts().map(({ signature }) => signature)).not.toContain("Home signature");
	});

	it("maps an empty item selection to no accounts", () => {
		expect(store.accountsForItems([])).toEqual([]);
	});

	it("drops items whose account id is missing", () => {
		expect(store.accountsForItems([{ accountId: "missing" }, { accountId: "work" }]).map(({ id }) => id)).toEqual(["work"]);
	});

	it("deduplicates nonadjacent items for the same account", () => {
		expect(store.accountsForItems([{ accountId: "work" }, { accountId: "home" }, { accountId: "work" }]).map(({ id }) => id))
			.toEqual(["work", "home"]);
	});

	it("treats an item without an account id as unknown", () => {
		expect(store.accountsForItems([{}, { accountId: "spare" }]).map(({ id }) => id)).toEqual(["spare"]);
	});

	it("returns undefined when all selected items reference missing accounts", () => {
		expect(store.accountForItems([{ accountId: "missing" }])).toBeUndefined();
	});

	it("returns null when known selected items span accounts despite missing items", () => {
		expect(store.accountForItems([{ accountId: "work" }, { accountId: "missing" }, { accountId: "home" }])).toBeNull();
	});
});
