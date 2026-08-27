import PropTypes from "prop-types";
import _ from "underscore";
import React from "react";
import { Actions, Utils } from "nylas-exports";
import { RetinaImg } from "nylas-component-kit";

class StarButton extends React.Component {
	static displayName = "StarButton";
	static containerRequired = false;
	static propTypes = { thread: PropTypes.object };

	constructor() {
		super(...arguments);
		this.render = this.render.bind(this);
		this._onStarToggle = this._onStarToggle.bind(this);
	}

	render() {
		const selected = this.props.thread?.starred;
		return (
			<button
				className="btn btn-toolbar"
				style={{ order: -104 }}
				title={selected ? "Remove star" : "Add star"}
				onClick={this._onStarToggle}
			>
				<RetinaImg
					name="toolbar-star.png"
					mode={RetinaImg.Mode.ContentIsMask}
					selected={selected}
				/>
			</button>
		);
	}

	_onStarToggle(e) {
		Actions.toggleStarredThreads({
			source: "Toolbar Button: Message List",
			threads: [this.props.thread],
		});
		return e.stopPropagation();
	}
}

module.exports = StarButton;
