/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
const React = require('react');

class DisclosureTriangle extends React.Component {
  static initClass() {
    this.displayName = 'DisclosureTriangle';
  
    this.propTypes = {
      collapsed: React.PropTypes.bool,
      visible: React.PropTypes.bool,
      onCollapseToggled: React.PropTypes.func
    };
  
    this.defaultProps =
      {onCollapseToggled() {}};
  }

  render() {
    let classnames = "disclosure-triangle";
    if (this.props.visible) { classnames += " visible"; }
    if (this.props.collapsed) { classnames += " collapsed"; }
    return React.createElement("div", {"className": (classnames), "onClick": (this.props.onCollapseToggled)}, React.createElement("div", null));
  }
}
DisclosureTriangle.initClass();

module.exports = DisclosureTriangle;
