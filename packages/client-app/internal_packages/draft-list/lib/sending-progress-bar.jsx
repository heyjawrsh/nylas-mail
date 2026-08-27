/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
import PropTypes from "prop-types";
import React from "react";
import { Utils } from "nylas-exports";

class SendingProgressBar extends React.Component {
	static initClass() {
		SendingProgressBar.propTypes = { progress: PropTypes.number.isRequired };
	}

	render() {
		const otherProps = Utils.fastOmit(
			this.props,
			Object.keys(this.constructor.propTypes),
		);
		if (0 < this.props.progress && this.props.progress < 99) {
			return (
				<div className="sending-progress" {...otherProps}>
					<div
						className="filled"
						style={{ width: `${Math.min(100, this.props.progress)}%` }}
					></div>
				</div>
			);
		} else {
			return (
				<div className="sending-progress" {...otherProps}>
					<div className="indeterminate"></div>
				</div>
			);
		}
	}
}
SendingProgressBar.initClass();

module.exports = SendingProgressBar;
