/*
 * decaffeinate suggestions:
 * DS002: Fix invalid constructor
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
import PropTypes from "prop-types";
import React from "react";
import { Utils } from "nylas-exports";

class ThreadListParticipants extends React.Component {
	constructor(...args) {
		this.shouldComponentUpdate = this.shouldComponentUpdate.bind(this);
		this.render = this.render.bind(this);
		this.renderSpans = this.renderSpans.bind(this);
		this.getTokensFromMessages = this.getTokensFromMessages.bind(this);
		this.getTokensFromParticipants = this.getTokensFromParticipants.bind(this);
		this.getTokens = this.getTokens.bind(this);
		super(...args);
	}

	static initClass() {
		ThreadListParticipants.displayName = "ThreadListParticipants";

		ThreadListParticipants.propTypes = { thread: PropTypes.object.isRequired };
	}

	shouldComponentUpdate(nextProps) {
		if (nextProps.thread === this.props.thread) {
			return false;
		}
		return true;
	}

	render() {
		const items = this.getTokens();
		return React.createElement(
			"div",
			{ className: "participants" },
			this.renderSpans(items),
		);
	}

	renderSpans(items) {
		const spans = [];
		let accumulated = null;
		let accumulatedUnread = false;

		const flush = () => {
			if (accumulated) {
				spans.push(
					React.createElement(
						"span",
						{ key: spans.length, className: `unread-${accumulatedUnread}` },
						accumulated,
					),
				);
			}
			accumulated = null;
			return (accumulatedUnread = false);
		};

		const accumulate = (text, unread) => {
			if (accumulated && unread && accumulatedUnread !== unread) {
				flush();
			}
			if (accumulated) {
				return (accumulated += text);
			} else {
				accumulated = text;
				return (accumulatedUnread = unread);
			}
		};

		for (let idx = 0; idx < items.length; idx++) {
			var { spacer, contact, unread } = items[idx];
			if (spacer) {
				accumulate("...");
			} else {
				var short;
				if (contact.name.length > 0) {
					if (items.length > 1) {
						short = contact.displayName({
							includeAccountLabel: false,
							compact: true,
						});
					} else {
						short = contact.displayName({ includeAccountLabel: false });
					}
				} else {
					short = contact.email;
				}
				if (idx < items.length - 1 && !items[idx + 1].spacer) {
					short += ", ";
				}
				accumulate(short, unread);
			}
		}

		const messages =
			this.props.thread.__messages != null ? this.props.thread.__messages : [];
		if (messages.length > 1) {
			accumulate(` (${messages.length})`);
		}

		flush();

		return spans;
	}

	getTokensFromMessages() {
		const messages = this.props.thread.__messages;
		const tokens = [];

		let field = "from";
		if (messages.every((message) => message.isFromMe())) {
			field = "to";
		}

		for (let idx = 0; idx < messages.length; idx++) {
			var message = messages[idx];
			if (message.draft) {
				continue;
			}

			for (var contact of Array.from(message[field])) {
				if (tokens.length === 0) {
					tokens.push({ contact, unread: message.unread });
				} else {
					var lastToken = tokens[tokens.length - 1];
					var lastContact = lastToken.contact;

					var sameEmail = Utils.emailIsEquivalent(
						lastContact.email,
						contact.email,
					);
					var sameName = lastContact.name === contact.name;
					if (sameEmail && sameName) {
						if (!lastToken.unread) {
							lastToken.unread = message.unread;
						}
					} else {
						tokens.push({ contact, unread: message.unread });
					}
				}
			}
		}

		return tokens;
	}

	getTokensFromParticipants() {
		let contacts =
			this.props.thread.participants != null
				? this.props.thread.participants
				: [];
		contacts = contacts.filter((contact) => !contact.isMe());
		return contacts.map((contact) => ({
			contact,
			unread: false,
		}));
	}

	getTokens() {
		let list;
		if (Array.isArray(this.props.thread.__messages)) {
			list = this.getTokensFromMessages();
		} else {
			list = this.getTokensFromParticipants();
		}

		// If no participants, we should at least add current user as sole participant
		if (
			list.length === 0 &&
			(this.props.thread.participants != null
				? this.props.thread.participants.length
				: undefined) > 0
		) {
			list.push({ contact: this.props.thread.participants[0], unread: false });
		}

		// We only ever want to show three. Ben...Kevin... Marty
		// But we want the *right* three.
		if (list.length > 3) {
			const listTrimmed = [
				// Always include the first item
				list[0],
				{ spacer: true },

				// Always include last two items
				list[list.length - 2],
				list[list.length - 1],
			];
			list = listTrimmed;
		}

		return list;
	}
}
ThreadListParticipants.initClass();

module.exports = ThreadListParticipants;
