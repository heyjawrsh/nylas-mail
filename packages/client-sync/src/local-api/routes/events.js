import Joi from "joi";

// TODO: This is a placeholder
export default (server) => {
	server.route({
		method: "GET",
		path: "/events",
		options: {
			description: "Returns events.",
			notes: "Notes go here",
			tags: ["events"],
			validate: {
				query: {
					limit: Joi.number().integer().min(1).max(2000).default(100),
					offset: Joi.number().integer().min(0).default(0),
					view: Joi.string().valid("count"),
				},
			},
			response: {
				sample: 0,
				schema: Joi.array(),
			},
		},
		handler: (request, h) => {
			return h.response("[]");
		},
	});
};
