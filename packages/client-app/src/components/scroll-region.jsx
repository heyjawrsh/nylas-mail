/*
 * decaffeinate suggestions:
 * DS002: Fix invalid constructor
 * DS102: Remove unnecessary code created because of implicit returns
 * DS104: Avoid inline assignments
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
const _ = require("underscore");
const React = require("react");
const ReactDOM = require("react-dom");
const { Utils } = require("nylas-exports");
const classNames = require("classnames");
const ScrollbarTicks = require("./scrollbar-ticks").default;

class Scrollbar extends React.Component {
	static initClass() {
		Scrollbar.displayName = "Scrollbar";
		Scrollbar.propTypes = {
			scrollTooltipComponent: PropTypes.func,
			// A scrollbarTickProvider is any object that has the `listen` and
			// `scrollbarTicks` method. Since ScrollRegions tend to encompass large
			// render trees it's more efficent for the scrollbar to listen for its
			// own state then have it passed down as new props and potentially
			// cause re-renders of the whole scroll region. The `scrollbarTicks`
			// method must return an array of numbers between 0 and 1 which
			// represent the height percentages at which tick marks will be
			// rendered.
			scrollbarTickProvider: PropTypes.object,
			getScrollRegion: PropTypes.func,
		};
	}

	constructor(props) {
		super();
		this.shouldComponentUpdate = this.shouldComponentUpdate.bind(this);
		this.componentWillUnmount = this.componentWillUnmount.bind(this);
		this.recomputeDimensions = this.recomputeDimensions.bind(this);
		this._onTickProviderChange = this._onTickProviderChange.bind(this);
		this._recomputeDimensions = this._recomputeDimensions.bind(this);
		this._scrollbarHandleStyles = this._scrollbarHandleStyles.bind(this);
		this._scrollbarWrapStyles = this._scrollbarWrapStyles.bind(this);
		this._onHandleDown = this._onHandleDown.bind(this);
		this._onHandleMove = this._onHandleMove.bind(this);
		this._onHandleUp = this._onHandleUp.bind(this);
		this._onHandleClick = this._onHandleClick.bind(this);
		this._onScrollJump = this._onScrollJump.bind(this);
		this._getHandleHeight = this._getHandleHeight.bind(this);
		this.props = props;
		this.state = {
			totalHeight: 0,
			trackHeight: 0,
			viewportHeight: 0,
			viewportScrollTop: 0,
			dragging: false,
			scrolling: false,
			scrollbarTicks: [],
		};
	}

	componentDidMount() {
		if (
			this.props.scrollbarTickProvider != null
				? this.props.scrollbarTickProvider.listen
				: undefined
		) {
			return (this._tickUnsub = this.props.scrollbarTickProvider.listen(
				this._onTickProviderChange,
			));
		}
	}

	shouldComponentUpdate(nextProps, nextState) {
		return (
			!Utils.isEqualReact(nextProps, this.props) ||
			!Utils.isEqualReact(nextState, this.state)
		);
	}

	componentWillUnmount() {
		this._onHandleUp({ preventDefault() {} });
		return typeof this._tickUnsub === "function"
			? this._tickUnsub()
			: undefined;
	}

	setStateFromScrollRegion(state) {
		return this.setState(state);
	}

	render() {
		const containerClasses = classNames({
			"scrollbar-track": true,
			dragging: this.state.dragging,
			scrolling: this.state.scrolling,
			"with-ticks": this.state.scrollbarTicks.length > 0,
		});

		let tooltip = [];
		if (this.props.scrollTooltipComponent && this.state.dragging) {
			tooltip = React.createElement(this.props.scrollTooltipComponent, {
				viewportCenter:
					this.state.viewportScrollTop + this.state.viewportHeight / 2,
				totalHeight: this.state.totalHeight,
			});
		}

		return React.createElement(
			"div",
			{
				className: containerClasses,
				style: this._scrollbarWrapStyles(),
				onMouseEnter: this.recomputeDimensions,
			},
			React.createElement(
				"div",
				{
					className: "scrollbar-track-inner",
					ref: "track",
					onClick: this._onScrollJump,
				},
				this._renderScrollbarTicks(),
				React.createElement(
					"div",
					{
						className: "scrollbar-handle",
						onMouseDown: this._onHandleDown,
						style: this._scrollbarHandleStyles(),
						ref: "handle",
						onClick: this._onHandleClick,
					},
					React.createElement("div", { className: "tooltip" }, tooltip),
				),
			),
		);
	}

	recomputeDimensions(options) {
		if (options == null) {
			options = {};
		}
		if (this.props.getScrollRegion != null) {
			this.props.getScrollRegion()._recomputeDimensions(options);
		}
		return this._recomputeDimensions(options);
	}

	_onTickProviderChange() {
		if (
			!(this.props.scrollbarTickProvider != null
				? this.props.scrollbarTickProvider.scrollbarTicks
				: undefined)
		) {
			throw new Error(
				"The scrollbarTickProvider must implement `scrollbarTicks`",
			);
		}
		return this.setState({
			scrollbarTicks: this.props.scrollbarTickProvider.scrollbarTicks(),
		});
	}

	_renderScrollbarTicks() {
		if (!(this.state.scrollbarTicks.length > 0)) {
			return false;
		}
		return React.createElement(ScrollbarTicks, {
			ticks: this.state.scrollbarTicks,
		});
	}

	_recomputeDimensions({ useCachedValues }) {
		if (!useCachedValues) {
			const trackNode = ReactDOM.findDOMNode(this.refs.track);
			if (!trackNode) {
				return;
			}
			const trackHeight = trackNode.clientHeight;
			if (trackHeight !== this.state.trackHeight) {
				return this.setState({ trackHeight });
			}
		}
	}

	_scrollbarHandleStyles() {
		const handleHeight = this._getHandleHeight();
		const handleTop =
			(this.state.viewportScrollTop /
				(this.state.totalHeight - this.state.viewportHeight)) *
			(this.state.trackHeight - handleHeight);

		return {
			position: "relative",
			height: handleHeight || 0,
			top: handleTop || 0,
		};
	}

	_scrollbarWrapStyles() {
		return {
			position: "absolute",
			top: 0,
			bottom: 0,
			right: 0,
			zIndex: 2,
			visibility:
				this.state.totalHeight !== 0 &&
				this.state.totalHeight === this.state.viewportHeight
					? "hidden"
					: undefined,
		};
	}

	_onHandleDown(event) {
		const handleNode = ReactDOM.findDOMNode(this.refs.handle);
		this._trackOffset = ReactDOM.findDOMNode(
			this.refs.track,
		).getBoundingClientRect().top;
		this._mouseOffsetWithinHandle =
			event.pageY - handleNode.getBoundingClientRect().top;
		window.addEventListener("mousemove", this._onHandleMove);
		window.addEventListener("mouseup", this._onHandleUp);
		this.setState({ dragging: true });
		return event.preventDefault();
	}

	_onHandleMove(event) {
		const trackY =
			event.pageY - this._trackOffset - this._mouseOffsetWithinHandle;
		const trackPxToViewportPx =
			(this.state.totalHeight - this.state.viewportHeight) /
			(this.state.trackHeight - this._getHandleHeight());
		this.props.getScrollRegion().scrollTop = trackY * trackPxToViewportPx;
		return event.preventDefault();
	}

	_onHandleUp(event) {
		window.removeEventListener("mousemove", this._onHandleMove);
		window.removeEventListener("mouseup", this._onHandleUp);
		this.setState({ dragging: false });
		return event.preventDefault();
	}

	_onHandleClick(event) {
		// Avoid event propogating up to track
		return event.stopPropagation();
	}

	_onScrollJump(event) {
		this._trackOffset = ReactDOM.findDOMNode(
			this.refs.track,
		).getBoundingClientRect().top;
		this._mouseOffsetWithinHandle = this._getHandleHeight() / 2;
		return this._onHandleMove(event);
	}

	_getHandleHeight() {
		return Math.min(
			this.state.totalHeight,
			Math.max(
				40,
				(this.state.trackHeight / this.state.totalHeight) *
					this.state.trackHeight,
			),
		);
	}
}
Scrollbar.initClass();

/*
The ScrollRegion component attaches a custom scrollbar.
*/
class ScrollRegion extends React.Component {
	static initClass() {
		ScrollRegion.displayName = "ScrollRegion";

		ScrollRegion.propTypes = {
			onScroll: PropTypes.func,
			onScrollEnd: PropTypes.func,
			className: PropTypes.string,
			scrollTooltipComponent: PropTypes.func,
			scrollbarTickProvider: PropTypes.object,
			children: PropTypes.oneOfType([PropTypes.element, PropTypes.array]),
			getScrollbar: PropTypes.func,
		};

		// Concept from https://developer.apple.com/library/prerelease/ios/documentation/UIKit/Reference/UITableView_Class/#//apple_ref/c/tdef/UITableViewScrollPosition

		ScrollRegion.ScrollPosition = {
			// Scroll so that the desired region is at the top of the viewport
			Top: "Top",
			// Scroll so that the desired region is at the bottom of the viewport
			Bottom: "Bottom",
			// Scroll so that the desired region is visible in the viewport, with the
			// least movement possible.
			Visible: "Visible",
			// Scroll so that the desired region is centered in the viewport
			Center: "Center",
			// Scroll so that the desired region is centered in the viewport, only if it
			// is currently not visible
			CenterIfInvisible: "CenterIfInvisible",
		};
	}

