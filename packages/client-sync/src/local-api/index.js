/* eslint import/no-dynamic-require: 0 */
/* eslint global-require: 0 */
import Hapi from "@hapi/hapi";
import HapiSwagger from "hapi-swagger";
import HapiBasicAuth from "@hapi/basic";
import Inert from "@hapi/inert";
import Vision from "@hapi/vision";
import Package from "../../package.json";
import fs from "node:fs";
import path from "node:path";
import LocalDatabaseConnector from "../shared/local-database-connector.js";

const port = NylasEnv.inDevMode() ? 1337 : 2578;

const server = new Hapi.Server({
	port,
	router: {
		stripTrailingSlash: true,
	},
});

const plugins = [
	{ plugin: Inert },
	{ plugin: Vision },
	{ plugin: HapiBasicAuth },
	{
		plugin: HapiSwagger,
		options: {
			info: {
				title: "Nylas API Documentation",
				version: Package.version,
			},
		},
	},
];

let sharedDb = null;

const validate = async (request, username, password) => {
	let db;
	if (sharedDb) {
		db = sharedDb;
	} else {
		db = await LocalDatabaseConnector.forShared();
		sharedDb = db;
	}

	const { AccountToken } = db;
	const token = await AccountToken.findOne({
		where: {
			value: username,
		},
	});
	if (!token) {
		return { isValid: false, credentials: {} };
	}
	const account = await token.getAccount();
	if (!account) {
		return { isValid: false, credentials: {} };
	}
	request.logger = request.logger.forAccount(account);
	return { isValid: true, credentials: account };
};

const attach = async (directory) => {
	const routesDir = path.join(__dirname, directory);
	for (const filename of fs.readdirSync(routesDir)) {
		if (filename.endsWith(".js")) {
			const routeFactory = (
				await import(`file://${path.join(routesDir, filename)}`)
			).default;
			routeFactory(server);
		}
	}
};

export async function startLocalAPI() {
	await server.register(plugins);

	await attach("./routes");
	await attach("./decorators");

	server.auth.strategy("api-consumer", "basic", { validate });
	server.auth.default("api-consumer");

	await server.start();
	global.Logger.log("API running", { url: server.info.uri });
	return server;
}

if (process.env.NYLAS_START_LOCAL_API === "1") {
	startLocalAPI();
}
