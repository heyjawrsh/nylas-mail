/*
 * decaffeinate suggestions:
 * DS002: Fix invalid constructor
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
import PropTypes from "prop-types";
const React = require("react");
const { Utils, DateUtils } = require("nylas-exports");
const ThreadListStore = require("./thread-list-store");

class ThreadListScrollTooltip extends React.Component {
	constructor(...args) {
		this.UNSAFE_componentWillMount = this.UNSAFE_componentWillMount.bind(this);
		this.UNSAFE_componentWillReceiveProps =
			this.UNSAFE_componentWillReceiveProps.bind(this);
		this.shouldComponentUpdate = this.shouldComponentUpdate.bind(this);
		super(...args);
	}

	static initClass() {
		ThreadListScrollTooltip.displayName = "ThreadListScrollTooltip";
		ThreadListScrollTooltip.propTypes = {
			viewportCenter: PropTypes.number.isRequired,
			totalHeight: PropTypes.number.isRequired,
		};
	}

	UNSAFE_componentWillMount() {
		return this.setupForProps(this.props);
	}

	UNSAFE_componentWillReceiveProps(newProps) {
		return this.setupForProps(newProps);
	}

	shouldComponentUpdate(_newProps, newState) {
		return (this.state != null ? this.state.idx : undefined) !== newState.idx;
	}

	setupForProps(_props) {
		const idx = Math.floor(
			(ThreadListStore.dataSource().count() / this.props.totalHeight) *
				this.props.viewportCenter,
		);
		return this.setState({
			idx,
			item: ThreadListStore.dataSource().get(idx),
		});
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

module.exports = ThreadListScrollTooltip;
