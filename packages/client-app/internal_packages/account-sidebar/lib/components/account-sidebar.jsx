/*
 * decaffeinate suggestions:
 * DS002: Fix invalid constructor
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
const _ = require('underscore');
const React = require('react');
const {Utils, AccountStore} = require('nylas-exports');
const {OutlineView, ScrollRegion, Flexbox} = require('nylas-component-kit');
const AccountSwitcher = require('./account-switcher');
const SidebarStore = require('../sidebar-store');


class AccountSidebar extends React.Component {
  static initClass() {
    this.displayName = 'AccountSidebar';
  
    this.containerRequired = false;
    this.containerStyles = {
      minWidth: 165,
      maxWidth: 250
    };
  }

  constructor(props) {
    this.componentDidMount = this.componentDidMount.bind(this);
    this.shouldComponentUpdate = this.shouldComponentUpdate.bind(this);
    this.componentWillUnmount = this.componentWillUnmount.bind(this);
    this._onStoreChange = this._onStoreChange.bind(this);
    this._getStateFromStores = this._getStateFromStores.bind(this);
    this._renderUserSections = this._renderUserSections.bind(this);
    this.render = this.render.bind(this);
    this.props = props;
    this.state = this._getStateFromStores();
  }

  componentDidMount() {
    this.unsubscribers = [];
    this.unsubscribers.push(SidebarStore.listen(this._onStoreChange));
    return this.unsubscribers.push(AccountStore.listen(this._onStoreChange));
  }

  shouldComponentUpdate(nextProps, nextState) {
    return !Utils.isEqualReact(nextProps, this.props) ||
    !Utils.isEqualReact(nextState, this.state);
  }

  componentWillUnmount() {
    return Array.from(this.unsubscribers).map((unsubscribe) => unsubscribe());
  }

  _onStoreChange() {
    return this.setState(this._getStateFromStores());
  }

  _getStateFromStores() {
    return {
      accounts: AccountStore.accounts(),
      sidebarAccountIds: SidebarStore.sidebarAccountIds(),
      userSections: SidebarStore.userSections(),
      standardSection: SidebarStore.standardSection()
    };
  }

  _renderUserSections(sections) {
    return sections.map(section => {
      return <OutlineView key={section.title} {...section} />;
    });
  }

  render() {
    const {accounts, sidebarAccountIds, userSections, standardSection} = this.state;

    return <Flexbox direction="column" style={{order: 0, flexShrink: 1, flex: 1}}>
      <ScrollRegion className="account-sidebar" style={{order: 2}}>
        <AccountSwitcher accounts={accounts} sidebarAccountIds={sidebarAccountIds} />
        <div className="account-sidebar-sections">
          <OutlineView {...standardSection} />
          {this._renderUserSections(userSections)}
        </div>
      </ScrollRegion>
    </Flexbox>;
  }
}
AccountSidebar.initClass();


module.exports = AccountSidebar;
