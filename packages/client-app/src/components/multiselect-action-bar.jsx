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
const React = require("react");
const ReactCSSTransitionGroup = require('react-addons-css-transition-group');
const _ = require('underscore');

const {Utils, Actions} = require("nylas-exports");
const InjectedComponentSet = require('./injected-component-set');
const Flexbox = require('./flexbox').default;

/*
Public: MultiselectActionBar is a simple component that can be placed in a {Sheet} Toolbar.
When the provided `dataStore` has a selection, it appears over the other items in the toolbar.

Generally, you wrap {MultiselectActionBar} in your own simple component to provide a dataStore
and other settings:

```coffee
class MultiselectActionBar extends React.Component
  @displayName: 'MultiselectActionBar'

  render: =>
    <MultiselectActionBar
      dataStore={ThreadListStore}
      className="thread-list"
      collection="thread" />
```

The MultiselectActionBar uses the `ComponentRegistry` to find items to display for the given
collection name. To add an item to the bar created in the example above, register it like this:

```coffee
ComponentRegistry.register ThreadBulkTrashButton,
  role: 'thread:Toolbar'
```

Section: Component Kit
*/
class MultiselectActionBar extends React.Component {
  static initClass() {
    this.displayName = 'MultiselectActionBar';
  
    /*
    Public: React `props` supported by MultiselectActionBar:
  
     - `dataStore` An instance of a {ListDataSource}.
     - `collection` The name of the collection. The collection name is used for the text
        that appears in the bar "1 thread selected" and is also used to find components
        in the component registry that should appear in the bar (`thread` => `thread:BulkAtion`)
    */
    this.propTypes = {
      collection: React.PropTypes.string.isRequired,
      dataSource: React.PropTypes.object
    };
  }

  constructor(props) {
    this.componentDidMount = this.componentDidMount.bind(this);
    this.componentWillReceiveProps = this.componentWillReceiveProps.bind(this);
    this.componentWillUnmount = this.componentWillUnmount.bind(this);
    this.teardownForProps = this.teardownForProps.bind(this);
    this.setupForProps = this.setupForProps.bind(this);
    this.shouldComponentUpdate = this.shouldComponentUpdate.bind(this);
    this.render = this.render.bind(this);
    this._renderBar = this._renderBar.bind(this);
    this._renderActions = this._renderActions.bind(this);
    this._label = this._label.bind(this);
    this._getStateFromStores = this._getStateFromStores.bind(this);
    this._onChange = this._onChange.bind(this);
    this._onClearSelection = this._onClearSelection.bind(this);
    this.props = props;
    this.state = this._getStateFromStores();
  }

  componentDidMount() {
    return this.setupForProps(this.props);
  }

  componentWillReceiveProps(newProps) {
    if (_.isEqual(this.props, newProps)) { return; }
    this.teardownForProps();
    this.setupForProps(newProps);
    return this.setState(this._getStateFromStores(newProps));
  }

  componentWillUnmount() {
    return this.teardownForProps();
  }

  teardownForProps() {
    if (!this._unsubscribers) { return; }
    return Array.from(this._unsubscribers).map((unsubscribe) => unsubscribe());
  }

  setupForProps(props) {
    this._unsubscribers = [];
    return this._unsubscribers.push(props.dataSource.listen(this._onChange));
  }

  shouldComponentUpdate(nextProps, nextState) {
    return !Utils.isEqualReact(nextProps, this.props) ||
    !Utils.isEqualReact(nextState, this.state);
  }

  render() {
    return React.createElement(ReactCSSTransitionGroup, { 
      "className": ("selection-bar"),  
      "transitionName": "selection-bar-absolute",  
      "component": "div",  
      "transitionLeaveTimeout": (200),  
      "transitionEnterTimeout": (200)},
      ( this.state.items.length > 0 ? this._renderBar() : [] )
    );
  }

  _renderBar() {
    return React.createElement("div", {"className": "absolute", "key": "absolute"},
      React.createElement("div", {"className": "inner"},
        (this._renderActions()),

        React.createElement("div", {"className": "centered"},
          (this._label())
        ),

        React.createElement("button", {"style": ({order:100}),  
                "className": "btn btn-toolbar",  
                "onClick": (this._onClearSelection)}, `\
Clear Selection\
`)
      )
    );
  }

  _renderActions() {
    if (!this.props.dataSource) { return React.createElement("div", null); }
    return React.createElement(InjectedComponentSet, {"matching": ({role:`${this.props.collection}:Toolbar`}),  
                          "exposedProps": ({selection: this.props.dataSource.selection, items: this.state.items})});
  }

  _label() {
    if (this.state.items.length > 1) {
      return `${this.state.items.length} ${this.props.collection}s selected`;
    } else if (this.state.items.length === 1) {
      return `${this.state.items.length} ${this.props.collection} selected`;
    } else {
      return "";
    }
  }

  _getStateFromStores(props) {
    let left;
    if (props == null) { ({
      props
    } = this); }
    return {items: (left = props.dataSource.selection.items()) != null ? left : []};
  }

  _onChange() {
    return this.setState(this._getStateFromStores());
  }

  _onClearSelection() {
    this.props.dataSource.selection.clear();
  }
}
MultiselectActionBar.initClass();

module.exports = MultiselectActionBar;
