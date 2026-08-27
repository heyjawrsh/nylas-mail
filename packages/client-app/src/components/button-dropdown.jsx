/*
 * decaffeinate suggestions:
 * DS002: Fix invalid constructor
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
const RetinaImg = require("./retina-img").default;
const { Utils } = require("nylas-exports");
const classnames = require("classnames");

const React = require("react");
const ReactDOM = require("react-dom");
class ButtonDropdown extends React.Component {
	static initClass() {
		ButtonDropdown.displayName = "ButtonDropdown";
		ButtonDropdown.propTypes = {
			primaryItem: PropTypes.element,
			primaryClick: PropTypes.func,
			bordered: PropTypes.bool,
			menu: PropTypes.element,
			style: PropTypes.object,
			closeOnMenuClick: PropTypes.bool,
		};

		ButtonDropdown.defaultProps = { style: {} };
	}

	constructor(props) {
		super();
		this.render = this.render.bind(this);
		this.toggleDropdown = this.toggleDropdown.bind(this);
		this._onMenuClick = this._onMenuClick.bind(this);
		this._onBlur = this._onBlur.bind(this);
		this.props = props;
		this.state = { open: false };
	}

	render() {
		const classes = classnames({
			"button-dropdown": true,
			"open open-up": this.state.open === "up",
			"open open-down": this.state.open === "down",
			bordered: this.props.bordered !== false,
		});

		if (this.props.primaryClick) {
			return React.createElement(
				"div",
				{
					ref: "button",
					onBlur: this._onBlur,
					tabIndex: -1,
					className: `${classes} ${this.props.className != null ? this.props.className : ""}`,
					style: this.props.style,
				},
				React.createElement(
					"div",
					{
						className: "primary-item",
						title:
							this.props.primaryTitle != null ? this.props.primaryTitle : "",
						onClick: this.props.primaryClick,
					},
					this.props.primaryItem,
				),
				React.createElement(
					"div",
					{ className: "secondary-picker", onClick: this.toggleDropdown },
					React.createElement(RetinaImg, {
						name: "icon-thread-disclosure.png",
						mode: RetinaImg.Mode.ContentIsMask,
					}),
				),
				React.createElement(
					"div",
					{
						ref: "secondaryItems",
						className: "secondary-items",
						onMouseDown: this._onMenuClick,
					},
					this.props.menu,
				),
			);
		} else {
			return React.createElement(
				"div",
				{
					ref: "button",
					onBlur: this._onBlur,
					tabIndex: -1,
					className: `${classes} ${this.props.className != null ? this.props.className : ""}`,
					style: this.props.style,
				},
				React.createElement(
					"div",
					{
						className: "only-item",
						title:
							this.props.primaryTitle != null ? this.props.primaryTitle : "",
						onClick: this.toggleDropdown,
					},
					this.props.primaryItem,
					React.createElement(RetinaImg, {
						name: "icon-thread-disclosure.png",
						style: { marginLeft: 12 },
						mode: RetinaImg.Mode.ContentIsMask,
					}),
				),
				React.createElement(
					"div",
					{
						ref: "secondaryItems",
						className: "secondary-items left",
						onMouseDown: this._onMenuClick,
					},
					this.props.menu,
				),
			);
		}
	}

	toggleDropdown() {
		if (this.state.open !== false) {
			return this.setState({ open: false });
		} else {
			const buttonBottom =
				ReactDOM.findDOMNode(this).getBoundingClientRect().bottom;
			const openHeight = ReactDOM.findDOMNode(
				this.refs.secondaryItems,
			).getBoundingClientRect().height;
			if (buttonBottom + openHeight > window.innerHeight) {
				return this.setState({ open: "up" });
			} else {
				return this.setState({ open: "down" });
			}
		}
	}

	_onMenuClick(_event) {
		if (this.props.closeOnMenuClick) {
			return this.setState({ open: false });
		}
	}

	_onBlur(event) {
		const target = event.nativeEvent.relatedTarget;
		if (
			target != null &&
			ReactDOM.findDOMNode(this.refs.button).contains(target)
		) {
			return;
		}
		return this.setState({ open: false });
	}
}
ButtonDropdown.initClass();

module.exports = ButtonDropdown;
