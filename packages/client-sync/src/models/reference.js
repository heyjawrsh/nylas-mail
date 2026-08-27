import defineModel from "./define-model.js";

// This model exists solely to store RFC2822 Message-IDs from the Message-Id,
// In-Reply-To, and References message headers in an indexable fashion for
// threading messages in providers that do not provide a thread ID from the
// server.
export default (sequelize, Sequelize) => {
	return defineModel(
		sequelize,
		"reference",
		{
			// We need to specify autoincrement: true here otherwise newly
			// created models come back with the primary key set on an attribute
			// named `null`, rather than `id`, and associations created with them
			// will fail constraints because the referenceId will be NULL. WTF.
			// See https://github.com/sequelize/sequelize/issues/1060
			id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
			rfc2822MessageId: { type: Sequelize.STRING, unique: true },
		},
		{
			indexes: [{ fields: ["rfc2822MessageId"] }, { fields: ["threadId"] }],
			statics: {
				associate: ({ Thread, Reference, Message, MessageReference }) => {
					Reference.belongsTo(Thread);
					Reference.belongsToMany(Message, { through: MessageReference });
				},
			},
		},
	);
};
