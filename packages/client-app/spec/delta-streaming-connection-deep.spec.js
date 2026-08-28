import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => {
	const subscriptions = [vi.fn(), vi.fn(), vi.fn()];
	const application = { rebuildDatabase: vi.fn() };
	class BackoffScheduler {
		constructor(options) { this.options = options; m.schedulers.push(this); }
		nextDelay() { return m.nextDelay(); }
		reset() { return m.resetBackoff(); }
	}
	class LongConnection {
		constructor(options) { this.options = options; this.start = vi.fn(); this.close = vi.fn(); this.end = vi.fn(); m.connections.push(this); }
	}
	LongConnection.Status = { Closed: "closed", Connected: "connected" };
	class APIError extends Error {
		constructor(message, options = {}) { super(message); Object.assign(this, options); }
		shouldReportError() { return this.reportable; }
	}
	return {
		subscriptions, application, BackoffScheduler, LongConnection, APIError,
		schedulers: [], connections: [],
		nextDelay: vi.fn(() => 2500), resetBackoff: vi.fn(), debounce: vi.fn((fn) => function (...args) { return fn.apply(this, args); }),
		retryListen: vi.fn(() => subscriptions[0]), onlineListen: vi.fn(() => subscriptions[1]), identityListen: vi.fn(() => subscriptions[2]),
		identity: vi.fn(() => ({ id: "identity-1" })), isOnline: vi.fn(() => true), updateAccount: vi.fn(),
		process: vi.fn(), findJSONBlob: vi.fn(), inTransaction: vi.fn(), persistJSONBlob: vi.fn(), reportError: vi.fn(),
	};
});

vi.mock("node:module", () => {
	const createRequire = () => (id) => id === "@electron/remote" ? { default: m.application, getGlobal: () => m.application } : {};
	return { default: { createRequire }, createRequire };
});
vi.mock("underscore", () => {
	const underscore = { debounce: m.debounce, last: (values) => values[values.length - 1] };
	return { default: underscore, ...underscore };
});
vi.mock("isomorphic-core", () => ({ default: { ExponentialBackoffScheduler: m.BackoffScheduler }, ExponentialBackoffScheduler: m.BackoffScheduler }));
vi.mock("../src/n1-cloud-api.js", () => ({ default: { name: "cloud-api" } }));
vi.mock("../src/flux/actions.js", () => ({ default: { retryDeltaConnection: { listen: m.retryListen }, updateAccount: m.updateAccount } }));
vi.mock("../src/flux/errors.js", () => ({ default: { APIError: m.APIError }, APIError: m.APIError }));
vi.mock("../src/flux/models/account.js", () => ({ default: { N1_CLOUD_STATE_RUNNING: "running", N1_CLOUD_STATE_AUTH_FAILED: "auth-failed" } }));
vi.mock("../src/services/delta-processor.js", () => ({ default: { process: m.process } }));
vi.mock("../src/flux/stores/database-store.js", () => ({ default: { findJSONBlob: m.findJSONBlob, inTransaction: m.inTransaction } }));
vi.mock("../src/flux/stores/identity-store.js", () => ({ default: { identity: m.identity, listen: m.identityListen } }));
vi.mock("../src/flux/stores/online-status-store.js", () => ({ default: { isOnline: m.isOnline, listen: m.onlineListen } }));
vi.mock("../src/flux/nylas-long-connection.js", () => ({ default: m.LongConnection }));
vi.mock("electron", () => { const remote = { getGlobal: () => m.application }; const electron = { remote }; return { default: electron, ...electron }; });
vi.mock("@electron/remote", () => { const remote = { getGlobal: () => m.application }; return { default: remote, ...remote, remote }; });

globalThis.NylasEnv = {
	isWorkWindow: vi.fn(() => true), inSpecMode: vi.fn(() => true), inDevMode: vi.fn(() => false),
	reportError: m.reportError, config: { get: vi.fn(), onDidChange: vi.fn() },
	getConfigDirPath: vi.fn(() => "/config"), getPath: vi.fn(() => "/tmp"), getVersion: vi.fn(() => "0.0.0"),
};

const { default: DeltaStreamingConnection } = await import("../src/services/delta-streaming-connection.js");

describe("DeltaStreamingConnection deep lifecycle", () => {
	let connection;
	beforeEach(() => {
		vi.clearAllMocks();
		vi.useRealTimers();
		m.connections.length = 0;
		m.schedulers.length = 0;
		m.identity.mockReturnValue({ id: "identity-1" });
		m.isOnline.mockReturnValue(true);
		m.nextDelay.mockReturnValue(2500);
		m.findJSONBlob.mockResolvedValue(null);
		m.persistJSONBlob.mockResolvedValue(undefined);
		m.inTransaction.mockImplementation((fn) => fn({ persistJSONBlob: m.persistJSONBlob }));
		connection = new DeltaStreamingConnection({ id: "account-1" });
	});

	it("registers all lifecycle listeners", () => { expect([m.retryListen, m.onlineListen, m.identityListen].every((fn) => fn.mock.calls.length === 1)).toBe(true); });
	it("configures the retry scheduler limits", () => { expect(m.schedulers[0].options).toEqual({ baseDelay: 1000, maxDelay: 600000 }); });

	it("resets reconnect backoff after results", () => { connection._onResults([]); expect(m.resetBackoff).toHaveBeenCalledOnce(); });
	it("accepts an omitted delta batch", () => { connection._onResults(); expect(m.process).toHaveBeenCalledWith([], { source: "n1Cloud" }); });
	it("reports non API connection errors", () => { const error = new Error("offline"); connection._onError(error); expect(m.reportError).toHaveBeenCalledWith(error); });
	it("reports reportable API errors", () => { const error = new m.APIError("server", { reportable: true }); connection._onError(error); expect(m.reportError).toHaveBeenCalledWith(error); });
	it("suppresses non-reportable API errors", () => { connection._onError(new m.APIError("server", { reportable: false })); expect(m.reportError).not.toHaveBeenCalled(); });
	it("loads state from the current storage key", async () => { m.findJSONBlob.mockResolvedValueOnce({ cursor: 12, status: "connected" }); await expect(connection._loadState()).resolves.toEqual({ cursor: 12, status: "connected" }); });
	it("migrates state from the legacy storage key", async () => { m.findJSONBlob.mockResolvedValueOnce(null).mockResolvedValueOnce({ deltaCursors: { n1Cloud: 13 }, deltaStatus: { n1Cloud: "closed" } }); await expect(connection._loadState()).resolves.toEqual({ cursor: 13, status: "closed" }); });
	it("returns empty state when neither storage key exists", async () => { await expect(connection._loadState()).resolves.toEqual({ cursor: undefined, status: undefined }); });
	it("does not open a transaction before state loads", async () => { connection._state = null; await connection._writeState(); expect(m.inTransaction).not.toHaveBeenCalled(); });
});
