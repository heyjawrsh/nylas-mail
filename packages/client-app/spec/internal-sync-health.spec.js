import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	identity: vi.fn(() => ({ id: "identity" })),
	accounts: vi.fn(() => [{ id: "account" }]),
	recordUserEvent: vi.fn(),
	send: vi.fn(),
	run: vi.fn(),
}));

vi.mock("electron", () => ({ ipcRenderer: { send: mocks.send } }));
vi.mock("nylas-exports", () => ({
	IdentityStore: { identity: mocks.identity },
	AccountStore: { accounts: mocks.accounts },
	Actions: { recordUserEvent: mocks.recordUserEvent },
	NylasAPI: {},
	NylasAPIRequest: class NylasAPIRequest {
		constructor(options) { this.options = options; }
		run = mocks.run;
	},
}));

import syncHealthChecker from "../internal_packages/sync-health-checker/lib/sync-health-checker.js";

describe("sync health checker", () => {
	let checker;
	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	beforeEach(() => {
		vi.clearAllMocks();
		checker = new syncHealthChecker.constructor();
	});

	it("builds a health request for the first account", () => {
		const request = checker._buildRequest();
		expect(request.options.options).toEqual({ accountId: "account", path: "/health" });
	});

	it("does not request health without an identity", async () => {
		mocks.identity.mockReturnValueOnce(null);
		await checker._checkSyncHealth();
		expect(mocks.run).not.toHaveBeenCalled();
	});

	it("stores successful health activity", async () => {
		const activity = { account: { time: 10, activity: ["sync"] } };
		mocks.run.mockResolvedValue(activity);
		await checker._checkSyncHealth();
		expect(checker._lastSyncActivity).toBe(activity);
	});

	it("reports ordinary request errors with context", async () => {
		mocks.run.mockRejectedValue(new Error("timeout"));
		await checker._checkSyncHealth();
		expect(NylasEnv.reportError).toHaveBeenCalledWith(expect.objectContaining({ message: "Error checking sync health: timeout" }));
		expect(mocks.send).not.toHaveBeenCalled();
	});

	it("restarts the worker after a refused connection", async () => {
		mocks.run.mockRejectedValue(new Error("ECONNREFUSED"));
		await checker._checkSyncHealth();
		expect(mocks.send).toHaveBeenCalledWith("ensure-worker-window");
	});

	it("reports null activity when no prior health result exists", () => {
		checker._onWorkerWindowUnavailable();
		expect(mocks.recordUserEvent).toHaveBeenCalledWith("Worker Window Unavailable", { lastActivityPerAccount: null });
	});

	it("extracts most and least recent activity diagnostics", () => {
		vi.spyOn(Date, "now").mockReturnValue(1_000);
		checker._lastSyncActivity = {
			old: { time: 100, activity: "old activity" },
			fresh: { time: 900, activity: "fresh activity" },
		};
		checker._onWorkerWindowUnavailable();
		expect(mocks.recordUserEvent).toHaveBeenCalledWith("Worker Window Unavailable", expect.objectContaining({
			mostRecentActivityAccountId: "fresh", mostRecentDuration: 100,
			leastRecentActivityAccountId: "old", leastRecentDuration: 900,
		}));
	});

	it("starts only one interval and stop clears it", () => {
		vi.useFakeTimers();
		const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
		checker.start();
		const interval = checker._interval;
		checker.start();
		expect(checker._interval).toBe(interval);
		expect(warning).toHaveBeenCalledOnce();
		checker.stop();
		expect(checker._interval).toBeNull();
	});
});
