import Hapi from "@hapi/hapi";
import HapiBasicAuth from "@hapi/basic";
import Inert from "@hapi/inert";
import Vision from "@hapi/vision";
import HapiSwagger from "hapi-swagger";
import Handlebars from "handlebars";
import Joi from "joi";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { Logger } from "cloud-core";
import Package from "./package.json" with { type: "json" };
import { apiAuthenticate } from "./src/authentication";
import sentryPlugin from "./src/sentry";
import registerAuthRoutes from "./src/routes/auth";
import registerAdminRoutes from "./src/routes/admin";
import registerPingRoutes from "./src/routes/ping";
import registerDeltaRoutes from "./src/routes/delta";
import registerMetadataRoutes from "./src/routes/metadata";
import registerBlobsRoutes from "./src/routes/blobs";
import registerHoneycombRoutes from "./src/routes/honeycomb";
import registerLinkTrackingRoutes from "./src/routes/link-tracking";
import registerOpenTrackingRoutes from "./src/routes/open-tracking";
import registerStaticRoutes from "./src/routes/static";
import registerLoggerDecorator from "./src/decorators/logger";
import registerErrorFormatDecorator from "./src/decorators/error-format";

const dirname = path.dirname(fileURLToPath(import.meta.url));

export async function createServer() {
	global.Logger ||= Logger.createLogger("n1cloud-api");
	const server = Hapi.server({
		port: Number(process.env.PORT) || 3000,
		host: process.env.HOST || "0.0.0.0",
		debug: { request: ["error"] },
		router: { stripTrailingSlash: true },
	});
	server.validator(Joi);
	server.events.on("request", (request, event, tags) => {
		if (tags.received) request.app.startedAt = performance.now();
		if (tags.error && event.error)
			request.logger.info(
				{
					http_status: request.response?.statusCode,
					request_time_ms: performance.now() - request.app.startedAt,
					error: event.error.name,
					error_message: event.error.message,
					error_tb: event.error.stack,
				},
				"request handled",
			);
	});
	server.events.on("response", (request) => {
		if (request.response?.statusCode < 500)
			request.logger.info(
				{
					http_status: request.response.statusCode,
					request_time_ms: performance.now() - request.app.startedAt,
				},
				"request handled",
			);
	});
	await server.register([
		Inert,
		Vision,
		HapiBasicAuth,
		{
			plugin: HapiSwagger,
			options: {
				info: { title: "N1-Cloud API Documentation", version: Package.version },
			},
		},
	]);
	server.auth.strategy("api-consumer", "basic", { validate: apiAuthenticate });
	server.auth.strategy("static-password", "basic", {
		validate: async (_request, username, password) => ({
			isValid: username === "nylas" && password === "dressingontheside",
			credentials: {},
		}),
	});
	server.auth.default("api-consumer");
	registerLoggerDecorator(server);
	registerErrorFormatDecorator(server);
	for (const register of [
		registerAuthRoutes,
		registerAdminRoutes,
		registerPingRoutes,
		registerDeltaRoutes,
		registerMetadataRoutes,
		registerBlobsRoutes,
		registerHoneycombRoutes,
		registerLinkTrackingRoutes,
		registerOpenTrackingRoutes,
		registerStaticRoutes,
	])
		register(server);
	if (process.env.SENTRY_DSN)
		await server.register({
			plugin: sentryPlugin,
			options: { dsn: process.env.SENTRY_DSN },
		});
	server.views({
		engines: { html: Handlebars },
		relativeTo: dirname,
		path: "src/views",
		layoutPath: "src/views/layout",
		layout: "default",
	});
	return server;
}

export async function start() {
	const server = await createServer();
	await server.start();
	global.Logger.info({ url: server.info.uri }, "API running");
	return server;
}

if (process.env.NODE_ENV !== "test")
	start().catch((error) => {
		global.Logger?.error(error);
		process.exitCode = 1;
	});
