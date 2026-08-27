import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const forShared = vi.hoisted(() => vi.fn());
vi.mock("cloud-core", () => ({ DatabaseConnector: { forShared } }));
import registerLinkRoutes from "../src/routes/link-tracking";
import registerOpenRoutes from "../src/routes/open-tracking";
import { getMockServer, getToolkit } from "./helpers";

const routeFor = (register) => {
	const server = getMockServer();
	register(server);
	return server.routes[0];
};
const logger = { error: vi.fn() };

describe("tracking routes", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.clearAllMocks();
		vi.setSystemTime(new Date("2020-01-01T00:10:00Z"));
	});
	afterEach(() => vi.useRealTimers());
	it("tracks a link click and normalizes the redirect", async () => {
		const metadata = {
			value: {
				links: [{ url: "https://target", click_count: 1, click_data: [] }],
			},
			updateValue: vi.fn(),
		};
		forShared.mockResolvedValue({
			Metadata: { find: vi.fn().mockResolvedValue(metadata) },
		});
		const result = await routeFor(registerLinkRoutes).handler(
			{
				params: { messageId: "m", linkIdx: 0 },
				query: { redirect: "example.com", recipient: "a@b.com" },
				logger,
			},
			getToolkit(),
		);
		expect(result.location).toBe("https://example.com");
		expect(metadata.updateValue).toHaveBeenCalledWith({
			links: [expect.objectContaining({ click_count: 2 })],
		});
	});
	it("returns 404 without redirect and still redirects when metadata is absent", async () => {
		const route = routeFor(registerLinkRoutes);
		expect(
			(await route.handler({ params: {}, query: {}, logger }, getToolkit()))
				.statusCode,
		).toBe(404);
		forShared.mockResolvedValue({
			Metadata: { find: vi.fn().mockResolvedValue(null) },
		});
		expect(
			(
				await route.handler(
					{
						params: { messageId: "m", linkIdx: 0 },
						query: { redirect: "http://x" },
						logger,
					},
					getToolkit(),
				)
			).location,
		).toBe("http://x");
		expect(logger.error).toHaveBeenCalled();
	});
	it("deduplicates recent link clicks", async () => {
		const metadata = {
			value: {
				links: [
					{
						url: "x",
						click_count: 1,
						click_data: [{ timestamp: Date.now() / 1000, recipient: "a" }],
					},
				],
			},
			updateValue: vi.fn(),
		};
		forShared.mockResolvedValue({
			Metadata: { find: vi.fn().mockResolvedValue(metadata) },
		});
		await routeFor(registerLinkRoutes).handler(
			{
				params: { messageId: "m", linkIdx: 0 },
				query: { redirect: "https://x", recipient: "a" },
				logger,
			},
			getToolkit(),
		);
		expect(metadata.updateValue).not.toHaveBeenCalled();
	});
	it("records opens, deduplicates them, and always serves the pixel", async () => {
		const metadata = { value: null, updateValue: vi.fn() };
		const find = vi.fn().mockResolvedValue(metadata);
		forShared.mockResolvedValue({ Metadata: { find } });
		const h = {
			...getToolkit(),
			file: vi.fn(() => ({ header: vi.fn().mockReturnValue("pixel") })),
		};
		const route = routeFor(registerOpenRoutes);
		expect(
			await route.handler(
				{ params: { messageId: "m" }, query: { recipient: "a" }, logger },
				h,
			),
		).toBe("pixel");
		expect(metadata.updateValue).toHaveBeenCalledWith(
			expect.objectContaining({ open_count: 1 }),
		);
		metadata.value = {
			open_count: 1,
			open_data: [{ timestamp: Date.now() / 1000, recipient: "a" }],
		};
		metadata.updateValue.mockClear();
		await route.handler(
			{ params: { messageId: "m" }, query: { recipient: "a" }, logger },
			h,
		);
		expect(metadata.updateValue).not.toHaveBeenCalled();
		find.mockResolvedValueOnce(null);
		await route.handler({ params: { messageId: "m" }, query: {}, logger }, h);
		expect(logger.error).toHaveBeenCalled();
	});
});