	constructor(props) {
		this.componentDidMount = this.componentDidMount.bind(this);
		this.componentDidUpdate = this.componentDidUpdate.bind(this);
		this.UNSAFE_componentWillReceiveProps =
			this.UNSAFE_componentWillReceiveProps.bind(this);
		this.componentWillUnmount = this.componentWillUnmount.bind(this);
		this.shouldComponentUpdate = this.shouldComponentUpdate.bind(this);
		this.shouldInvalidateScrollbarComponent =
			this.shouldInvalidateScrollbarComponent.bind(this);
		this.render = this.render.bind(this);
		this.scrollTo = this.scrollTo.bind(this);
		this._settleHeight = this._settleHeight.bind(this);
		this.recomputeDimensions = this.recomputeDimensions.bind(this);
		this._recomputeDimensions = this._recomputeDimensions.bind(this);
		this._onScroll = this._onScroll.bind(this);
		this._getSelf = this._getSelf.bind(this);
		this.props = props;
		this._scrollToTaskId = 0;
		this._scrollbarComponent = null;
		this.state = {
			totalHeight: 0,
			viewportHeight: 0,
			viewportScrollTop: 0,
			scrolling: false,
		};

		Object.defineProperty(this, "scrollTop", {
			get() {
				return ReactDOM.findDOMNode(this.refs.content).scrollTop;
			},
			set(val) {
				return (ReactDOM.findDOMNode(this.refs.content).scrollTop = val);
			},
		});
	}

