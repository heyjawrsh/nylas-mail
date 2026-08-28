import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ config: new Map(), getPassword: vi.fn(), listenTo: vi.fn(), trigger: vi.fn() }));

vi.mock("node:module", () => { const api = { createRequire: () => vi.fn(() => ({ default: {} })) }; return { default: api, ...api }; });
vi.mock("nylas-store", () => ({ default: class NylasStore { listenTo(...args) { return m.listenTo(...args); } trigger(...args) { return m.trigger(...args); } } }));
vi.mock("../src/key-manager.js", () => ({ default: { deletePassword: vi.fn(), getPassword: m.getPassword, replacePassword: vi.fn() } }));
vi.mock("../src/flux/actions.js", () => ({ default: {
	apiAuthError: vi.fn(), focusDefaultMailboxPerspectiveForAccounts: vi.fn(), removeAccount: vi.fn(), reorderAccount: vi.fn(), retryDeltaConnection: vi.fn(), setCollapsedSidebarItem: vi.fn(), updateAccount: vi.fn(),
} }));
vi.mock("../src/flux/models/account.js", () => {
	class Account {
		static N1_CLOUD_STATE_AUTH_FAILED = "cloud-failed"; static SYNC_STATE_AUTH_FAILED = "sync-failed"; static SYNC_STATE_RUNNING = "running";
		constructor(values = {}) { Object.assign(this, values); }
		fromJSON(json) { Object.assign(this, json, { emailAddress: json.email_address ?? json.emailAddress }); return this; }
		toJSON() { return { ...this, email_address: this.emailAddress }; }
		me() { return { accountId: this.id, email: this.emailAddress, name: this.name, signature: this.signature }; }
		meUsingAlias(email) { return { accountId: this.id, email, name: this.name, signature: this.signature }; }
		hasSyncStateError() { return false; }
	}
	return { default: Account };
});
vi.mock("../src/flux/models/utils.js", () => ({ default: { emailIsEquivalent: (left, right) => typeof left === "string" && typeof right === "string" && left.toLowerCase() === right.toLowerCase() } }));
vi.mock("../src/flux/stores/database-store.js", () => ({ default: { inTransaction: vi.fn() } }));
vi.mock("fs-plus", () => ({ default: { existsSync: vi.fn(), readFileSync: vi.fn(), readdirSync: vi.fn(), removeSync: vi.fn(), copySync: vi.fn() } }));
vi.mock("node:path", () => { const api = { join: (...parts) => parts.join("/") }; return { default: api, ...api }; });
vi.mock("electron", () => { const remote = { app: {}, getCurrentWindow: vi.fn(), screen: {}, dialog: {} }; const ipcRenderer = { on: vi.fn(), send: vi.fn() }; return { default: { ipcRenderer, remote }, ipcRenderer, remote }; });
vi.mock("@electron/remote", () => { const remote = { app: {}, getCurrentWindow: vi.fn(), screen: {}, dialog: {} }; return { default: remote, ...remote, remote }; });
vi.mock("underscore", () => {
	const api = {
		any: (items, fn) => items.some(fn), compact: (items) => items.filter(Boolean), debounce: (fn) => fn, defer: (fn) => fn(),
		difference: (items, others) => items.filter((item) => !others.includes(item)), extend: Object.assign, filter: (items, fn) => items.filter(fn),
		findIndex: (items, fn) => items.findIndex(fn), findWhere: (items, attrs) => items.find((item) => Object.entries(attrs).every(([key, value]) => item[key] === value)),
		pluck: (items, key) => (items || []).map((item) => item[key]), uniq: (items) => [...new Set(items)], unique: (items) => [...new Set(items)],
		values: (object) => Object.values(object || {}), without: (items, removed) => items.filter((item) => item !== removed),
	};
	return { default: api, ...api };
});

