import { MetricsReporter } from "isomorphic-core";

export default function registerHoneycombRoutes(server) {
	server.route({
		method: "POST",
		path: "/ingest-metrics",
		handler: (request) => {
			MetricsReporter.sendToHoneycomb(request.payload);
			return { success: true };
		},
	});
}
