import React from "react";
import { Actions } from "nylas-exports";
import { RetinaImg } from "nylas-component-kit";

import ActivityList from "./activity-list";
import ActivityListStore from "./activity-list-store";

class ActivityListButton extends React.Component {
	static displayName = "ActivityListButton";

	constructor() {
		super();
		this.state = this._getStateFromStores();
		this._root = React.createRef();
	}

	// The button, for the popover origin and HasTutorialTip.
	getDOMNode() {
		return this._root.current;
	}

	componentDidMount() {
		this._unsub = ActivityListStore.listen(this._onDataChanged);
	}

	componentWillUnmount() {
		this._unsub();
	}

	onClick = () => {
		const buttonRect = this._root.current.getBoundingClientRect();
		Actions.openPopover(<ActivityList />, {
			originRect: buttonRect,
			direction: "down",
		});
	};

	_onDataChanged = () => {
		this.setState(this._getStateFromStores());
	};

	_getStateFromStores() {
		return {
			unreadCount: ActivityListStore.unreadCount(),
		};
	}

	render() {
		let unreadCountClass = "unread-count";
		let iconClass = "activity-toolbar-icon";
		if (this.state.unreadCount) {
			unreadCountClass += " active";
			iconClass += " unread";
		}
		return (
			<div
				ref={this._root}
				tabIndex={-1}
				className="toolbar-activity"
				title="View activity"
				onClick={this.onClick}
			>
				<div className={unreadCountClass}>{this.state.unreadCount}</div>
				<RetinaImg
					name="icon-toolbar-activity.png"
					className={iconClass}
					mode={RetinaImg.Mode.ContentIsMask}
				/>
			</div>
		);
	}
}

export default ActivityListButton;
