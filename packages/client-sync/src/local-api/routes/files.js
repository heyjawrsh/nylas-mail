import Joi from "joi";
import Boom from "@hapi/boom";

export default (server) => {
	server.route({
		method: "GET",
		path: "/files/{id}/download",
		options: {
			description: "Returns binary data for file with specified id.",
			notes: "Notes go here",
			tags: ["files"],
			validate: {
				params: {
					id: Joi.string(),
				},
			},
		},
		handler: async (request, h) => {
			const db = await request.getAccountDatabase();
			const {
				params: { id },
			} = request;
			const account = request.auth.credentials;
			try {
				const file = await db.File.findOne({ where: { id } });
				if (!file) {
					throw Boom.notFound(`File ${id} not found`);
				}
				const body = await file.fetch({ account, db, logger: request.logger });
				return h.response(body);
			} catch (err) {
				request.logger.error(err, "Error downloading file");
				throw err;
			}
		},
	});
};
