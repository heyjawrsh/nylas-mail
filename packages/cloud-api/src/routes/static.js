import Path from "node:path";
import { fileURLToPath } from "node:url";
const dirname = Path.dirname(fileURLToPath(import.meta.url));

export default function registerStaticRoutes(server) {
	server.route({
		method: "GET",
		path: "/static/{file*}",
		options: {
			auth: false,
		},
		handler: {
			directory: {
				path: Path.join(dirname, "../../static/"),
				redirectToSlash: true,
				listing: true,
			},
		},
	});
}
