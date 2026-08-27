import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("cloud-core", () => {
	const DatabaseConnector = {
		forShared: vi.fn(async () => ({
			sequelize: { query: vi.fn(async () => []) },
		})),
	};
	return { DatabaseConnector };
});

import { buildMonitoringServer } from "../src/monitoring";
import { DatabaseConnector } from "cloud-core";

const logger = () => ({
	info: vi.fn(),
	debug: vi.fn(),
	warn: vi.fn(),
	error: vi.fn(),
});

describe("monitoring /ping", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		global.lastRun = new Date();
	});

	it("returns 200 when the DB responds and the loop is fresh", async () => {
		const server = buildMonitoringServer(logger());
		const res = await server.inject({ method: "GET", url: "/ping" });
		expect(res.statusCode).toBe(200);
		expect(res.result).toBe("DB Okay");
		expect(DatabaseConnector.forShared).toHaveBeenCalled();
	});

	it("returns 500 when the main loop looks stuck", async () => {
		global.lastRun = new Date(Date.now() - 10 * 60 * 1000);
		const server = buildMonitoringServer(logger());
		const res = await server.inject({ method: "GET", url: "/ping" });
		expect(res.statusCode).toBe(500);
	});

	it("returns 500 when the DB query fails", async () => {
		DatabaseConnector.forShared.mockRejectedValueOnce(new Error("db down"));
		const server = buildMonitoringServer(logger());
		const res = await server.inject({ method: "GET", url: "/ping" });
		expect(res.statusCode).toBe(500);
	});
});
