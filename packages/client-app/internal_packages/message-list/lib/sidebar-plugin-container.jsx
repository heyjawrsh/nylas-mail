'use strict';

const _ = require('underscore');
const React = require("react");
const {FocusedContactsStore} = require("nylas-exports");
const {InjectedComponentSet} = require("nylas-component-kit");

class FocusedContactStorePropsContainer extends React.Component {
  static displayName = 'FocusedContactStorePropsContainer';

  constructor(props) {
    super(props);
    this._onChange = this._onChange.bind(this);
    this._getStateFromStores = this._getStateFromStores.bind(this);
    this.state = this._getStateFromStores();
  }

  componentDidMount() { this.unsubscribe = FocusedContactsStore.listen(this._onChange); }
  componentWillUnmount() { return this.unsubscribe(); }

  render() {
    let inner;
    let classname = "sidebar-section";
    if (this.state.focusedContact) {
      classname += " visible";
      inner = React.cloneElement(this.props.children, this.state);
    }
    return <div className={classname}>{inner}</div>;
  }

  _onChange() { return this.setState(this._getStateFromStores()); }
  _getStateFromStores() {
    return {
      sortedContacts: FocusedContactsStore.sortedContacts(),
      focusedContact: FocusedContactsStore.focusedContact(),
      focusedContactThreads: FocusedContactsStore.focusedContactThreads()
    };
  }
}

class SidebarPluginContainer extends React.Component {
  static displayName = 'SidebarPluginContainer';
  static containerStyles = {order: 1, flexShrink: 0, minWidth: 200, maxWidth: 300};

  render() {
    return <FocusedContactStorePropsContainer><SidebarPluginContainerInner /></FocusedContactStorePropsContainer>;
  }
}

class SidebarPluginContainerInner extends React.Component {
  render() {
    return <InjectedComponentSet className="sidebar-contact-card" key={this.props.focusedContact.email}
      matching={{role: "MessageListSidebar:ContactCard"}} direction="column"
      exposedProps={{contact: this.props.focusedContact, contactThreads: this.props.focusedContactThreads}}/>;
  }
}

module.exports = SidebarPluginContainer;
