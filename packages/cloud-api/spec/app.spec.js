import { afterEach, describe, expect, it, vi } from "vitest";
const logger = vi.hoisted(() => ({
	info: vi.fn(),
	error: vi.fn(),
	child: vi.fn(() => ({ info: vi.fn(), forAccount: vi.fn() })),
	forAccount: vi.fn(),
}));
vi.mock("cloud-core", () => ({
	Logger: { createLogger: vi.fn(() => logger) },
	DatabaseConnector: { forShared: vi.fn() },
	GmailOAuthHelpers: {},
}));
vi.mock("isomorphic-core", () => ({
	AuthHelpers: {
		imapAuthRouteConfig: () => ({}),
		imapAuthHandler: () => vi.fn(),
	},
	IMAPErrors: {},
	DeltaStreamBuilder: {
		DELTA_CONNECTION_TIMEOUT_MS: 1,
		buildAPIStream: vi.fn(),
	},
	MetricsReporter: { sendToHoneycomb: vi.fn() },
}));

describe("application bootstrap", () => {
	afterEach(() => {
		delete global.Logger;
		vi.unstubAllEnvs();
	});
	it("creates a configured server and registers every route", async () => {
		vi.stubEnv("BUCKET_NAME", "bucket");
		vi.stubEnv("BUCKET_AWS_ACCESS_KEY_ID", "key");
		vi.stubEnv("BUCKET_AWS_SECRET_ACCESS_KEY", "secret");
		const { createServer } = await import("../app");
		const server = await createServer();
		const paths = server.table().map((route) => route.path);
		expect(paths).toEqual(
			expect.arrayContaining([
				"/ping/basic",
				"/metadata",
				"/blobs",
				"/static/{file*}",
			]),
		);
		await server.stop();
	});
});
