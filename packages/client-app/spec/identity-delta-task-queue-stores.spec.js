import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	accountForId: vi.fn(),
	accountIds: vi.fn(() => []),
	findJSONBlob: vi.fn((key) => ({ key })),
	fromQuery: vi.fn(() => ({ subscribe: vi.fn() })),
	request: vi.fn(),
	start: vi.fn(),
	end: vi.fn(),
	dispose: vi.fn(),
	deepClone: vi.fn((value) => structuredClone(value)),
	generateTempId: vi.fn(() => "request-1"),
	willMakeAPIRequest: vi.fn(),
	didMakeAPIRequest: vi.fn(),
}));

vi.mock("nylas-store", () => ({
	default: class NylasStore {
		trigger = vi.fn();
		listenTo = vi.fn(() => vi.fn());
		stopListeningToAll = vi.fn();
	},
}));
vi.mock("rx-lite", () => ({
	default: { Observable: { fromQuery: mocks.fromQuery } },
	Observable: { fromQuery: mocks.fromQuery },
}));
vi.mock("../src/flux/stores/account-store.js", () => ({
	default: { accountIds: mocks.accountIds, accountForId: mocks.accountForId },
}));
vi.mock("../src/flux/stores/database-store.js", () => ({
	default: { findJSONBlob: mocks.findJSONBlob },
}));
vi.mock("../src/services/delta-streaming-connection.js", () => ({
	default: class DeltaStreamingConnection {
		constructor(account) { this.account = account; }
		start = mocks.start;
		end = mocks.end;
	},
}));
vi.mock("../src/flux/stores/task-queue.js", () => ({
	default: { JSONBlobStorageKey: "task-queue" },
	JSONBlobStorageKey: "task-queue",
}));
vi.mock("../src/request-compat.js", () => ({ default: mocks.request }));
vi.mock("electron", () => ({ ipcRenderer: { send: vi.fn() } }));
vi.mock("@electron/remote", () => ({ default: { app: { relaunch: vi.fn(), quit: vi.fn() } } }));
vi.mock("../src/flux/models/utils.js", () => ({
	default: { deepClone: mocks.deepClone, generateTempId: mocks.generateTempId },
}));
vi.mock("../src/flux/actions.js", () => ({
	default: {
		logoutNylasIdentity: {},
		willMakeAPIRequest: mocks.willMakeAPIRequest,
		didMakeAPIRequest: mocks.didMakeAPIRequest,
	},
}));

import identitySingleton from "../src/flux/stores/identity-store.js";
import deltaSingleton from "../src/flux/stores/delta-connection-store.js";
import taskQueueStatusSingleton from "../src/flux/stores/task-queue-status-store.js";

const subscriptionFor = (onValue = () => {}) => ({
	subscribe(callback) { onValue(callback); return { dispose: mocks.dispose }; },
});

describe("IdentityStore default interop", () => {
	let store;

	beforeEach(() => {
		vi.clearAllMocks();
		store = new identitySingleton.constructor();
	});

	it("starts without an identity", () => {
		expect(store.identity()).toBeNull();
		expect(store.identityId()).toBeNull();
	});

	it("rejects identities without an id", () => {
		store._onIdentityChanged({ token: "secret" });
		expect(store.identity()).toBeNull();
	});

	it("reports the identity id and pro access", () => {
		store._identity = { id: "id-1", has_pro_access: true };
		expect(store.identityId()).toBe("id-1");
		expect(store.hasProAccess()).toBe(true);
	});

	it("returns a clone rather than its mutable cache", () => {
		store._identity = { id: "id-1", profile: { name: "Ada" } };
		const value = store.identity();
		value.profile.name = "Grace";
		expect(store._identity.profile.name).toBe("Ada");
	});

	it("selects production billing for an unknown environment", () => {
		NylasEnv.config.get.mockReturnValue("production");
		store._onEnvChanged();
		expect(store.URLRoot).toBe("https://billing.nylas.com");
	});

	it("selects experimental billing", () => {
		NylasEnv.config.get.mockReturnValue("experimental");
		store._onEnvChanged();
		expect(store.URLRoot).toBe("https://billing-experimental.nylas.com");
	});

	it("refuses an SSO request when no identity is cached", async () => {
		await expect(store.fetchSingleSignOnURL("/settings")).rejects.toThrow("no identity");
	});

	it("refuses an SSO path without a leading slash", async () => {
		store._identity = { id: "id-1", token: "token" };
		await expect(store.fetchSingleSignOnURL("settings")).rejects.toThrow("leading slash");
	});
});

