/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
const NylasObservables = require("nylas-observables");
const { Template } = require("./components/scenario-editor-models.js");

const ConditionTemplates = [
	new Template("from", Template.Type.String, {
		name: "From",
		valueForMessage(message) {
			return [].concat(
				message.from.map((c) => c.email),
				message.from.map((c) => c.name),
			);
		},
	}),

	new Template("to", Template.Type.String, {
		name: "To",
		valueForMessage(message) {
			return [].concat(
				message.to.map((c) => c.email),
				message.to.map((c) => c.name),
			);
		},
	}),

	new Template("cc", Template.Type.String, {
		name: "Cc",
		valueForMessage(message) {
			return [].concat(
				message.cc.map((c) => c.email),
				message.cc.map((c) => c.name),
			);
		},
	}),

	new Template("bcc", Template.Type.String, {
		name: "Bcc",
		valueForMessage(message) {
			return [].concat(
				message.bcc.map((c) => c.email),
				message.bcc.map((c) => c.name),
			);
		},
	}),

	new Template("anyRecipient", Template.Type.String, {
		name: "Any Recipient",
		valueForMessage(message) {
			const recipients = [].concat(
				message.to,
				message.cc,
				message.bcc,
				message.from,
			);
			return [].concat(
				recipients.map((c) => c.email),
				recipients.map((c) => c.name),
			);
		},
	}),

	new Template("anyAttachmentName", Template.Type.String, {
		name: "Any attachment name",
		valueForMessage(message) {
			return message.files.map((f) => f.filename);
		},
	}),

	new Template("starred", Template.Type.Enum, {
		name: "Starred",
		values: [
			{ name: "True", value: "true" },
			{ name: "False", value: "false" },
		],
		valueLabel: "is:",
		valueForMessage(message) {
			if (message.starred) {
				return "true";
			} else {
				return "false";
			}
		},
	}),

	new Template("subject", Template.Type.String, {
		name: "Subject",
		valueForMessage(message) {
			return message.subject;
		},
	}),

	new Template("body", Template.Type.String, {
		name: "Body",
		valueForMessage(message) {
			return message.body;
		},
	}),
];

const ActionTemplates = [
	new Template("markAsRead", Template.Type.None, { name: "Mark as Read" }),
	new Template("moveToTrash", Template.Type.None, { name: "Move to Trash" }),
	new Template("star", Template.Type.None, { name: "Star" }),
];

module.exports = {
	ConditionMode: {
		Any: "any",
		All: "all",
	},

	ConditionTemplates,

	ConditionTemplatesForAccount(account) {
		if (!account) {
			return [];
		}
		return ConditionTemplates;
	},

	ActionTemplates,

	ActionTemplatesForAccount(account) {
		if (!account) {
			return [];
		}

		const templates = [].concat(ActionTemplates);

		const CategoryNamesObservable = NylasObservables.Categories.forAccount(
			account,
		)
			.sort()
			.map((cats) => cats.filter((cat) => !cat.isLockedCategory()))
			.map((cats) =>
				cats.map((cat) => ({
					name: cat.displayName || cat.name,
					value: cat.id,
				})),
			);

		if (account.usesLabels()) {
			templates.unshift(
				new Template("markAsImportant", Template.Type.None, {
					name: "Mark as Important",
				}),
			);
			templates.unshift(
				new Template("applyLabelArchive", Template.Type.None, {
					name: "Archive",
				}),
			);
			templates.unshift(
				new Template("applyLabel", Template.Type.Enum, {
					name: "Apply Label",
					values: CategoryNamesObservable,
				}),
			);
			templates.unshift(
				new Template("moveToLabel", Template.Type.Enum, {
					name: "Move to Label",
					values: CategoryNamesObservable,
				}),
			);
		} else {
			templates.push(
				new Template("changeFolder", Template.Type.Enum, {
					name: "Move Message",
					valueLabel: "to folder:",
					values: CategoryNamesObservable,
				}),
			);
		}

		return templates;
	},
};
