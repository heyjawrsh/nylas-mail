import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const forShared = vi.hoisted(() => vi.fn());
vi.mock("cloud-core", () => ({ DatabaseConnector: { forShared } }));
import registerAdminRoutes from "../src/routes/admin";
import { getMockServer, getToolkit } from "./helpers";

describe("admin dashboard", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2020-01-02T12:30:00Z"));
		vi.clearAllMocks();
	});
	afterEach(() => vi.useRealTimers());
	it("queries and bins each cloud job type with custom time options", async () => {
		const findAll = vi
			.fn()
			.mockResolvedValue([
				{ statusUpdatedAt: new Date("2020-01-02T11:30:00Z") },
			]);
		forShared.mockResolvedValue({ CloudJob: { findAll } });
		const server = getMockServer();
		registerAdminRoutes(server);
		const result = await server.routes[0].handler(
			{
				query: {
					tz: "UTC",
					from: "2020-01-02T10:00:00Z",
					to: "2020-01-02T13:00:00Z",
					step: "1",
					stepUnit: "hour",
				},
			},
			getToolkit(),
		);
		expect(result.template).toBe("admin");
		expect(result.context.jobData).toHaveLength(3);
		expect(findAll).toHaveBeenCalledTimes(3);
		expect(
			result.context.jobData[0].dayBins[0].hourBins.flatMap((bin) => bin.jobs),
		).toHaveLength(1);
	});
	it("uses default dashboard window when query options are absent", async () => {
		forShared.mockResolvedValue({
			CloudJob: { findAll: vi.fn().mockResolvedValue([]) },
		});
		const server = getMockServer();
		registerAdminRoutes(server);
		const result = await server.routes[0].handler({ query: {} }, getToolkit());
		expect(result.context.jobData.map((item) => item.typeId)).toEqual([
			"thread-snooze",
			"send-later",
			"send-reminders",
		]);
	});
});
