/*
 * decaffeinate suggestions:
 * DS002: Fix invalid constructor
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
import PropTypes from "prop-types";
const _ = require("underscore");
const React = require("react");
const {
	DraftHelpers,
	Actions,
	Thread,
	ChangeStarredTask,
	ExtensionRegistry,
	AccountStore,
} = require("nylas-exports");

class ThreadListIcon extends React.Component {
	constructor(...args) {
		super(...args);
		this._extensionsIconClassNames = this._extensionsIconClassNames.bind(this);
		this._iconClassNames = this._iconClassNames.bind(this);
		this._nonDraftMessages = this._nonDraftMessages.bind(this);
		this.shouldComponentUpdate = this.shouldComponentUpdate.bind(this);
		this.render = this.render.bind(this);
		this._onToggleStar = this._onToggleStar.bind(this);
	}

	static initClass() {
		ThreadListIcon.displayName = "ThreadListIcon";
		ThreadListIcon.propTypes = { thread: PropTypes.object };
	}

	_extensionsIconClassNames() {
		return ExtensionRegistry.ThreadList.extensions()
			.filter((ext) => ext.cssClassNamesForThreadListIcon != null)
			.reduce(
				(prev, ext) =>
					`${prev} ${ext.cssClassNamesForThreadListIcon(this.props.thread)}`,
				"",
			)
			.trim();
	}

	_iconClassNames() {
		if (!this.props.thread) {
			return "thread-icon-star-on-hover";
		}

		const extensionIconClassNames = this._extensionsIconClassNames();
		if (extensionIconClassNames.length > 0) {
			return extensionIconClassNames;
		}

		if (this.props.thread.starred) {
			return "thread-icon-star";
		}

		if (this.props.thread.unread) {
			return "thread-icon-unread thread-icon-star-on-hover";
		}

		const msgs = this._nonDraftMessages();
		const last = msgs[msgs.length - 1];

		if (
			msgs.length > 1 &&
			(last.from[0] != null ? last.from[0].isMe() : undefined)
		) {
			if (DraftHelpers.isForwardedMessage(last)) {
				return "thread-icon-forwarded thread-icon-star-on-hover";
			} else {
				return "thread-icon-replied thread-icon-star-on-hover";
			}
		}

		return "thread-icon-none thread-icon-star-on-hover";
	}

	_nonDraftMessages() {
		let msgs = this.props.thread.__messages;
		if (!msgs || !Array.isArray(msgs)) {
			return [];
		}
		msgs = _.filter(msgs, (m) => m.serverId && !m.draft);
		return msgs;
	}

	shouldComponentUpdate(nextProps) {
		if (nextProps.thread === this.props.thread) {
			return false;
		}
		return true;
	}

	render() {
		return React.createElement("div", {
			className: `thread-icon ${this._iconClassNames()}`,
			title: "Star",
			onClick: this._onToggleStar,
		});
	}

	_onToggleStar(event) {
		Actions.toggleStarredThreads({
			threads: [this.props.thread],
			source: "Thread List Icon",
		});
		// Don't trigger the thread row click
		return event.stopPropagation();
	}
}
ThreadListIcon.initClass();

module.exports = ThreadListIcon;
