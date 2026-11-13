/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
const _ = require("underscore");
const React = require("react");
const _classNames = require("classnames");
const _moment = require("moment");

const {
	ListTabular,
	RetinaImg,
	MailLabelSet,
	MailImportantIcon,
	InjectedComponent,
	InjectedComponentSet,
} = require("nylas-component-kit");

const {
	Thread,
	FocusedPerspectiveStore,
	Utils,
	DateUtils,
} = require("nylas-exports");

const {
	ThreadArchiveQuickAction,
	ThreadTrashQuickAction,
} = require("./thread-list-quick-actions");

const ThreadListParticipants = require("./thread-list-participants").default;
const _ThreadListStore = require("./thread-list-store").default;
const ThreadListIcon = require("./thread-list-icon");

// Get and format either last sent or last received timestamp depending on thread-list being viewed
const ThreadListTimestamp = ({ thread }) => {
	let rawTimestamp;
	if (FocusedPerspectiveStore.current().isSent()) {
		rawTimestamp = thread.lastMessageSentTimestamp;
	} else {
		rawTimestamp = thread.lastMessageReceivedTimestamp;
	}
	const timestamp = DateUtils.shortTimeString(rawTimestamp);
	return React.createElement("span", { className: "timestamp" }, timestamp);
};
ThreadListTimestamp.containerRequired = false;

const subject = (subj) => {
	if ((subj != null ? subj : "").trim().length === 0) {
		return React.createElement(
			"span",
			{ className: "no-subject" },
			"(No Subject)",
		);
	} else if (subj.split(/([\uD800-\uDBFF][\uDC00-\uDFFF])/g).length > 1) {
		const subjComponents = [];
		const subjParts = subj.split(/([\uD800-\uDBFF][\uDC00-\uDFFF])/g);
		for (let idx = 0; idx < subjParts.length; idx++) {
			var part = subjParts[idx];
			if (part.match(/([\uD800-\uDBFF][\uDC00-\uDFFF])/g)) {
				subjComponents.push(
					React.createElement("span", { className: "emoji", key: idx }, part),
				);
			} else {
				subjComponents.push(React.createElement("span", { key: idx }, part));
			}
		}
		return subjComponents;
	} else {
		return subj;
	}
};

const getSnippet = (thread) => {
	const messages = thread.__messages || [];
	if (messages.length === 0) {
		return thread.snippet;
	}

	return messages[messages.length - 1].snippet;
};

const c1 = new ListTabular.Column({
	name: "★",
	resolver: (thread) => {
		return [
			React.createElement(ThreadListIcon, {
				key: "thread-list-icon",
				thread: thread,
			}),
			React.createElement(MailImportantIcon, {
				key: "mail-important-icon",
				thread: thread,
				showIfAvailableForAnyAccount: true,
			}),
			React.createElement(InjectedComponentSet, {
				key: "injected-component-set",
				inline: true,
				containersRequired: false,
				matching: { role: "ThreadListIcon" },
				className: "thread-injected-icons",
				exposedProps: { thread },
			}),
		];
	},
});

const c2 = new ListTabular.Column({
	name: "Participants",
	width: 200,
	resolver: (thread) => {
		const hasDraft = (thread.__messages || []).find((m) => m.draft);
		if (hasDraft) {
			return React.createElement(
				"div",
				{ style: { display: "flex" } },
				React.createElement(ThreadListParticipants, { thread: thread }),
				React.createElement(RetinaImg, {
					name: "icon-draft-pencil.png",
					className: "draft-icon",
					mode: RetinaImg.Mode.ContentPreserve,
				}),
			);
		} else {
			return React.createElement(ThreadListParticipants, { thread: thread });
		}
	},
});

