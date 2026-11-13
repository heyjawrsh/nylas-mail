/*
 * decaffeinate suggestions:
 * DS002: Fix invalid constructor
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
import PropTypes from "prop-types";
import React from "react";
import ThreadListStore from "./thread-list-store";

class ThreadListScrollTooltip extends React.Component {
	constructor(props) {
		super(props);
		this.shouldComponentUpdate = this.shouldComponentUpdate.bind(this);
		this.state = ThreadListScrollTooltip.stateForProps(props);
	}

	static initClass() {
		ThreadListScrollTooltip.displayName = "ThreadListScrollTooltip";
		ThreadListScrollTooltip.propTypes = {
			viewportCenter: PropTypes.number.isRequired,
			totalHeight: PropTypes.number.isRequired,
		};
	}

	// Before shouldComponentUpdate, which only looks at the index in state.
	static getDerivedStateFromProps(props) {
		return ThreadListScrollTooltip.stateForProps(props);
	}

	shouldComponentUpdate(_newProps, newState) {
		return (this.state != null ? this.state.idx : undefined) !== newState.idx;
	}

	static stateForProps(props) {
		const idx = Math.floor(
			(ThreadListStore.dataSource().count() / props.totalHeight) *
				props.viewportCenter,
		);
		return {
			idx,
			item: ThreadListStore.dataSource().get(idx),
		};
	}

	render() {
		let content;
		if (this.state.item) {
			content = DateUtils.shortTimeString(
				this.state.item.lastMessageReceivedTimestamp,
			);
		} else {
			content = "Loading...";
		}
		return React.createElement("div", { className: "scroll-tooltip" }, content);
	}
}
ThreadListScrollTooltip.initClass();

export default ThreadListScrollTooltip;
