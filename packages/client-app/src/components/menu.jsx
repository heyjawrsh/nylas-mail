/*
 * decaffeinate suggestions:
 * DS002: Fix invalid constructor
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__, or convert again using --optional-chaining
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
const React = require('react');
const ReactDOM = require('react-dom');
const classNames = require('classnames');
const _ = require('underscore');
const {DOMUtils} = require('nylas-exports');
const {CompositeDisposable} = require('event-kit');

/*
Public: `MenuItem` components can be provided to the {Menu} by the `itemContent` function.
MenuItem's props allow you to display dividers as well as standard items.

Section: Component Kit
*/
class MenuItem extends React.Component {
  constructor(...args) {
    this.render = this.render.bind(this);
    super(...args);
  }

  static initClass() {
  
    this.displayName = 'MenuItem';
  
    /*
    Public: React `props` supported by MenuItem:
  
     - `divider` (optional) Pass a {Boolean} to render the menu item as a section divider.
     - `key` (optional) Pass a {String} to be the React key to optimize rendering lists of items.
     - `selected` (optional) Pass a {Boolean} to specify whether the item is selected.
     - `checked` (optional) Pass a {Boolean} to specify whether the item is checked.
    */
    this.propTypes = {
      divider: PropTypes.oneOfType([PropTypes.string, PropTypes.bool]),
      selected: PropTypes.bool,
      checked: PropTypes.bool
    };
  }

  render() {
    if (this.props.divider) {
      const dividerLabel = _.isString(this.props.divider) ? this.props.divider : '';
      return React.createElement("div", {"className": "item divider"},
        (dividerLabel)
      );
    } else {
      const className = classNames({
        "item": true,
        "selected": this.props.selected,
        "checked": this.props.checked
      });
      return React.createElement("div", {"className": (className), "onMouseDown": (this.props.onMouseDown)},
        (this.props.content)
      );
    }
  }
}
MenuItem.initClass();

/*
Public: React component for a {Menu} item that displays a name and email address.

Section: Component Kit
*/
class MenuNameEmailItem extends React.Component {
  constructor(...args) {
    this.render = this.render.bind(this);
    super(...args);
  }

  static initClass() {
    this.displayName = 'MenuNameEmailItem';
  
    /*
    Public: React `props` supported by MenuNameEmailItem:
  
     - `name` (optional) The {String} name to be displayed.
     - `email` (optional) The {String} email address to be displayed.
    */
    this.propTypes = {
      name: PropTypes.string,
      email: PropTypes.string
    };
  }

  render() {
    if (((this.props.name != null ? this.props.name.length : undefined) > 0) && (this.props.name !== this.props.email)) {
      return React.createElement("span", null,
        React.createElement("span", {"className": "primary"}, (this.props.name)),
        React.createElement("span", {"className": "secondary"}, (`(${this.props.email})`))
      );
    } else {
      return React.createElement("span", {"className": "primary"}, (this.props.email));
    }
  }
}
MenuNameEmailItem.initClass();