const c3 = new ListTabular.Column({
	name: "Message",
	flex: 4,
	resolver: (thread) => {
		let attachment = false;
		const messages = thread.__messages || [];

		const hasAttachments =
			thread.hasAttachments &&
			messages.find((m) => Utils.showIconForAttachments(m.files));
		if (hasAttachments) {
			attachment = React.createElement("div", {
				className: "thread-icon thread-icon-attachment",
			});
		}

		return React.createElement(
			"span",
			{ className: "details" },
			React.createElement(MailLabelSet, { thread: thread }),
			React.createElement(
				"span",
				{ className: "subject" },
				subject(thread.subject),
			),
			React.createElement("span", { className: "snippet" }, getSnippet(thread)),
			attachment,
		);
	},
});

const c4 = new ListTabular.Column({
	name: "Date",
	resolver: (thread) => {
		return React.createElement(InjectedComponent, {
			className: "thread-injected-timestamp",
			fallback: ThreadListTimestamp,
			exposedProps: { thread },
			matching: { role: "ThreadListTimestamp" },
		});
	},
});

const c5 = new ListTabular.Column({
	name: "HoverActions",
	resolver: (thread) => {
		return React.createElement(
			"div",
			{ className: "inner" },
			React.createElement(InjectedComponentSet, {
				key: "injected-component-set",
				inline: true,
				containersRequired: false,
				children: [
					React.createElement(ThreadTrashQuickAction, {
						key: "thread-trash-quick-action",
						thread: thread,
					}),
					React.createElement(ThreadArchiveQuickAction, {
						key: "thread-archive-quick-action",
						thread: thread,
					}),
				],
				matching: { role: "ThreadListQuickAction" },
				className: "thread-injected-quick-actions",
				exposedProps: { thread },
			}),
		);
	},
});

const cNarrow = new ListTabular.Column({
	name: "Item",
	flex: 1,
	resolver: (thread) => {
		let pencil = false;
		let attachment = false;
		const messages = thread.__messages || [];

		const hasAttachments =
			thread.hasAttachments &&
			messages.find((m) => Utils.showIconForAttachments(m.files));
		if (hasAttachments) {
			attachment = React.createElement("div", {
				className: "thread-icon thread-icon-attachment",
			});
		}

		const hasDraft = messages.find((m) => m.draft);
		if (hasDraft) {
			pencil = React.createElement(RetinaImg, {
				name: "icon-draft-pencil.png",
				className: "draft-icon",
				mode: RetinaImg.Mode.ContentPreserve,
			});
		}

		// TODO We are limiting the amount on injected icons in narrow mode to 1
		// until we revisit the UI to accommodate more icons
		return React.createElement(
			"div",
			{ style: { display: "flex", alignItems: "flex-start" } },
			React.createElement(
				"div",
				{ className: "icons-column" },
				React.createElement(ThreadListIcon, { thread: thread }),
				React.createElement(InjectedComponentSet, {
					inline: true,
					matchLimit: 1,
					direction: "column",
					containersRequired: false,
					key: "injected-component-set",
					exposedProps: { thread },
					matching: { role: "ThreadListIcon" },
					className: "thread-injected-icons",
				}),
				React.createElement(MailImportantIcon, {
					thread: thread,
					showIfAvailableForAnyAccount: true,
				}),
			),
			React.createElement(
				"div",
				{ className: "thread-info-column" },
				React.createElement(
					"div",
					{ className: "participants-wrapper" },
					React.createElement(ThreadListParticipants, { thread: thread }),
					pencil,
					React.createElement("span", { style: { flex: 1 } }),
					attachment,
					React.createElement(InjectedComponent, {
						key: "thread-injected-timestamp",
						className: "thread-injected-timestamp",
						fallback: ThreadListTimestamp,
						exposedProps: { thread },
						matching: { role: "ThreadListTimestamp" },
					}),
				),
				React.createElement(
					"div",
					{ className: "subject" },
					subject(thread.subject),
				),
				React.createElement(
					"div",
					{ className: "snippet-and-labels" },
					React.createElement(
						"div",
						{ className: "snippet" },
						getSnippet(thread),
						" ",
					),
					React.createElement("div", { style: { flex: 1, flexShrink: 1 } }),
					React.createElement(MailLabelSet, { thread: thread }),
				),
			),
		);
	},
});

module.exports = {
	Narrow: [cNarrow],
	Wide: [c1, c2, c3, c4, c5],
};