	componentDidMount() {
		this._mounted = true;
		this.recomputeDimensions();

		this._heightObserver = new MutationObserver((mutations) => {
			let recompute = false;
			mutations.forEach(
				(mutation) =>
					recompute ||
					(recompute =
						!mutation.oldValue || mutation.oldValue.indexOf("height:") !== -1),
			);
			if (recompute) {
				return this.recomputeDimensions({ useCachedValues: false });
			}
		});

		return this._heightObserver.observe(
			ReactDOM.findDOMNode(this.refs.content),
			{
				subtree: true,
				attributes: true,
				attributeOldValue: true,
				attributeFilter: ["style"],
			},
		);
	}

	componentDidUpdate(prevProps, _prevState) {
		if (!this.state.scrolling && this.props.children !== prevProps.children) {
			return this.recomputeDimensions();
		}
	}

	UNSAFE_componentWillReceiveProps(props) {
		if (this.shouldInvalidateScrollbarComponent(props)) {
			return (this._scrollbarComponent = null);
		}
	}

	componentWillUnmount() {
		this._heightObserver.disconnect();
		return (this._mounted = false);
	}

	shouldComponentUpdate(_newProps, _newState) {
		// Because this component renders @props.children, it needs to update
		// on props.children changes. Unfortunately, computing isEqual on the
		// @props.children tree extremely expensive. Just let React's algorithm do it's work.
		return true;
	}

	shouldInvalidateScrollbarComponent(newProps) {
		if (newProps.scrollTooltipComponent !== this.props.scrollTooltipComponent) {
			return true;
		}
		if (newProps.getScrollbar !== this.props.getScrollbar) {
			return true;
		}
		return false;
	}

