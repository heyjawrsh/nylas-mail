/*
 * decaffeinate suggestions:
 * DS002: Fix invalid constructor
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
import PropTypes from "prop-types";
import React from "react";
import { Actions } from "nylas-exports";
import { RetinaImg } from "nylas-component-kit";

class SendingCancelButton extends React.Component {
	static initClass() {
		SendingCancelButton.displayName = "SendingCancelButton";

		SendingCancelButton.propTypes = { taskId: PropTypes.string.isRequired };
	}

	constructor(props) {
		super();
		this.render = this.render.bind(this);
		this._onClick = this._onClick.bind(this);
		this.props = props;
		this.state = { cancelling: false };
	}

	render() {
		if (this.state.cancelling) {
			return (
				<RetinaImg
					style={{ width: 20, height: 20, marginTop: 2 }}
					name="inline-loading-spinner.gif"
					mode={RetinaImg.Mode.ContentPreserve}
				/>
			);
		} else {
			return (
				<div onClick={this._onClick} style={{ marginTop: 1 }}>
					<RetinaImg
						name="image-cancel-button.png"
						mode={RetinaImg.Mode.ContentPreserve}
					/>
				</div>
			);
		}
	}

	_onClick() {
		Actions.dequeueTask(this.props.taskId);
		return this.setState({ cancelling: true });
	}
}
SendingCancelButton.initClass();

module.exports = SendingCancelButton;
