import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => {
	class Emitter {
		constructor() { this.events = new Map(); }
		once(name, fn) { this.events.set(name, fn); }
		emit(name, ...args) { const fn = this.events.get(name); if (fn) { this.events.delete(name); fn(...args); } }
	}
	class NylasStore {
		constructor() { this._emitter = new Emitter(); }
		listenTo(...args) { return m.listenTo(...args); }
		listen(callback) { m.listeners.push(callback); return () => { m.listeners = m.listeners.filter((fn) => fn !== callback); }; }
		trigger(...args) { return m.trigger(...args); }
		setupEmitter() { if (!this._emitter) this._emitter = new Emitter(); }
	}
	class Scheduler {
		constructor(options) { this.options = options; this.reset = vi.fn(); }
		nextDelay() { return m.nextDelay; }
	}
	class SendDraftTask { constructor(clientId) { this.clientId = clientId; } }
	const action = () => ({ listen: vi.fn(() => vi.fn()) });
	const actions = {
		focusContact: action(), checkOnlineStatus: action(), addSignature: action(),
		removeSignature: action(), updateSignature: action(), selectSignature: action(),
		toggleAccount: action(), queueTask: vi.fn(),
	};
	const databaseStore = {
		addMutationHook: vi.fn(), listen: vi.fn(), inTransaction: vi.fn((fn) => Promise.resolve(fn())),
		_query: vi.fn(() => Promise.resolve([])), findBy: vi.fn(), findAll: vi.fn(),
	};
	const messageStore = { itemsLoading: vi.fn(() => false), threadId: vi.fn(), thread: vi.fn(), items: vi.fn(() => []) };
	const accountStore = { accountIds: vi.fn(() => []), accountForId: vi.fn(() => null), accounts: vi.fn(() => []) };
	const categoryStore = { categories: vi.fn(() => []) };
	const composer = { extensions: vi.fn(() => []), listen: vi.fn(() => vi.fn()) };
	const utils = {
		toEquivalentEmailForm: vi.fn((email) => email.toLowerCase()), emailHasCommonDomain: vi.fn(() => true),
		emailsHaveSameDomain: vi.fn(() => false), generateTempId: vi.fn(() => "sig-new"),
	};
	const underscore = {
		debounce: (fn) => function (...args) { return fn.apply(this, args); },
		throttle: (fn) => function (...args) { return fn.apply(this, args); },
		sortBy: (values, key) => [...values].sort((a, b) => a[key] - b[key]), values: Object.values,
		map: (values, fn) => values.map(fn), difference: (a, b) => a.filter((x) => !b.includes(x)),
		isEqual: (a, b) => JSON.stringify(a) === JSON.stringify(b), isString: (v) => typeof v === "string",
		isFunction: (v) => typeof v === "function", findWhere: (values, attrs) => values.find((v) => Object.keys(attrs).every((k) => v[k] === attrs[k])),
		without: (values, item) => values.filter((v) => v !== item),
	};
	const rx = { Observable: { fromQuery: vi.fn(() => ({ subscribe: vi.fn((fn) => { fn(null); return { dispose: vi.fn() }; }) })) } };
	const remote = { app: { quit: vi.fn() } };
	return {
		NylasStore, Scheduler, SendDraftTask, actions, databaseStore, messageStore, accountStore, categoryStore,
		composer, utils, underscore, rx, remote, electron: { remote }, isOnline: vi.fn(() => Promise.resolve(true)),
		Thread: class Thread {}, Contact: class Contact {}, listenTo: vi.fn(), trigger: vi.fn(), listeners: [], nextDelay: 2000,
	};
});

