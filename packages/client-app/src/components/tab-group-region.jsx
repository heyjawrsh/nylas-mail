/*
 * decaffeinate suggestions:
 * DS002: Fix invalid constructor
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS202: Simplify dynamic range loops
 * DS206: Consider reworking classes to avoid initClass
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
import PropTypes from "prop-types";
const React = require("react");
const ReactDOM = require("react-dom");

class TabGroupRegion extends React.Component {
	constructor(...args) {
		this._onKeyDown = this._onKeyDown.bind(this);
		this.shiftFocus = this.shiftFocus.bind(this);
		this.getChildContext = this.getChildContext.bind(this);
		super(...args);
	}

	static initClass() {
		TabGroupRegion.childContextTypes = { parentTabGroup: PropTypes.object };
	}

	_onKeyDown(event) {
		if (event.key === "Tab" && !event.defaultPrevented) {
			const dir = event.shiftKey ? -1 : 1;
			this.shiftFocus(dir);
			event.preventDefault();
			event.stopPropagation();
		}
	}

	shiftFocus(dir) {
		const nodes = ReactDOM.findDOMNode(this).querySelectorAll(
			"input, textarea, [contenteditable], [tabIndex]",
		);
		const current = document.activeElement;
		let idx = Array.from(nodes).indexOf(current);

		for (
			let i = 0, end = nodes.length, asc = 0 <= end;
			asc ? i <= end : i >= end;
			asc ? i++ : i--
		) {
			idx = idx + dir;
			if (idx < 0) {
				idx = nodes.length - 1;
			} else {
				idx = idx % nodes.length;
			}

			if (nodes[idx].tabIndex === -1) {
				continue;
			}
			nodes[idx].focus();
			if (this._shouldSelectEnd(nodes[idx])) {
				nodes[idx].setSelectionRange(
					nodes[idx].value.length,
					nodes[idx].value.length,
				);
			}
			return;
		}
	}

	_shouldSelectEnd(node) {
		return (
			node.nodeName === "INPUT" &&
			node.type === "text" &&
			!Array.from(node.classList).includes("no-select-end")
		);
	}

	getChildContext() {
		return { parentTabGroup: this };
	}

	render() {
		return React.createElement(
			"div",
			Object.assign({}, this.props, { onKeyDown: this._onKeyDown }),
			this.props.children,
		);
	}
}
TabGroupRegion.initClass();

module.exports = TabGroupRegion;