/*
Public: React component for multi-section Menus with key binding

The Menu component allows you to display a list of items. Menu takes care of
several important things, ensuring that your menu is consistent with the rest
of the N1 application and offers a near-native experience:

- Keyboard Interaction with the Up and Down arrow keys, Enter to select
- Maintaining selection across content changes
- Highlighted state

Menus are often, but not always, used in conjunction with {Popover} to display
a floating "popup" menu. See `template-picker.cjsx` for an example.

The Menu also exposes "header" and "footer" regions you can fill with arbitrary
components by providing the `headerComponents` and `footerComponents` props.
These items are nested within `.header-container`. and `.footer-container`,
and you can customize their appearance by providing CSS selectors scoped to your
component's Menu instance:

```css
.template-picker .menu .header-container {
  height: 100px;
}
```

Section: Component Kit
*/
class Menu extends React.Component {
  static initClass() {
    this.displayName = 'Menu';
  
    /*
    Public: React `props` supported by Menu:
  
     - `className` (optional) The {String} class name applied to the Menu
  
     - `itemContent` A {Function} that returns a {MenuItem}, {String}, or
       React component for the given `item`.
  
       If you return a {MenuItem}, your item is injected into the list directly.
  
       If you return a string or React component, the result is placed within a
       {MenuItem}, resulting in the following DOM:
       `<div className="item [selected]">{your content}</div>`.
  
       To create dividers and other special menu items, return an instance of:
  
       <Menu.Item divider="Label">
  
     - `itemKey` A {Function} that returns a unique string key for the given `item`.
       Keys are important for efficient React rendering when `items` is changed, and a
       key function is required.
  
     - `itemChecked` A {Function} that returns true if the given item should be shown
       with a checkmark. If you don't provide an implementation for `itemChecked`, no
       checkmarks are ever shown.
  
     - `items` An {Array} of arbitrary objects the menu should display.
  
     - `onSelect` A {Function} called with the selected item when the user clicks
       an item in the menu or confirms their selection with the Enter key.
  
     - `onEscape` A {Function} called when a user presses escape in the input.
  
     - `defaultSelectedIndex` The index of the item first selected if there
     was no other previous index. Defaults to 0. Set to -1 if you want
     nothing selected.
  
    */
    this.propTypes = {
      className: PropTypes.string,
      footerComponents: PropTypes.node,
      headerComponents: PropTypes.node,
      itemContext: PropTypes.object,
      itemContent: PropTypes.func.isRequired,
      itemKey: PropTypes.func.isRequired,
      itemChecked: PropTypes.func,
  
      items: PropTypes.array.isRequired,
  
      onSelect: PropTypes.func.isRequired,
  
      onEscape: PropTypes.func,
  
      defaultSelectedIndex: PropTypes.number
    };
  
    this.defaultProps =
      {onEscape() {}};
  }

  constructor(props) {
    this.getSelectedItem = this.getSelectedItem.bind(this);
    this.clearSelection = this.clearSelection.bind(this);
    this.componentDidMount = this.componentDidMount.bind(this);
    this.componentWillUnmount = this.componentWillUnmount.bind(this);
    this.UNSAFE_componentWillReceiveProps = this.UNSAFE_componentWillReceiveProps.bind(this);
    this.componentDidUpdate = this.componentDidUpdate.bind(this);
    this.render = this.render.bind(this);
    this._onKeyDown = this._onKeyDown.bind(this);
    this._contentContainer = this._contentContainer.bind(this);
    this._onShiftSelectedIndex = this._onShiftSelectedIndex.bind(this);
    this._onEnter = this._onEnter.bind(this);
    this._onEscape = this._onEscape.bind(this);
    this.props = props;
    this._mounted = false;
    this.state =
      {selectedIndex: this.props.defaultSelectedIndex != null ? this.props.defaultSelectedIndex : 0};
  }

  // Public: Returns the currently selected item.
  //
  getSelectedItem() {
    return this.props.items[this.state.selectedIndex];
  }

  // TODO this is a hack, refactor
  clearSelection() {
    return setImmediate(() => {
      if (this._mounted === false) { return; }
      return this.setState({selectedIndex: -1});
    });
  }

  componentDidMount() {
    return this._mounted = true;
  }

  componentWillUnmount() {
    return this._mounted = false;
  }

  UNSAFE_componentWillReceiveProps(newProps) {
    // Attempt to preserve selection across props.items changes by
    // finding an item in the new list with a key matching the old
    // selected item's key
    let newSelectionIndex, selection;
    if (this.state.selectedIndex >= 0) {
      selection = this.props.items[this.state.selectedIndex];
      newSelectionIndex = 0;
    } else {
      newSelectionIndex = newProps.defaultSelectedIndex != null ? newProps.defaultSelectedIndex : -1;
    }

    if (selection != null) {
      const selectionKey = this.props.itemKey(selection);
      const newSelection = _.find(newProps.items, item => this.props.itemKey(item) === selectionKey);
      if (newSelection != null) { newSelectionIndex = newProps.items.indexOf(newSelection); }
    }

    return this.setState({
      selectedIndex: newSelectionIndex});
  }