describe("DeltaConnectionStore", () => {
	let store;

	beforeEach(() => {
		vi.clearAllMocks();
		store = new deltaSingleton.constructor();
		NylasEnv.inSpecMode.mockReturnValue(true);
	});

	it("begins with no connection state", () => {
		expect(store.getDeltaConnectionStates()).toEqual({});
	});

	it("publishes a changed state", () => {
		store._triggerDebounced = vi.fn();
		store._updateState("a", { status: "connected" });
		expect(store.getDeltaConnectionStates().a).toEqual({ status: "connected" });
		expect(store._triggerDebounced).toHaveBeenCalledOnce();
	});

	it("does not publish an equal state", () => {
		store._triggerDebounced = vi.fn();
		store._connectionStatesByAccountId.a = { status: "connected" };
		store._updateState("a", { status: "connected" });
		expect(store._triggerDebounced).not.toHaveBeenCalled();
	});

	it("subscribes once per new account", () => {
		mocks.fromQuery.mockImplementation(() => subscriptionFor());
		store._setupConnectionStatusSubscriptions({ newAccountIds: ["a"] });
		store._setupConnectionStatusSubscriptions({ newAccountIds: ["a"] });
		expect(mocks.findJSONBlob).toHaveBeenCalledOnce();
		expect(store._connectionStatusSubscriptionsByAccountId.has("a")).toBe(true);
	});

	it("copies emitted query state", () => {
		const json = { cursor: 4, status: "connected" };
		mocks.fromQuery.mockImplementation(() => subscriptionFor((callback) => callback(json)));
		store._setupConnectionStatusSubscriptions({ newAccountIds: ["a"] });
		json.cursor = 5;
		expect(store.getDeltaConnectionStates().a.cursor).toBe(4);
	});

	it("disposes and removes state for a removed account", () => {
		store._triggerDebounced = vi.fn();
		store._connectionStatusSubscriptionsByAccountId.set("a", { dispose: mocks.dispose });
		store._connectionStatesByAccountId.a = { status: "connected" };
		store._setupConnectionStatusSubscriptions({ removedAccountIds: ["a"] });
		expect(mocks.dispose).toHaveBeenCalledOnce();
		expect(store.getDeltaConnectionStates().a).toBeUndefined();
	});

	it("does not build streaming connections in spec mode", async () => {
		await store._setupDeltaStreamingConnections({ newAccountIds: ["a"] });
		expect(mocks.start).not.toHaveBeenCalled();
	});

	it("starts and records a streaming connection outside spec mode", async () => {
		NylasEnv.inSpecMode.mockReturnValue(false);
		mocks.accountForId.mockReturnValue({ id: "a" });
		mocks.start.mockResolvedValue(undefined);
		await store._setupDeltaStreamingConnections({ newAccountIds: ["a"] });
		expect(mocks.start).toHaveBeenCalledOnce();
		expect(store._connectionsByAccountId.get("a").account).toEqual({ id: "a" });
	});

	it("ends and forgets a removed streaming connection", async () => {
		NylasEnv.inSpecMode.mockReturnValue(false);
		const connection = { end: mocks.end };
		store._connectionsByAccountId.set("a", connection);
		await store._setupDeltaStreamingConnections({ removedAccountIds: ["a"] });
		expect(mocks.end).toHaveBeenCalledOnce();
		expect(store._connectionsByAccountId.has("a")).toBe(false);
	});
});

describe("TaskQueueStatusStore default interop", () => {
	let store;
	let emitQueue;

	beforeEach(() => {
		vi.clearAllMocks();
		mocks.fromQuery.mockImplementation(() => subscriptionFor((callback) => { emitQueue = callback; }));
		store = new taskQueueStatusSingleton.constructor();
	});

	it("starts with an empty queue", () => {
		expect(store.queue()).toEqual([]);
	});

	it("uses an empty queue for a null persisted value", () => {
		emitQueue(null);
		expect(store.queue()).toEqual([]);
	});

	it("returns the persisted queue by reference", () => {
		const queue = [{ id: "one" }];
		emitQueue(queue);
		expect(store.queue()).toBe(queue);
	});

	it("matches tasks by string constructor name", () => {
		class SendTask {}
		const task = Object.assign(new SendTask(), { id: "one", accountId: "a" });
		emitQueue([task]);
		expect(store.tasksMatching("SendTask", { accountId: "a" })).toEqual([task]);
	});

	it("matches tasks using a constructor", () => {
		class SendTask {}
		const task = Object.assign(new SendTask(), { id: "one" });
		emitQueue([task]);
		expect(store.tasksMatching(SendTask)).toEqual([task]);
	});

	it("requires all fixture attributes to match", () => {
		class SendTask {}
		const task = Object.assign(new SendTask(), { accountId: "a", draftId: "d1" });
		emitQueue([task]);
		expect(store.tasksMatching(SendTask, { accountId: "a", draftId: "other" })).toEqual([]);
	});

	it("resolves local completion when the queued task disappears", async () => {
		const task = { id: "one" };
		const completed = store.waitForPerformLocal(task);
		emitQueue([]);
		await expect(completed).resolves.toBe(task);
	});

	it("keeps local completion pending while local work is incomplete", () => {
		const task = { id: "one" };
		store.waitForPerformLocal(task);
		emitQueue([{ id: "one", queueState: { localComplete: false } }]);
		expect(store._waitingLocals).toHaveLength(1);
	});

	it("resolves remote completion only after the task disappears", async () => {
		const task = { id: "one" };
		const completed = store.waitForPerformRemote(task);
		emitQueue([{ id: "one", queueState: { localComplete: true } }]);
		expect(store._waitingRemotes).toHaveLength(1);
		emitQueue([]);
		await expect(completed).resolves.toBe(task);
	});
});