vi.mock("underscore", () => ({ default: m.underscore, ...m.underscore }));
vi.mock("underscore.string", () => ({ default: { dasherize: (s) => s.replace(/\s+/g, "-") }, dasherize: (s) => s.replace(/\s+/g, "-") }));
vi.mock("nylas-store", () => ({ default: m.NylasStore }));
vi.mock("rx-lite", () => ({ default: m.rx, ...m.rx }));
vi.mock("is-online", () => ({ default: m.isOnline }));
vi.mock("isomorphic-core", () => ({ default: { ExponentialBackoffScheduler: m.Scheduler }, ExponentialBackoffScheduler: m.Scheduler }));
vi.mock("electron", () => ({ default: m.electron, ...m.electron }));
vi.mock("@electron/remote", () => ({ default: m.remote, ...m.remote, remote: m.remote }));
vi.mock("../src/flux/actions.js", () => ({ default: m.actions, ...m.actions }));
vi.mock("../src/flux/models/utils.js", () => ({ default: m.utils }));
vi.mock("../src/flux/models/thread.js", () => ({ default: m.Thread }));
vi.mock("../src/flux/models/contact.js", () => ({ default: m.Contact }));
vi.mock("../src/flux/stores/message-store.js", () => ({ default: m.messageStore }));
vi.mock("../src/flux/stores/account-store.js", () => ({ default: m.accountStore }));
vi.mock("../src/flux/stores/category-store.js", () => ({ default: m.categoryStore }));
vi.mock("../src/flux/stores/database-store.js", () => ({ default: m.databaseStore }));
vi.mock("../src/flux/tasks/send-draft-task.js", () => ({ default: m.SendDraftTask }));
vi.mock("../src/registries/extension-registry.js", () => ({ default: { Composer: m.composer }, Composer: m.composer }));
vi.mock("nylas-exports", () => ({ default: { Utils: m.utils, Actions: m.actions, AccountStore: m.accountStore }, Utils: m.utils, Actions: m.actions, AccountStore: m.accountStore }));

const configValues = new Map();
globalThis.NylasEnv = {
	isWorkWindow: vi.fn(() => true), isMainWindow: vi.fn(() => false), inSpecMode: vi.fn(() => true), inDevMode: vi.fn(() => false),
	reportError: vi.fn(), config: {
		get: vi.fn((key) => configValues.get(key)), set: vi.fn((key, value) => configValues.set(key, value)), unset: vi.fn(),
		onDidChange: vi.fn(() => ({ dispose: vi.fn() })),
	}, getConfigDirPath: vi.fn(() => "/config"), getPath: vi.fn(() => "/tmp"), getVersion: vi.fn(() => "0.0.0"),
};

const focused = (await import("../src/flux/stores/focused-contacts-store.js")).default;
const threadCountsImport = await import("../src/flux/stores/thread-counts-store.js");
const threadCounts = threadCountsImport.default?.default || threadCountsImport.default || threadCountsImport;
const folders = (await import("../src/flux/stores/folder-sync-progress-store.js")).default;
const online = (await import("../src/flux/stores/online-status-store.js")).default;
const sends = (await import("../src/flux/stores/send-actions-store.js")).default;
const signatures = (await import("../src/flux/stores/signature-store.js")).default;

beforeEach(() => {
	vi.clearAllMocks(); configValues.clear(); configValues.set("nylas.threadCountsValid", true); m.listeners = [];
	m.accountStore.accountIds.mockReturnValue([]); m.accountStore.accounts.mockReturnValue([]); m.accountStore.accountForId.mockReturnValue(null);
	m.categoryStore.categories.mockReturnValue([]); m.messageStore.items.mockReturnValue([]); m.composer.extensions.mockReturnValue([]);
});