	render() {
		const containerClasses =
			`${this.props.className != null ? this.props.className : ""} ` +
			classNames({
				"scroll-region": true,
				dragging: this.state.dragging,
				scrolling: this.state.scrolling,
			});

		if (!this.props.getScrollbar) {
			if (this._scrollbarComponent == null) {
				this._scrollbarComponent = React.createElement(Scrollbar, {
					ref: "scrollbar",
					scrollbarTickProvider: this.props.scrollbarTickProvider,
					scrollTooltipComponent: this.props.scrollTooltipComponent,
					getScrollRegion: this._getSelf,
				});
			}
		}

		const otherProps = Utils.fastOmit(
			this.props,
			Object.keys(this.constructor.propTypes),
		);

		return React.createElement(
			"div",
			Object.assign({ className: containerClasses }, otherProps),
			this._scrollbarComponent,
			React.createElement(
				"div",
				{
					className: "scroll-region-content",
					onScroll: this._onScroll,
					ref: "content",
				},
				React.createElement(
					"div",
					{ className: "scroll-region-content-inner" },
					this.props.children,
				),
			),
		);
	}

	// Public: Scroll to the DOM Node provided.
	//
	scrollTo(node, param) {
		if (param == null) {
			param = {};
		}
		const { position, settle, done } = param;
		if (node instanceof React.Component) {
			node = ReactDOM.findDOMNode(node);
		}
		if (!(node instanceof Node)) {
			throw new Error(
				"ScrollRegion.scrollTo: requires a DOM node or React element. Maybe you meant scrollToRect?",
			);
		}
		return this._scroll({ position, settle, done }, () => {
			return node.getBoundingClientRect();
		});
	}

	// Public: Scroll to the client rectangle provided. Note: This method expects
	// a ClientRect or similar object with top, left, width, height relative to the
	// window, not the scroll region. This is designed to make it easy to use with
	// node.getBoundingClientRect()
	scrollToRect(rect, param) {
		if (param == null) {
			param = {};
		}
		const { position, settle, done } = param;
		if (rect instanceof Node) {
			throw new Error(
				"ScrollRegion.scrollToRect: requires a rect. Maybe you meant scrollTo?",
			);
		}
		if (rect.top == null || rect.height == null) {
			throw new Error(
				"ScrollRegion.scrollToRect: requires a rect with `top` and `height` attributes.",
			);
		}
		return this._scroll({ position, settle, done }, () => rect);
	}

	_scroll({ position, settle, done }, clientRectProviderCallback) {
		let settleFn;
		const contentNode = ReactDOM.findDOMNode(this.refs.content);
		if (position == null) {
			position = ScrollRegion.ScrollPosition.Visible;
		}

		if (settle === true) {
			settleFn = this._settleHeight;
		} else {
			settleFn = (callback) => callback();
		}

		this._scrollToTaskId += 1;
		const taskId = this._scrollToTaskId;

		return settleFn(() => {
			// If another scroll call has been made since ours, don't do anything.
			if (this._scrollToTaskId !== taskId) {
				return typeof done === "function" ? done(false) : undefined;
			}

			const contentClientRect = contentNode.getBoundingClientRect();
			const rect = _.clone(clientRectProviderCallback());

			// For sanity's sake, convert the client rectangle we get into a rect
			// relative to the contentRect of our scroll region.
			rect.top = rect.top - contentClientRect.top + contentNode.scrollTop;
			rect.bottom = rect.bottom - contentClientRect.top + contentNode.scrollTop;

			// Also give ourselves a representation of the visible region, in the same
			// coordinate space as `rect`
			const contentVisibleRect = _.clone(contentClientRect);
			contentVisibleRect.top += contentNode.scrollTop;
			contentVisibleRect.bottom += contentNode.scrollTop;

			if (position === ScrollRegion.ScrollPosition.Top) {
				this.scrollTop = rect.top;
			} else if (position === ScrollRegion.ScrollPosition.Bottom) {
				this.scrollTop = rect.top + rect.height - contentClientRect.height;
			} else if (position === ScrollRegion.ScrollPosition.Center) {
				this.scrollTop =
					rect.top - (contentClientRect.height - rect.height) / 2;
			} else if (position === ScrollRegion.ScrollPosition.CenterIfInvisible) {
				if (!Utils.rectVisibleInRect(rect, contentVisibleRect)) {
					this.scrollTop =
						rect.top - (contentClientRect.height - rect.height) / 2;
				}
			} else if (position === ScrollRegion.ScrollPosition.Visible) {
				const distanceBelowBottom =
					rect.top +
					rect.height -
					(contentClientRect.height + contentNode.scrollTop);
				const distanceAboveTop = this.scrollTop - rect.top;
				if (distanceBelowBottom >= 0) {
					this.scrollTop += distanceBelowBottom;
				} else if (distanceAboveTop >= 0) {
					this.scrollTop -= distanceAboveTop;
				}
			}

			return typeof done === "function" ? done(true) : undefined;
		});
	}

