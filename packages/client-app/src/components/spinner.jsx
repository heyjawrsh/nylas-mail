/*
 * decaffeinate suggestions:
 * DS002: Fix invalid constructor
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
import PropTypes from "prop-types";
import React from "react";
import _ReactDOM from "react-dom";
import _ from "underscore";
import classNames from "classnames";

/*
Public: Displays an indeterminate progress indicator in the center of it's
parent component.

Section: Component Kit
*/
class Spinner extends React.Component {
	static initClass() {
		/*
    Public: React `props` supported by Spinner:
  
     - `visible` (optional) Pass true to display the spinner and false to hide it.
     - `withCover` (optiona) Pass true to dim the content behind the spinner.
     - `style` (optional) Additional styles to apply to the spinner.
    */
		Spinner.propTypes = {
			visible: PropTypes.bool,
			withCover: PropTypes.bool,
			style: PropTypes.object,
		};
	}

	constructor(props) {
		super();
		this.componentDidMount = this.componentDidMount.bind(this);
		this.componentWillUnmount = this.componentWillUnmount.bind(this);
		this.UNSAFE_componentWillReceiveProps =
			this.UNSAFE_componentWillReceiveProps.bind(this);
		this.pauseAfterDelay = this.pauseAfterDelay.bind(this);
		this.showAfterDelay = this.showAfterDelay.bind(this);
		this.render = this.render.bind(this);
		this._renderDotsWithCover = this._renderDotsWithCover.bind(this);
		this._renderSpinnerDots = this._renderSpinnerDots.bind(this);
		this.props = props;
		this.timer = null;
		this.state = {
			hidden: true,
			paused: true,
		};
	}

	componentDidMount() {
		// The spinner always starts hidden. After it's mounted, it unhides itself
		// if it's set to visible. This is a bit strange, but ensures that the CSS
		// transition from .spinner.hidden => .spinner always happens, along with
		// it's associated animation delay.
		if (this.props.visible && this.state.hidden) {
			return this.showAfterDelay();
		}
	}

	componentWillUnmount() {
		if (this.timer) {
			return clearTimeout(this.timer);
		}
	}

	UNSAFE_componentWillReceiveProps(nextProps) {
		// If we have a cover, show right away.
		if (nextProps.withCover) {
			this.setState({ hidden: !nextProps.visible });
			return;
		}

		const hidden = nextProps.visible != null ? !nextProps.visible : false;

		if (this.state.hidden === false && hidden === true) {
			this.setState({ hidden: true });
			return this.pauseAfterDelay();
		} else if (this.state.hidden === true && hidden === false) {
			return this.showAfterDelay();
		}
	}

	pauseAfterDelay() {
		if (this.timer) {
			clearTimeout(this.timer);
		}
		return (this.timer = setTimeout(() => {
			if (this.props.visible) {
				return;
			}
			return this.setState({ paused: true });
		}, 250));
	}

	showAfterDelay() {
		if (this.timer) {
			clearTimeout(this.timer);
		}
		return (this.timer = setTimeout(() => {
			if (this.props.visible !== true) {
				return;
			}
			return this.setState({ paused: false, hidden: false });
		}, 300));
	}

	render() {
		if (this.props.withCover) {
			return this._renderDotsWithCover();
		} else {
			return this._renderSpinnerDots();
		}
	}

	// This displays an extra div that's a partially transparent white cover.
	// If you don't want to make your own background for the loading state,
	// this is a convenient default.
	_renderDotsWithCover() {
		const coverClasses = classNames({
			"spinner-cover": true,
			hidden: this.state.hidden,
		});

		const style = Object.assign(
			{},
			this.props.style != null ? this.props.style : {},
			{
				position: "absolute",
				display: this.state.hidden ? "none" : "block",
				top: 0,
				left: 0,
				width: "100%",
				height: "100%",
				background: "rgba(255,255,255,0.9)",
				zIndex: 1000,
			},
		);

		return React.createElement(
			"div",
			{ className: coverClasses, style: style },
			this._renderSpinnerDots(),
		);
	}

	_renderSpinnerDots() {
		const spinnerClass = classNames({
			spinner: true,
			hidden: this.state.hidden,
			paused: this.state.paused,
		});

		const style = _.extend(
			{},
			this.props.style != null ? this.props.style : {},
			{
				position: "absolute",
				left: "50%",
				top: "50%",
				zIndex: 1001,
				transform: "translate(-50%,-50%)",
			},
		);

		const otherProps = _.omit(
			this.props,
			Object.keys(this.constructor.propTypes),
		);

		return React.createElement(
			"div",
			Object.assign({ className: spinnerClass }, otherProps, { style: style }),
			React.createElement("div", { className: "bounce1" }),
			React.createElement("div", { className: "bounce2" }),
			React.createElement("div", { className: "bounce3" }),
			React.createElement("div", { className: "bounce4" }),
		);
	}
}
Spinner.initClass();

module.exports = Spinner;
