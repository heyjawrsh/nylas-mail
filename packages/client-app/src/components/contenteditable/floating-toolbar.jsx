/*
 * decaffeinate suggestions:
 * DS002: Fix invalid constructor
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS104: Avoid inline assignments
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
import PropTypes from "prop-types";
import _ from "underscore";
import classNames from "classnames";
import React from "react";

// Positions and renders a FloatingToolbar in the composer.
//
// The FloatingToolbar declaratively chooses a Component to render. Only
// extensions that expose a `toolbarComponentConfig` will be considered.
// Whether or not there's an available component to render determines
// whether or not the FloatingToolbar is visible.
//
// There's no `toolbarVisible` state. It uses the existance of a
// ToolbarComponent to determine what to display.
//
// The {ToolbarButtonManager} and the {LinkManager} are `coreExtensions`
// that declaratively register the special `<ToolbarButtons/>` component
// and the `<LinkEditor />` component.
class FloatingToolbar extends React.Component {
	static initClass() {
		FloatingToolbar.displayName = "FloatingToolbar";

		// We are passed an array of Extensions. Those that implement the
		// `toolbarButton` and/or the `toolbarComponent` methods will be
		// injected into the Toolbar.
		//
		// Every time the `innerState` of the `Contenteditable` change, we get
		// passed the data as new `innerProps`.
		FloatingToolbar.propTypes = {
			atomicEdit: PropTypes.func,
			extensions: PropTypes.array,
		};
		FloatingToolbar.innerPropTypes = {
			dragging: PropTypes.bool,
			selection: PropTypes.object,
			doubleDown: PropTypes.bool,
			hoveringOver: PropTypes.object,
			editableNode: PropTypes.object,
		};

		FloatingToolbar.defaultProps = { extensions: [] };
		FloatingToolbar.defaultInnerProps = {
			dragging: false,
			selection: null,
			doubleDown: false,
			hoveringOver: null,
			editableNode: null,
		};

		FloatingToolbar.CONTENT_PADDING = 15;
	}

	constructor(props) {
		super();
		this.componentWillReceiveInnerProps =
			this.componentWillReceiveInnerProps.bind(this);
		this.UNSAFE_componentWillReceiveProps =
			this.UNSAFE_componentWillReceiveProps.bind(this);
		this._calculatePositionState = this._calculatePositionState.bind(this);
		this._toolbarClasses = this._toolbarClasses.bind(this);
		this._toolbarStyles = this._toolbarStyles.bind(this);
		this._toolbarLeft = this._toolbarLeft.bind(this);
		this._toolbarPointerStyles = this._toolbarPointerStyles.bind(this);
		this._renderPointer = this._renderPointer.bind(this);
		this.props = props;
		this.state = {
			toolbarTop: 0,
			toolbarMode: "buttons",
			toolbarLeft: 0,
			toolbarPos: "above",
			editAreaWidth: 9999, // This will get set on first selection
			toolbarWidth: 0,
			toolbarHeight: 0,
			toolbarComponent: null,
			toolbarLocationRef: null,
			toolbarComponentProps: {},
			hidePointer: false,
		};
		this.innerProps = FloatingToolbar.defaultInnerProps;
	}

	shouldComponentUpdate(nextProps, nextState) {
		return (
			!Utils.isEqualReact(nextProps, this.props) ||
			!Utils.isEqualReact(nextState, this.state)
		);
	}

	// Some properties (like whether we're dragging or clicking the mouse)
	// should in a strict-sense be props, but update in a way that's not
	// performant to got through the full React re-rendering cycle,
	// especially given the complexity of the composer component.
	//
	// We call these performance-optimized props & state innerProps and
	// innerState.
	componentWillReceiveInnerProps(nextInnerProps) {
		if (nextInnerProps == null) {
			nextInnerProps = {};
		}
		const fullProps = _.extend({}, this.props, nextInnerProps);
		this.innerProps = _.extend(this.innerProps, nextInnerProps);
		return this.setState(this._getStateFromProps(fullProps));
	}

	UNSAFE_componentWillReceiveProps(nextProps) {
		const fullProps = _.extend(this.innerProps, nextProps);
		return this.setState(this._getStateFromProps(fullProps));
	}

	// The context menu, when activated, needs to make sure that the toolbar
	// is closed. Unfortunately, since there's no onClose callback for the
	// context menu, we can't hook up a reliable declarative state to the
	// menu. We break our declarative pattern in this one case.
	forceClose() {
		return this.setState({ toolbarVisible: false });
	}

	// We render a ToolbarComponent in a floating frame.
	render() {
		const ToolbarComponent = this.state.toolbarComponent;
		if (!ToolbarComponent) {
			return false;
		}

		return React.createElement(
			"div",
			{ className: "floating-toolbar-container" },
			React.createElement(
				"div",
				{
					ref: "floatingToolbar",
					className: this._toolbarClasses(),
					style: this._toolbarStyles(),
				},

				this._renderPointer(),
				React.createElement(
					ToolbarComponent,
					Object.assign({}, this.state.toolbarComponentProps),
				),
			),
		);
	}

	_getStateFromProps(props) {
		let positionState;
		const toolbarComponentState = this._getToolbarComponentData(props);
		if (toolbarComponentState.toolbarLocationRef) {
			positionState = this._calculatePositionState(
				props,
				toolbarComponentState,
			);
		} else {
			positionState = {};
		}

		return _.extend({}, toolbarComponentState, positionState);
	}

	// If this returns a `null` component, that means we don't want to show
	// anything.
	_getToolbarComponentData(props) {
		let toolbarComponent = null;
		let toolbarWidth = 0;
		let toolbarHeight = 0;
		let toolbarLocationRef = null;
		let hidePointer = false;
		let toolbarComponentProps = {};

		for (var extension of Array.from(props.extensions)) {
			try {
				var left;
				var params =
					(left =
						typeof extension.toolbarComponentConfig === "function"
							? extension.toolbarComponentConfig({ toolbarState: props })
							: undefined) != null
						? left
						: {};
				if (params.component) {
					toolbarComponent = params.component;
					toolbarComponentProps = params.props != null ? params.props : {};
					toolbarLocationRef = params.locationRefNode;
					toolbarWidth = params.width;
					toolbarHeight = params.height;
					if (params.hidePointer) {
						({ hidePointer } = params);
					}
				}
			} catch (error) {
				NylasEnv.reportError(error);
			}
		}

		if (toolbarComponent && !toolbarLocationRef) {
			throw new Error(
				`You must provide a locationRefNode for ${toolbarComponent.displayName}. It must be either a DOM Element or a Range.`,
			);
		}

		return {
			toolbarComponent,
			toolbarComponentProps,
			toolbarLocationRef,
			toolbarWidth,
			toolbarHeight,
			hidePointer,
		};
	}

	_calculatePositionState(
		props,
		{ toolbarLocationRef, toolbarWidth, toolbarHeight },
	) {
		const { editableNode } = props;

		if (!_.isFunction(toolbarLocationRef.getBoundingClientRect)) {
			throw new Error(
				"Your locationRefNode must implement getBoundingClientRect. Be aware that Text nodes do not implement this, but Element nodes do. Find the nearest Element relative.",
			);
		}

		const referenceRect = toolbarLocationRef.getBoundingClientRect();

		if (
			!editableNode ||
			!referenceRect ||
			DOMUtils.isEmptyBoundingRect(referenceRect)
		) {
			return {
				toolbarTop: 0,
				toolbarLeft: 0,
				editAreaWidth: 0,
				toolbarPos: "above",
			};
		}

		const TOP_PADDING = 10;

		const BORDER_RADIUS_PADDING = 15;

		const editArea = editableNode.getBoundingClientRect();

		let calcLeft = referenceRect.left - editArea.left + referenceRect.width / 2;
		calcLeft = Math.min(
			Math.max(
				calcLeft,
				FloatingToolbar.CONTENT_PADDING + BORDER_RADIUS_PADDING,
			),
			editArea.width - BORDER_RADIUS_PADDING,
		);

		let calcTop = referenceRect.top - editArea.top - toolbarHeight - 14;
		if (this.state.hidePointer) {
			calcTop += 10;
		}
		let toolbarPos = "above";
		if (calcTop < TOP_PADDING) {
			calcTop =
				referenceRect.top -
				editArea.top +
				referenceRect.height +
				TOP_PADDING +
				4;
			if (this.state.hidePointer) {
				calcTop -= 10;
			}
			toolbarPos = "below";
		}

		const maxWidth = editArea.width - FloatingToolbar.CONTENT_PADDING * 2;

		return {
			toolbarTop: calcTop,
			toolbarLeft: calcLeft,
			toolbarWidth: Math.min(maxWidth, toolbarWidth),
			toolbarHeight,
			editAreaWidth: editArea.width,
			toolbarPos,
		};
	}

	_toolbarClasses() {
		const classes = {};
		classes[this.state.toolbarPos] = true;
		return classNames(
			_.extend(classes, {
				"floating-toolbar": true,
				toolbar: true,
			}),
		);
	}

	_toolbarStyles() {
		const styles = {
			left: this._toolbarLeft(),
			top: this.state.toolbarTop,
			width: this.state.toolbarWidth,
			height: this.state.toolbarHeight,
		};
		return styles;
	}

	_toolbarLeft() {
		const max = Math.max(
			this.state.editAreaWidth -
				this.state.toolbarWidth -
				FloatingToolbar.CONTENT_PADDING,
			FloatingToolbar.CONTENT_PADDING,
		);
		const left = Math.min(
			Math.max(
				this.state.toolbarLeft - this.state.toolbarWidth / 2,
				FloatingToolbar.CONTENT_PADDING,
			),
			max,
		);
		return left;
	}

	_toolbarPointerStyles() {
		const POINTER_WIDTH = 6 + 2; //2px of border-radius
		const max = this.state.editAreaWidth - FloatingToolbar.CONTENT_PADDING;
		const min = FloatingToolbar.CONTENT_PADDING;
		const absoluteLeft = Math.max(Math.min(this.state.toolbarLeft, max), min);
		const relativeLeft = absoluteLeft - this._toolbarLeft();

		const left = Math.max(
			Math.min(relativeLeft, this.state.toolbarWidth - POINTER_WIDTH),
			POINTER_WIDTH,
		);
		const styles = { left };
		return styles;
	}

	_renderPointer() {
		if (this.state.hidePointer) {
			return false;
		}
		return React.createElement(
			"div",
			{
				className: "toolbar-pointer-container",
				style: this._toolbarPointerStyles(),
			},
			React.createElement("div", { className: "shadow" }),
			React.createElement("div", { className: "foreground" }),
		);
	}
}
FloatingToolbar.initClass();

module.exports = FloatingToolbar;