	_settleHeight(callback) {
		const contentNode = ReactDOM.findDOMNode(this.refs.content);
		let lastContentHeight = -1;
		var scrollIfSettled = () => {
			if (!this._mounted) {
				return;
			}
			const contentRect = contentNode.getBoundingClientRect();
			if (contentRect.height !== lastContentHeight) {
				lastContentHeight = contentRect.height;
			} else {
				return callback();
			}
			return window.requestAnimationFrame(scrollIfSettled);
		};
		return scrollIfSettled();
	}

	recomputeDimensions(options) {
		let left;
		if (options == null) {
			options = {};
		}
		const scrollbar =
			(left =
				typeof this.props.getScrollbar === "function"
					? this.props.getScrollbar()
					: undefined) != null
				? left
				: this.refs.scrollbar;
		if (scrollbar) {
			scrollbar._recomputeDimensions(options);
		}
		return this._recomputeDimensions(options);
	}

	_recomputeDimensions({ useCachedValues }) {
		let totalHeight, viewportHeight;
		if (!this.refs.content) {
			return;
		}
		const contentNode = ReactDOM.findDOMNode(this.refs.content);
		if (!contentNode) {
			return;
		}

		const viewportScrollTop = contentNode.scrollTop;

		// While we're scrolling, calls to contentNode.scrollHeight / clientHeight
		// force the browser to immediately flush any DOM changes and compute the
		// height of the node. This hurts performance and also kind of unnecessary,
		// since it's unlikely these values will change while scrolling.
		if (useCachedValues) {
			totalHeight =
				this.state.totalHeight != null
					? this.state.totalHeight
					: contentNode.scrollHeight;
			const _trackHeight =
				this.state.trackHeight != null
					? this.state.trackHeight
					: contentNode.scrollHeight;
			viewportHeight =
				this.state.viewportHeight != null
					? this.state.viewportHeight
					: contentNode.clientHeight;
		} else {
			totalHeight = contentNode.scrollHeight;
			viewportHeight = contentNode.clientHeight;
		}

		if (
			this.state.totalHeight !== totalHeight ||
			this.state.viewportHeight !== viewportHeight ||
			this.state.viewportScrollTop !== viewportScrollTop
		) {
			return this._setSharedState({
				totalHeight,
				viewportScrollTop,
				viewportHeight,
			});
		}
	}

	_setSharedState(state) {
		let left;
		const scrollbar =
			(left =
				typeof this.props.getScrollbar === "function"
					? this.props.getScrollbar()
					: undefined) != null
				? left
				: this.refs.scrollbar;
		if (scrollbar) {
			scrollbar.setStateFromScrollRegion(state);
		}
		return this.setState(state);
	}

	_onScroll(event) {
		// onScroll events propogate, which is a bit strange. We could actually be
		// receiving a scroll event for a textarea inside the scroll region.
		// See Preferences > Signatures > textarea
		if (event.target !== ReactDOM.findDOMNode(this.refs.content)) {
			return;
		}

		if (this.state.scrolling) {
			this.recomputeDimensions({ useCachedValues: true });
		} else {
			this.recomputeDimensions();
			this._setSharedState({ scrolling: true });
		}

		if (typeof this.props.onScroll === "function") {
			this.props.onScroll(event);
		}

		if (this._onScrollEnd == null) {
			this._onScrollEnd = _.debounce(() => {
				this._setSharedState({ scrolling: false });
				this.recomputeDimensions();
				return typeof this.props.onScrollEnd === "function"
					? this.props.onScrollEnd(event)
					: undefined;
			}, 250);
		}
		return this._onScrollEnd();
	}

	_getSelf() {
		return this;
	}
}
ScrollRegion.initClass();

ScrollRegion.Scrollbar = Scrollbar;

module.exports = ScrollRegion;