describe("focused contacts store", () => {
	it("starts with no contacts", () => expect(new focused.constructor().sortedContacts()).toEqual([]));
	it("returns an empty thread list by default", () => expect(new focused.constructor().focusedContactThreads()).toEqual([]));
	it("ignores contacts without email addresses", () => { const store = new focused.constructor(); store._assignScore({ name: "No Email" }, 4); expect(store._contactScores).toEqual({}); });
	it("deduplicates equivalent email addresses", () => { const store = new focused.constructor(); store._assignScore({ email: "A@B.COM" }, 4); store._assignScore({ email: "a@b.com" }, 9); expect(Object.values(store._contactScores)[0].score).toBe(4); });
	it("penalizes the account owner to zero", () => { m.accountStore.accountForId.mockReturnValue({ emailAddress: "me@test.com" }); const store = new focused.constructor(); store._currentThread = { accountId: "a" }; expect(store._calculatePenalties({ email: "ME@test.com" }, 8)).toBe(8); });
	it("scores draft recipients above ordinary recipients", () => { m.messageStore.items.mockReturnValue([{ draft: false, from: [{ email: "from@test.com" }] }, { draft: true, to: [{ email: "to@test.com" }] }]); const store = new focused.constructor(); store._scoreAllParticipants(); expect(store._contactScores["to@test.com"].score).toBeGreaterThan(store._contactScores["from@test.com"].score); });
	it("clears a focused contact", () => { const store = new focused.constructor(); store._currentFocusedContact = { email: "x" }; store._onFocusContact(null); expect(store.focusedContact()).toBeNull(); });
});

describe("thread counts store", () => {
	it("returns null for an unknown unread count", () => expect(new threadCounts.constructor().unreadCountForCategoryId("x")).toBeNull());
	it("returns stored total counts", () => { const store = new threadCounts.constructor(); store._counts.x = { unread: 2, total: 7 }; expect(store.totalCountForCategoryId("x")).toBe(7); });
});

describe("folder sync progress store", () => {
	it("starts with no account state", () => expect(new folders.constructor().getSyncState()).toEqual({}));
	it("reports an absent category list as unsynced", () => expect(new folders.constructor().isCategoryListSynced("a")).toBe(false));
	it("reports progress as a synced category list", () => { const store = new folders.constructor(); store._statesByAccount.a = { folderSyncProgress: { Inbox: { progress: 0.1 } } }; expect(store.isCategoryListSynced("a")).toBe(true); });
	it("requires every folder to finish", () => { const store = new folders.constructor(); store._statesByAccount.a = { folderSyncProgress: { Inbox: { progress: 1 }, Archive: { progress: 0.5 } } }; expect(store.isSyncCompleteForAccount("a")).toBe(false); });
	it("can check one completed folder", () => { const store = new folders.constructor(); store._statesByAccount.a = { folderSyncProgress: { Inbox: { progress: 1 } } }; expect(store.isSyncCompleteForAccount("a", "Inbox")).toBe(true); });
	it("removes state for deleted accounts", () => { const store = new folders.constructor(); store._statesByAccount.a = {}; store._onAccountsChanged(); expect(store.getSyncState()).toEqual({}); });
	it("maps folder sync fields into account state", () => { m.accountStore.accountIds.mockReturnValue(["a"]); m.categoryStore.categories.mockReturnValue([{ object: "folder", name: "Inbox", syncProgress: { approxPercentComplete: 0.5, approxTotal: 20, oldestProcessedDate: "2020-01-01" } }, { object: "label", name: "Skip" }]); const store = new folders.constructor(); store._onCategoriesChanged(); expect(store.getSyncState().a.folderSyncProgress.Inbox).toMatchObject({ progress: 0.5, total: 20, oldestProcessedDate: new Date("2020-01-01") }); });
	it("resolves immediately when all accounts are complete", async () => { const store = new folders.constructor(); store._statesByAccount.a = { folderSyncProgress: { Inbox: { progress: 1 } } }; await expect(store.whenSyncComplete()).resolves.toBeUndefined(); });
});

describe("online status store", () => {
	it("starts online", () => expect(new online.constructor().isOnline()).toBe(true));
	it("starts with no retry delay", () => expect(new online.constructor().retryingInSeconds()).toBe(0));
	it("triggers when online state changes", async () => { m.isOnline.mockResolvedValueOnce(false); const store = new online.constructor(); await store._setNextOnlineState(); expect(store.isOnline()).toBe(false); expect(m.trigger).toHaveBeenCalled(); });
	it("does not trigger when online state is unchanged", async () => { m.isOnline.mockResolvedValueOnce(true); const store = new online.constructor(); await store._setNextOnlineState(); expect(m.trigger).not.toHaveBeenCalled(); });
	it("clears retry seconds before checking", async () => { const store = new online.constructor(); store._retryingInSeconds = 4; vi.spyOn(store, "_setNextOnlineState").mockResolvedValue(); await store._checkOnlineStatus(); expect(store.retryingInSeconds()).toBe(0); clearTimeout(store._checkOnlineTimeout); });
});