  componentDidUpdate() {
    const item = ReactDOM.findDOMNode(this).querySelector(".selected");
    const container = ReactDOM.findDOMNode(this).querySelector(".content-container");
    const adjustment = DOMUtils.scrollAdjustmentToMakeNodeVisibleInContainer(item, container);
    if (adjustment !== 0) {
      return container.scrollTop += adjustment;
    }
  }

  render() {
    const hc = this.props.headerComponents != null ? this.props.headerComponents : React.createElement("span", null);
    const fc = this.props.footerComponents != null ? this.props.footerComponents : React.createElement("span", null);
    const className = this.props.className ? this.props.className : '';
    return React.createElement("div", {"onKeyDown": (this._onKeyDown),  
         "className": (`menu ${className}`),  
         "tabIndex": "-1"},
      React.createElement("div", {"className": "header-container"},
        (hc)
      ),
      (this._contentContainer()),
      React.createElement("div", {"className": "footer-container"},
        (fc)
      )
    );
  }

  _onKeyDown(event) {
    if (this.props.items.length === 0) { return; }
    event.stopPropagation();
    if (["Enter", "Return"].includes(event.key)) {
      this._onEnter();
    }
    if (event.key === "Escape") {
      this._onEscape();
    } else if ((event.key === "ArrowUp") || ((event.key === "Tab") && event.shiftKey)) {
      this._onShiftSelectedIndex(-1);
      event.preventDefault();
    } else if ((event.key === "ArrowDown") || (event.key === "Tab")) {
      this._onShiftSelectedIndex(1);
      event.preventDefault();
    }

  }

  _contentContainer() {
    const seenItemKeys = {};

    const items = (this.props.items || []).map((item, i) => {
      const content = this.props.itemContent(item);
      if (React.isValidElement(content) && (content.type === MenuItem)) {
        return content;
      }

      const onMouseDown = event => {
        event.preventDefault();
        return this.setState({selectedIndex: i}, () => {
          if (this.props.onSelect) { return this.props.onSelect(item); }
        });
      };

      const key = this.props.itemKey(item);
      if (!key) {
        console.warn("Menu parent did not return an itemKey for item", item);
      }
      if (seenItemKeys[key]) {
        console.warn({"Menu items have colliding keys": item}, seenItemKeys[key]);
      }
      seenItemKeys[key] = item;

      return React.createElement(MenuItem, { 
        "key": (key),  
        "onMouseDown": (onMouseDown),  
        "checked": (typeof this.props.itemChecked === 'function' ? this.props.itemChecked(item) : undefined),  
        "content": (content),  
        "selected": (this.state.selectedIndex === i)
      });
    });

    const contentClass = classNames({
      'content-container': true,
      'empty': items.length === 0
    });

    return React.createElement("div", {"className": (contentClass)},
      (items)
    );
  }

  _onShiftSelectedIndex(delta) {
    if (this.props.items.length === 0) { return; }

    let index = this.state.selectedIndex + delta;

    let isDivider = true;
    while (isDivider) {
      var item = this.props.items[index];
      if (!item) { break; }
      if (__guard__(this.props.itemContent(item, this.props.itemContext).props, x => x.divider)) {
        if (delta > 0) { index += 1;
        } else if (delta < 0) { index -= 1; }
      } else { isDivider = false; }
    }

    index = Math.max(0, Math.min(this.props.items.length-1, index));

    // Update the selected index
    return this.setState({selectedIndex: index});
  }

  _onEnter() {
    const item = this.props.items[this.state.selectedIndex];
    if (item != null) { return this.props.onSelect(item); }
  }

  _onEscape() {
    return this.props.onEscape();
  }
}
Menu.initClass();


Menu.Item = MenuItem;
Menu.NameEmailItem = MenuNameEmailItem;

module.exports = Menu;

function __guard__(value, transform) {
  return (typeof value !== 'undefined' && value !== null) ? transform(value) : undefined;
}