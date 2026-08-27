/*
 * decaffeinate suggestions:
 * DS002: Fix invalid constructor
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
const _ = require('underscore');
const React = require('react');
const SwipeContainer = require('./swipe-container').default;
const {Utils} = require('nylas-exports');

class ListTabularItem extends React.Component {
  constructor(...args) {
    this.shouldComponentUpdate = this.shouldComponentUpdate.bind(this);
    this.render = this.render.bind(this);
    this._columns = this._columns.bind(this);
    this._onClick = this._onClick.bind(this);
    super(...args);
  }

  static initClass() {
    this.displayName = 'ListTabularItem';
    this.propTypes = {
      metrics: React.PropTypes.object,
      columns: React.PropTypes.arrayOf(React.PropTypes.object).isRequired,
      item: React.PropTypes.object.isRequired,
      itemProps: React.PropTypes.object,
      onSelect: React.PropTypes.func,
      onClick: React.PropTypes.func,
      onDoubleClick: React.PropTypes.func
    };
  }

  // DO NOT DELETE unless you know what you're doing! This method cuts
  // React.Perf.wasted-time from ~300msec to 20msec by doing a deep
  // comparison of props before triggering a re-render.
  shouldComponentUpdate(nextProps, nextState) {
    if (!Utils.isEqualReact(this.props.item, nextProps.item) || (this.props.columns !== nextProps.columns)) {
      this._columnCache = null;
      return true;
    }
    if (!Utils.isEqualReact(Utils.fastOmit(this.props, ['item']), Utils.fastOmit(nextProps, ['item']))) {
      return true;
    }
    return false;
  }

  render() {
    const className = `list-item list-tabular-item ${(this.props.itemProps != null ? this.props.itemProps.className : undefined)}`;
    const props = Utils.fastOmit(this.props.itemProps != null ? this.props.itemProps : {}, ['className']);

    // It's expensive to compute the contents of columns (format timestamps, etc.)
    // We only do it if the item prop has changed.
    if (this._columnCache == null) { this._columnCache = this._columns(); }

    return React.createElement(SwipeContainer, Object.assign({},  props, {"onClick": (this._onClick), "style": ({position:'absolute', top: this.props.metrics.top, width:'100%', height:this.props.metrics.height})}),
      React.createElement("div", {"className": (className), "style": ({height: this.props.metrics.height})},
        (this._columnCache)
      )
    );
  }

  _columns() {
    const names = {};
    return (this.props.columns != null ? this.props.columns : []).map(column => {
      if (names[column.name]) {
        console.warn(`ListTabular: Columns do not have distinct names, will cause React error! \`${column.name}\` twice.`);
      }
      names[column.name] = true;

      return React.createElement("div", {"key": (column.name),  
           "style": ({flex: column.flex, width: column.width}),  
           "className": `list-column list-column-${column.name}`},
        (column.resolver(this.props.item, this))
      );
    });
  }

  _onClick(event) {
    if (typeof this.props.onSelect === 'function') {
      this.props.onSelect(this.props.item, event);
    }

    if (typeof this.props.onClick === 'function') {
      this.props.onClick(this.props.item, event);
    }
    if ((this._lastClickTime != null) && ((Date.now() - this._lastClickTime) < 350)) {
      if (typeof this.props.onDoubleClick === 'function') {
        this.props.onDoubleClick(this.props.item, event);
      }
    }

    return this._lastClickTime = Date.now();
  }
}
ListTabularItem.initClass();


module.exports = ListTabularItem;