describe("send actions store", () => {
	it("always exposes the default send action", () => expect(new sends.constructor().sendActionForKey("send").title).toBe("Send"));
	it("queues a send draft task", () => { const store = new sends.constructor(); store.DefaultSendAction.performSendAction({ draft: { clientId: "d1" } }); expect(m.actions.queueTask.mock.calls[0][0]).toMatchObject({ clientId: "d1" }); });
	it("derives extension config keys from titles", () => { m.composer.extensions.mockReturnValue([{ name: "Later", sendActions: () => [{ title: "Send Later", performSendAction: vi.fn(), isAvailableForDraft: () => true }] }]); expect(new sends.constructor().sendActionForKey("send-later").title).toBe("Send Later"); });
	it("reports malformed extension actions", () => { m.composer.extensions.mockReturnValue([{ name: "Bad", sendActions: () => [{ title: 3 }] }]); new sends.constructor(); expect(NylasEnv.reportError).toHaveBeenCalled(); });
	it("filters unavailable actions", () => { m.composer.extensions.mockReturnValue([{ name: "Later", sendActions: () => [{ title: "Later", performSendAction: vi.fn(), isAvailableForDraft: () => false }] }]); expect(new sends.constructor().availableSendActionsForDraft({})).toHaveLength(1); });
	it("falls back to send for an unavailable preference", () => { m.composer.extensions.mockReturnValue([{ name: "Later", sendActions: () => [{ title: "Later", performSendAction: vi.fn(), isAvailableForDraft: () => false }] }]); configValues.set("core.sending.defaultSendType", "later"); expect(new sends.constructor().orderedSendActionsForDraft({}).preferred.configKey).toBe("send"); });
});

describe("signature store", () => {
	const makeStore = () => { const store = new signatures.constructor(); store.signatures = {}; store.defaultSignatures = {}; return store; };
	it("returns the built-in signature for an email without a default", () => expect(makeStore().signatureForEmail("a@test.com")).toMatchObject({ id: "default", title: "Default" }));
	it("adds and selects a signature", () => { const store = makeStore(); store._onAddSignature("Personal"); expect(store.selectedSignature()).toMatchObject({ id: "sig-new", title: "Personal" }); });
	it("edits a signature in place", () => { const store = makeStore(); store.signatures.a = { title: "Old", body: "old" }; store._onEditSignature({ title: "New", body: "new" }, "a"); expect(store.signatures.a).toEqual({ title: "New", body: "new" }); });
	it("removes a signature and selects the next one", () => { const store = makeStore(); store.signatures = { a: { id: "a" }, b: { id: "b" } }; store._onRemoveSignature({ id: "a" }); expect(store.selectedSignatureId).toBe("b"); });
	it("selects the current signature for an account", () => { const store = makeStore(); store.selectedSignatureId = "a"; store._onToggleAccount("me@test.com"); expect(store.getDefaults()["me@test.com"]).toBe("a"); });
	it("clears an account that already uses the selected signature", () => { const store = makeStore(); store.selectedSignatureId = "a"; store.defaultSignatures["me@test.com"] = "a"; store._onToggleAccount("me@test.com"); expect(store.getDefaults()["me@test.com"]).toBeNull(); });
	it("backfills legacy account signatures on activation", () => { m.accountStore.accounts.mockReturnValue([{ id: "1", label: "Work", emailAddress: "me@test.com" }]); configValues.set("nylas.account-1.signature", "Regards"); const store = new signatures.constructor(); store.activate(); expect(store.getSignatures()["sig-new"]).toMatchObject({ title: "Work", body: "Regards" }); expect(NylasEnv.config.unset).toHaveBeenCalledWith("nylas.account-1.signature"); });
});
