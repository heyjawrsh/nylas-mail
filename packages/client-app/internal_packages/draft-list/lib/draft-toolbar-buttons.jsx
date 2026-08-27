/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
import PropTypes from "prop-types";
import React from "react";
import { RetinaImg } from "nylas-component-kit";
import { Actions, FocusedContentStore } from "nylas-exports";

class DraftDeleteButton extends React.Component {
	constructor(...args) {
		super(...args);
		this._destroySelected = this._destroySelected.bind(this);
	}

	static initClass() {
		DraftDeleteButton.displayName = "DraftDeleteButton";
		DraftDeleteButton.containerRequired = false;

		DraftDeleteButton.propTypes = { selection: PropTypes.object.isRequired };
	}

	render() {
		return (
			<button
				style={{ order: -100 }}
				className="btn btn-toolbar"
				title="Delete"
				onClick={this._destroySelected}
			>
				<RetinaImg
					name="icon-composer-trash.png"
					mode={RetinaImg.Mode.ContentIsMask}
				/>
			</button>
		);
	}

	_destroySelected() {
		for (var item of Array.from(this.props.selection.items())) {
			Actions.destroyDraft(item.clientId);
		}
		this.props.selection.clear();
	}
}
DraftDeleteButton.initClass();

module.exports = { DraftDeleteButton };
