import Hapi from "@hapi/hapi";
import Boom from "@hapi/boom";
import { DatabaseConnector } from "cloud-core";

const MAX_TIME_BETWEEN_ITERATIONS = 5 * 60 * 1000;

/**
 * Build (but do not start) the watchdog server. Split out from
 * setupMonitoring so tests can exercise routes with server.inject().
 */
export function buildMonitoringServer(logger) {
	const server = new Hapi.Server({
		debug: false,
		router: {
			stripTrailingSlash: true,
		},
	});

	server.route({
		method: "GET",
		path: "/ping",
		options: { auth: false },
		handler: async (request, h) => {
			logger.info("---> Ping DB");
			try {
				const db = await DatabaseConnector.forShared();
				await db.sequelize.query("SELECT 1");

				if (new Date() - global.lastRun >= MAX_TIME_BETWEEN_ITERATIONS) {
					throw Boom.badImplementation("Main loop seems to be stuck.");
				}
				return h.response("DB Okay");
			} catch (err) {
				throw Boom.boomify(err, { statusCode: 500 });
			}
		},
	});

	return server;
}

export async function setupMonitoring(logger) {
	const server = buildMonitoringServer(logger);
	await server.start();
	console.info("Watchdog server running.");
}
