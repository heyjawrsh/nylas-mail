/*
 * decaffeinate suggestions:
 * DS002: Fix invalid constructor
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
const { ComponentRegistry, WorkspaceStore, Actions } = require("nylas-exports");
const { RetinaImg } = require("nylas-component-kit");
const React = require("react");
const _ = require("underscore");

class ModeToggle extends React.Component {
	static initClass() {
		ModeToggle.displayName = "ModeToggle";
	}

	constructor(props) {
		super();
		this.componentDidMount = this.componentDidMount.bind(this);
		this.componentWillUnmount = this.componentWillUnmount.bind(this);
		this.render = this.render.bind(this);
		this._onStateChanged = this._onStateChanged.bind(this);
		this._getStateFromStores = this._getStateFromStores.bind(this);
		this._onToggleMode = this._onToggleMode.bind(this);
		this.props = props;
		this.column = WorkspaceStore.Location.MessageListSidebar;
		this._button = React.createRef();
		this.state = this._getStateFromStores();
	}

	componentDidMount() {
		this._unsubscriber = WorkspaceStore.listen(this._onStateChanged);
		return (this._mounted = true);
	}

	componentWillUnmount() {
		this._mounted = false;
		return typeof this._unsubscriber === "function"
			? this._unsubscriber()
			: undefined;
	}

	// The button, for HasTutorialTip.
	getDOMNode() {
		return this._button.current;
	}

	render() {
		return React.createElement(
			"button",
			{
				ref: this._button,
				className: `btn btn-toolbar mode-toggle mode-${this.state.hidden}`,
				style: { order: 500 },
				title: this.state.hidden ? "Show sidebar" : "Hide sidebar",
				onClick: this._onToggleMode,
			},
			React.createElement(RetinaImg, {
				name: "toolbar-person-sidebar.png",
				mode: RetinaImg.Mode.ContentIsMask,
			}),
		);
	}

	_onStateChanged() {
		// We need to keep track of this because our parent unmounts us in the same
		// event listener cycle that we receive the event in. ie:
		//
		//   for listener in listeners
		//      # 1. workspaceView remove left column
		//      # ---- Mode toggle unmounts, listeners array mutated in place
		//      # 2. ModeToggle update
		if (!this._mounted) {
			return;
		}
		return this.setState(this._getStateFromStores());
	}

	_getStateFromStores() {
		return { hidden: WorkspaceStore.isLocationHidden(this.column) };
	}

	_onToggleMode() {
		return Actions.toggleWorkspaceLocationHidden(this.column);
	}
}
ModeToggle.initClass();

module.exports = ModeToggle;
