/*
 * decaffeinate suggestions:
 * DS002: Fix invalid constructor
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
const React = require("react");
const moment = require("moment");
const { DateUtils, Utils } = require("nylas-exports");

class DeveloperBarLongPollItem extends React.Component {
	static initClass() {
		DeveloperBarLongPollItem.displayName = "DeveloperBarLongPollItem";
	}

	constructor(props) {
		this.shouldComponentUpdate = this.shouldComponentUpdate.bind(this);
		this.render = this.render.bind(this);
		this.props = props;
		this.state = { expanded: false };
	}

	shouldComponentUpdate(nextProps, nextState) {
		return (
			!Utils.isEqualReact(nextProps, this.props) ||
			!Utils.isEqualReact(nextState, this.state)
		);
	}

	render() {
		let payload;
		if (this.state.expanded) {
			payload = JSON.stringify(this.props.item, null, 2);
		} else {
			payload = [];
		}

		let itemId = this.props.item.id;
		const itemVersion =
			this.props.item.version ||
			(this.props.item.attributes != null
				? this.props.item.attributes.version
				: undefined);
		if (itemVersion) {
			itemId += ` (version ${itemVersion})`;
		}

		const timeFormat = DateUtils.getTimeFormat({ seconds: true });
		const timestamp = moment(this.props.item.timestamp).format(timeFormat);

		let classname = "item";
		let right = this.props.item.cursor;

		if (this.props.ignoredBecause) {
			classname += " ignored";
			right = this.props.ignoredBecause + " - " + right;
		}

		return (
			<div
				className={classname}
				onClick={() =>
					this.setState({
						expanded: !(this.state != null ? this.state.expanded : undefined),
					})
				}
			>
				<div className="cursor">{right}</div>
				{` ${timestamp}: ${this.props.item.event} ${this.props.item.object} ${itemId}`}
				<div className="payload" onClick={(e) => e.stopPropagation()}>
					{payload}
				</div>
			</div>
		);
	}
}
DeveloperBarLongPollItem.initClass();

module.exports = DeveloperBarLongPollItem;
