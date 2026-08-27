import Joi from "joi";
import { Op } from "sequelize";
import Serialization from "../serialization.js";
import moment from "moment-timezone";
import Boom from "@hapi/boom";

const LOOKBACK_TIME = moment.duration(2, "years").asMilliseconds();
const MIN_MESSAGE_WEIGHT = 0.01;

const getMessageWeight = (message, now) => {
	const timeDiff = now - message.date.getTime();
	const weight = 1.0 - timeDiff / LOOKBACK_TIME;
	return Math.max(weight, MIN_MESSAGE_WEIGHT);
};

const calculateContactScores = (messages, result) => {
	const now = Date.now();
	for (const message of messages) {
		const weight = getMessageWeight(message, now);
		for (const recipient of message.getRecipients()) {
			if (!recipient.email) {
				continue;
			}
			const email = recipient.email.toLowerCase();
			result[email] = result[email] ? result[email] + weight : weight;
		}
	}
};

export default (server) => {
	server.route({
		method: "GET",
		path: "/contacts",
		options: {
			description: "Returns an array of contacts",
			notes: "Notes go here",
			tags: ["contacts"],
			validate: {
				query: {
					limit: Joi.number().integer().min(1).max(2000).default(100),
					offset: Joi.number().integer().min(0).default(0),
				},
			},
			response: {
				sample: 0,
				schema: Joi.array().items(Serialization.jsonSchema("Contact")),
			},
		},
		handler: async (request, h) => {
			const { Contact } = await request.getAccountDatabase();
			const contacts = await Contact.findAll({
				limit: request.query.limit,
				offset: request.query.offset,
			});
			return h.response(Serialization.jsonStringify(contacts));
		},
	});

	server.route({
		method: "GET",
		path: "/contacts/{id}",
		options: {
			description: "Returns a contact with specified id.",
			notes: "Notes go here",
			tags: ["contacts"],
			validate: {
				params: {
					id: Joi.string(),
				},
			},
			response: {
				sample: 0,
				schema: Serialization.jsonSchema("Contact"),
			},
		},
		handler: async (request, h) => {
			const { Contact } = await request.getAccountDatabase();
			const {
				params: { id },
			} = request;
			const contact = await Contact.findOne({ where: { id } });
			if (!contact) {
				throw Boom.notFound(`Contact ${id} not found`);
			}
			return h.response(Serialization.jsonStringify(contact));
		},
	});

	// TODO: This is a placeholder
	server.route({
		method: "GET",
		path: "/contacts/rankings",
		options: {
			description: "Returns contact rankings.",
			notes: "Notes go here",
			tags: ["contacts"],
		},
		handler: async (request, h) => {
			const db = await request.getAccountDatabase();
			const account = request.auth.credentials;
			const { Message, Label, Folder } = db;

			const result = {};
			let lastID = 0;

			const useLabels = account.provider === "gmail";

			const model = useLabels ? Label : Folder;
			const category = await model.findOne({
				attributes: ["id", "role"],
				where: { role: "sent" },
			});

			if (!category) {
				return h.response("[]");
			}

			while (true) {
				const messages = await category.getMessages({
					attributes: ["rowid", "id", "to", "cc", "bcc", "date"],
					where: {
						isDraft: false, // Don't include unsent things.
						"$message.rowid$": { [Op.gt]: lastID },
					},
					order: [["rowid", "ASC"]],
					limit: 100,
				});

				if (messages.length === 0) {
					break;
				}

				calculateContactScores(messages, result);
				lastID = Math.max(...messages.map((m) => m.dataValues.rowid));
			}
			return h.response(JSON.stringify(Object.entries(result)));
		},
	});
};
