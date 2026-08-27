import { beforeEach, describe, expect, it, vi } from "vitest";
import registerHealthRoutes from "../../src/local-api/routes/health.js";
import SyncActivity from "../../src/shared/sync-activity.js";

describe("health routes", () => {
	let routes;

	beforeEach(() => {
		routes = [];
		registerHealthRoutes({ route: (definition) => routes.push(definition) });
	});

	it("registers global and per-account endpoints", () => {
		expect(routes.map((route) => [route.method, route.path])).toEqual([
			["GET", "/health"],
			["GET", "/health/{accountId}"],
		]);
	});

	it("serializes all activity and activity for one account", () => {
		SyncActivity._lastActivityByAccountId = {
			a: { time: 10, activity: "syncing" },
		};
		const reply = vi.fn();
		routes[0].handler({ logger: { error: vi.fn() } }, reply);
		expect(reply).toHaveBeenCalledWith(
			JSON.stringify({ a: { time: 10, activity: "syncing" } }),
		);
		reply.mockClear();
		routes[1].handler(
			{ params: { accountId: "missing" }, logger: { error: vi.fn() } },
			reply,
		);
		expect(reply).toHaveBeenCalledWith("{}");
	});

	it("reports retrieval failures through the request logger and reply", () => {
		const error = new Error("unhealthy");
		const logger = { error: vi.fn() };
		const reply = vi.fn();
		vi.spyOn(SyncActivity, "getLastSyncActivity").mockImplementation(() => {
			throw error;
		});
		routes[0].handler({ logger }, reply);
		expect(logger.error).toHaveBeenCalledWith(
			error,
			"Could not retrieve last sync activity",
		);
		expect(reply).toHaveBeenCalledWith(error);
	});
});
