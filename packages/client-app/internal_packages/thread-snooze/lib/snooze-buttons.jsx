import { Component, createRef } from "react";
import PropTypes from "prop-types";
import { Actions, FocusedPerspectiveStore } from "nylas-exports";
import { RetinaImg } from "nylas-component-kit";
import { domNodeOf } from "../../../src/components/dom-node.js";
import SnoozePopover from "./snooze-popover";

class SnoozeButton extends Component {
	static propTypes = {
		className: PropTypes.string,
		threads: PropTypes.array,
		direction: PropTypes.string,
		shouldRenderIconImg: PropTypes.bool,
		getBoundingClientRect: PropTypes.func,
	};

	static defaultProps = {
		className: "btn btn-toolbar",
		direction: "down",
		shouldRenderIconImg: true,
		getBoundingClientRect: (inst) => inst.getDOMNode().getBoundingClientRect(),
	};

	_root = createRef();

	// The button (or the empty span outside the inbox).
	getDOMNode() {
		return this._root.current;
	}

	onClick = (event) => {
		event.stopPropagation();
		const { threads, direction, getBoundingClientRect } = this.props;
		const buttonRect = getBoundingClientRect(this);
		Actions.openPopover(
			<SnoozePopover threads={threads} closePopover={Actions.closePopover} />,
			{ originRect: buttonRect, direction: direction },
		);
	};

	render() {
		if (!FocusedPerspectiveStore.current().isInbox()) {
			return <span ref={this._root} />;
		}
		return (
			<button
				ref={this._root}
				title="Snooze"
				tabIndex={-1}
				className={`snooze-button ${this.props.className}`}
				onClick={this.onClick}
			>
				{this.props.shouldRenderIconImg ? (
					<RetinaImg
						name="toolbar-snooze.png"
						mode={RetinaImg.Mode.ContentIsMask}
					/>
				) : null}
			</button>
		);
	}
}

export class QuickActionSnooze extends Component {
	static displayName = "QuickActionSnooze";

	static propTypes = {
		thread: PropTypes.object,
	};

	static containerRequired = false;

	_root = createRef();

	getDOMNode() {
		return domNodeOf(this._root.current);
	}

	getBoundingClientRect = () => {
		// Grab the parent node because of the zoom applied to this button. If we
		// took this element directly, we'd have to divide everything by 2
		const element = this.getDOMNode().parentNode;
		const { height, width, top, bottom, left, right } =
			element.getBoundingClientRect();

		// The parent node is a bit too much to the left, lets adjust this.
		return { height, width, top, bottom, right, left: left + 5 };
	};

	render() {
		if (!FocusedPerspectiveStore.current().isInbox()) {
			return <span ref={this._root} />;
		}
		return (
			<SnoozeButton
				ref={this._root}
				direction="left"
				threads={[this.props.thread]}
				className="btn action action-snooze"
				shouldRenderIconImg={false}
				getBoundingClientRect={this.getBoundingClientRect}
			/>
		);
	}
}

export class ToolbarSnooze extends Component {
	static displayName = "ToolbarSnooze";

	static propTypes = {
		items: PropTypes.array,
	};

	static containerRequired = false;

	_root = createRef();

	// SnoozeButton's node (or the empty span outside the inbox), for
	// HasTutorialTip.
	getDOMNode() {
		return domNodeOf(this._root.current);
	}

	render() {
		if (!FocusedPerspectiveStore.current().isInbox()) {
			return <span ref={this._root} />;
		}
		return <SnoozeButton ref={this._root} threads={this.props.items} />;
	}
}
