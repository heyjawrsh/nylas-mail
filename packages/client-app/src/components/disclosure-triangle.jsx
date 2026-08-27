/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
import PropTypes from "prop-types";
import React from "react";

class DisclosureTriangle extends React.Component {
	static initClass() {
		DisclosureTriangle.displayName = "DisclosureTriangle";

		DisclosureTriangle.propTypes = {
			collapsed: PropTypes.bool,
			visible: PropTypes.bool,
			onCollapseToggled: PropTypes.func,
		};

		DisclosureTriangle.defaultProps = { onCollapseToggled() {} };
	}

	render() {
		let classnames = "disclosure-triangle";
		if (this.props.visible) {
			classnames += " visible";
		}
		if (this.props.collapsed) {
			classnames += " collapsed";
		}
		return React.createElement(
			"div",
			{ className: classnames, onClick: this.props.onCollapseToggled },
			React.createElement("div", null),
		);
	}
}
DisclosureTriangle.initClass();

module.exports = DisclosureTriangle;