globalThis.NylasEnv = {
	isWorkWindow: vi.fn(() => true), inSpecMode: vi.fn(() => true), inDevMode: vi.fn(() => false), isMainWindow: vi.fn(() => false), reportError: vi.fn(), showErrorDialog: vi.fn(),
	config: { get: vi.fn((key) => m.config.get(key)), set: vi.fn((key, value) => m.config.set(key, value)), onDidChange: vi.fn() },
	getConfigDirPath: vi.fn(() => "/config"), getPath: vi.fn(() => "/tmp"), getVersion: vi.fn(() => "0.0.0"),
};

const { default: store } = await import("../src/flux/stores/account-store.js");
const account = (id, email, extra = {}) => ({ id, email_address: email, provider: "gmail", aliases: [], ...extra });

describe("AccountStore alias and signature edge cases", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		m.config = new Map([["nylas.accounts", [
			account("signed", "signed@example.com", { name: "Signed", aliases: ["team@example.com", "TEAM@example.com"], signature: "Regards" }),
			account("blank", "blank@example.com", { name: "Blank", aliases: [], signature: "" }),
			account("unset", "unset@example.com", { name: "Unset", aliases: [] }),
		]], ["nylas.accountsVersion", 1]]);
		store._accounts = undefined;
		store._tokens = {};
		store._loadAccounts();
		vi.clearAllMocks();
	});

	it("copies a signature onto the primary contact", () => { expect(store.aliasesFor(["signed"])[0].signature).toBe("Regards"); });
	it("copies a signature onto every alias contact", () => { expect(store.aliasesFor(["signed"]).slice(1).map((item) => item.signature)).toEqual(["Regards", "Regards"]); });
	it("preserves an explicitly blank signature on the primary contact", () => { expect(store.aliasesFor(["blank"])[0]).toHaveProperty("signature", ""); });
	it("leaves an unset signature undefined on the primary contact", () => { expect(store.aliasesFor(["unset"])[0].signature).toBeUndefined(); });
	it("marks case-variant configured aliases separately", () => { expect(store.aliasesFor(["signed"]).slice(1).every((item) => item.isAlias)).toBe(true); });
	it("does not deduplicate case-equivalent configured aliases", () => { expect(store.aliasesFor(["signed"]).map((item) => item.email)).toEqual(["signed@example.com", "team@example.com", "TEAM@example.com"]); });
	it("deduplicates case-identical alias strings in emailAddresses", () => { expect(store.emailAddresses().filter((email) => email === "team@example.com")).toHaveLength(1); });
	it("retains case-variant alias strings in emailAddresses", () => { expect(store.emailAddresses()).toContain("TEAM@example.com"); });
	it("accepts a mixture of Account instances and ids when selecting aliases", () => { expect(store.aliasesFor([store.accountForId("blank"), "signed"]).map((item) => item.accountId)).toEqual(["signed", "signed", "signed", "blank"]); });
	it("returns a new alias array after cache invalidation", () => { const first = store.aliases(); store._caches = {}; expect(store.aliases()).not.toBe(first); });
	it("reflects an updated signature after cache invalidation", () => { store.aliases(); store.accountForId("signed").signature = "Updated"; store._caches = {}; expect(store.aliasesFor(["signed"])[0].signature).toBe("Updated"); });
	it("keeps the cached contact signature until invalidation", () => { const contact = store.aliasesFor(["signed"])[0]; store.accountForId("signed").signature = "Updated"; expect(store.aliasesFor(["signed"])[0]).toBe(contact); });
	it("throws when an account has a null aliases collection", () => { store.accountForId("signed").aliases = null; store._caches = {}; expect(() => store.aliases()).toThrow(TypeError); });
	it("propagates malformed aliases through email address collection", () => { store.accountForId("signed").aliases = null; store._caches = {}; expect(() => store.emailAddresses()).toThrow(TypeError); });
	it("throws when aliasesFor receives no selection array", () => { expect(() => store.aliasesFor()).toThrow(TypeError); });
});
