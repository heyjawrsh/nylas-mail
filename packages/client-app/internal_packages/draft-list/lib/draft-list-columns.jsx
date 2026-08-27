/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
const _ = require("underscore");
const React = require("react");
const { Actions, Utils } = require("nylas-exports");
const { InjectedComponentSet, ListTabular } = require("nylas-component-kit");

const snippet = (html) => {
	if (!html || typeof html !== "string") {
		return "";
	}
	try {
		const text = Utils.extractTextFromHtml(html, { maxLength: 400 });
		return text.slice(0, 201);
	} catch (error) {
		return "";
	}
};

const subject = (subj) => {
	if ((subj != null ? subj : "").trim().length === 0) {
		return <span className="no-subject">(No Subject)</span>;
	} else {
		let text;
		return (text = Utils.extractTextFromHtml(subj));
	}
};

const ParticipantsColumn = new ListTabular.Column({
	name: "Participants",
	width: 200,
	resolver: (draft) => {
		const list = [].concat(draft.to, draft.cc, draft.bcc);

		if (list.length > 0) {
			return (
				<div className="participants">
					<span>{list.map((p) => p.displayName()).join(", ")}</span>
				</div>
			);
		} else {
			return <div className="participants no-recipients">(No Recipients)</div>;
		}
	},
});

const ContentsColumn = new ListTabular.Column({
	name: "Contents",
	flex: 4,
	resolver: (draft) => {
		let attachments = [];
		if ((draft.files != null ? draft.files.length : undefined) > 0) {
			attachments = <div className="thread-icon thread-icon-attachment"></div>;
		}
		return (
			<span className="details">
				<span className="subject">{subject(draft.subject)}</span>
				<span className="snippet">{snippet(draft.body)}</span>
				{attachments}
			</span>
		);
	},
});

const StatusColumn = new ListTabular.Column({
	name: "State",
	resolver: (draft) => {
		return (
			<InjectedComponentSet
				inline={true}
				containersRequired={false}
				matching={{ role: "DraftList:DraftStatus" }}
				className="draft-list-injected-state"
				exposedProps={{ draft }}
			/>
		);
	},
});

module.exports = { Wide: [ParticipantsColumn, ContentsColumn, StatusColumn] };
