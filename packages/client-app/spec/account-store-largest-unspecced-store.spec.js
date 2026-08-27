import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
	const config = { get: vi.fn(() => []), set: vi.fn(), onDidChange: vi.fn() };
	globalThis.NylasEnv = {
		config,
		isMainWindow: () => false,
		reportError: vi.fn(),
		showErrorDialog: vi.fn(),
	};
	return { config, replacePassword: vi.fn(), deletePassword: vi.fn(), trigger: vi.fn() };
});

vi.mock("nylas-store", () => ({
	default: class NylasStore {
		listenTo() {}
		trigger(...args) { mocks.trigger(...args); }
	},
}));
vi.mock("../src/key-manager.js", () => ({
	default: { getPassword: vi.fn(), replacePassword: mocks.replacePassword, deletePassword: mocks.deletePassword },
}));
vi.mock("../src/flux/actions.js", () => ({
	default: {
		removeAccount: {}, updateAccount: {}, reorderAccount: {}, apiAuthError: {},
		focusDefaultMailboxPerspectiveForAccounts: vi.fn(), setCollapsedSidebarItem: vi.fn(), retryDeltaConnection: vi.fn(),
	},
}));
vi.mock("../src/flux/models/account.js", () => ({
	default: class Account {
		static SYNC_STATE_RUNNING = "running";
		static SYNC_STATE_AUTH_FAILED = "auth-failed";
		static N1_CLOUD_STATE_AUTH_FAILED = "cloud-auth-failed";
		constructor(values = {}) { Object.assign(this, { aliases: [], ...values }); }
		fromJSON(json) { Object.assign(this, json, { emailAddress: json.email_address ?? json.emailAddress }); return this; }
		toJSON() { return { ...this }; }
		me() { return { accountId: this.id, email: this.emailAddress }; }
		meUsingAlias(alias) { return { accountId: this.id, email: alias }; }
		hasSyncStateError() { return this.syncError === true; }
	},
}));
vi.mock("../src/flux/models/utils.js", () => ({
	default: { emailIsEquivalent: (a, b) => String(a).toLowerCase() === String(b).toLowerCase() },
}));
vi.mock("../src/flux/stores/database-store.js", () => ({ default: { inTransaction: vi.fn() } }));

import Account from "../src/flux/models/account.js";
import accountStore from "../src/flux/stores/account-store.js";

describe("AccountStore", () => {
	let store;
	let first;
	let second;

	beforeEach(() => {
		vi.clearAllMocks();
		mocks.config.get.mockReturnValue([]);
		store = new accountStore.constructor();
		first = new Account({ id: "a1", emailAddress: "One@example.com", aliases: ["alias@example.com"] });
		second = new Account({ id: "a2", emailAddress: "two@example.com" });
		store._accounts = [first, second];
		store._tokens = { a1: { localSync: "local" } };
		store._caches = {};
	});

	it("returns accounts and account ids", () => {
		expect(store.accounts()).toEqual([first, second]);
		expect(store.accountIds()).toEqual(["a1", "a2"]);
	});

	it("deduplicates accounts represented by items", () => {
		expect(store.accountsForItems([{ accountId: "a1" }, { accountId: "a1" }, { accountId: "a2" }])).toEqual([first, second]);
	});

	it("returns one account only when all items agree", () => {
		expect(store.accountForItems([{ accountId: "a1" }])).toBe(first);
		expect(store.accountForItems([{ accountId: "a1" }, { accountId: "a2" }])).toBeNull();
	});

	it("looks up primary and alias email addresses case-insensitively", () => {
		expect(store.accountForEmail("one@EXAMPLE.com")).toBe(first);
		expect(store.accountForEmail("ALIAS@example.com")).toBe(first);
	});

	it("reports whether an address belongs to the user", () => {
		expect(store.isMyEmail("TWO@example.com")).toBe(true);
		expect(store.isMyEmail(["none@example.com", "alias@example.com"])).toBe(true);
		expect(store.isMyEmail("none@example.com")).toBe(false);
	});

	it("returns unique primary and alias addresses", () => {
		first.aliases.push("One@example.com");
		expect(store.emailAddresses()).toEqual(["One@example.com", "two@example.com", "alias@example.com"]);
	});

	it("filters aliases for account objects or ids", () => {
		expect(store.aliasesFor([first]).every((contact) => contact.accountId === "a1")).toBe(true);
		expect(store.aliasesFor(["a2"])).toEqual([{ accountId: "a2", email: "two@example.com" }]);
	});

	it("exposes tokens and rejects the deprecated current account", () => {
		expect(store.tokensForAccountId("a1")).toEqual({ localSync: "local" });
		expect(() => store.current()).toThrow("deprecated");
	});
});
