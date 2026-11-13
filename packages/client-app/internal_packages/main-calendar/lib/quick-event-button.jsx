import React from "react";
import { Actions } from "nylas-exports";
import QuickEventPopover from "./quick-event-popover";

export default class QuickEventButton extends React.Component {
	static displayName = "QuickEventButton";

	_button = React.createRef();

	getDOMNode() {
		return this._button.current;
	}

	onClick = (event) => {
		event.stopPropagation();
		const buttonRect = this._button.current.getBoundingClientRect();
		Actions.openPopover(<QuickEventPopover />, {
			originRect: buttonRect,
			direction: "down",
		});
	};

	render() {
		return (
			<button
				ref={this._button}
				style={{ order: -50 }}
				tabIndex={-1}
				className="btn btn-toolbar"
				onClick={this.onClick}
			>
				+
			</button>
		);
	}
}
