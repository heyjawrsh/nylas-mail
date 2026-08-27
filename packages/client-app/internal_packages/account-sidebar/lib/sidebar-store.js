/*
 * decaffeinate suggestions:
 * DS002: Fix invalid constructor
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
const _ = require('underscore');
const NylasStore = require('nylas-store');
const {Actions,
 AccountStore,
 ThreadCountsStore,
 WorkspaceStore,
 OutboxStore,
 FocusedPerspectiveStore,
 CategoryStore} = require('nylas-exports');

const SidebarSection = require('./sidebar-section');
const SidebarActions = require('./sidebar-actions');
const AccountCommands = require('./account-commands');

const Sections = {
  "Standard": "Standard",
  "User": "User"
};

class SidebarStore extends NylasStore {

  constructor() {
    this._onSetCollapsedByKey = this._onSetCollapsedByKey.bind(this);
    this._onSetCollapsedByName = this._onSetCollapsedByName.bind(this);
    this._registerCommands = this._registerCommands.bind(this);
    this._registerMenuItems = this._registerMenuItems.bind(this);
    this._onAccountsChanged = this._onAccountsChanged.bind(this);
    this._onFocusedPerspectiveChanged = this._onFocusedPerspectiveChanged.bind(this);
    this._updateSections = this._updateSections.bind(this);
    if (NylasEnv.savedState.sidebarKeysCollapsed == null) { NylasEnv.savedState.sidebarKeysCollapsed = {}; }

    this._sections = {};
    this._sections[Sections.Standard] = {};
    this._sections[Sections.User] = [];
    this._registerCommands();
    this._registerMenuItems();
    this._registerListeners();
    this._updateSections();
  }

  accounts() {
    return AccountStore.accounts();
  }

  sidebarAccountIds() {
    return FocusedPerspectiveStore.sidebarAccountIds();
  }

  standardSection() {
    return this._sections[Sections.Standard];
  }

  userSections() {
    return this._sections[Sections.User];
  }

  _registerListeners() {
    this.listenTo(Actions.setCollapsedSidebarItem, this._onSetCollapsedByName);
    this.listenTo(SidebarActions.setKeyCollapsed, this._onSetCollapsedByKey);
    this.listenTo(AccountStore, this._onAccountsChanged);
    this.listenTo(FocusedPerspectiveStore, this._onFocusedPerspectiveChanged);
    this.listenTo(WorkspaceStore, this._updateSections);
    this.listenTo(OutboxStore, this._updateSections);
    this.listenTo(ThreadCountsStore, this._updateSections);
    this.listenTo(CategoryStore, this._updateSections);

    this.configSubscription = NylasEnv.config.onDidChange(
      'core.workspace.showUnreadForAllCategories',
      this._updateSections
    );

  }

  _onSetCollapsedByKey(itemKey, collapsed) {
    const currentValue = NylasEnv.savedState.sidebarKeysCollapsed[itemKey];
    if (currentValue !== collapsed) {
      NylasEnv.savedState.sidebarKeysCollapsed[itemKey] = collapsed;
      return this._updateSections();
    }
  }

  _onSetCollapsedByName(itemName, collapsed) {
    let item = _.findWhere(this.standardSection().items, {name: itemName});
    if (!item) {
      for (var section of Array.from(this.userSections())) {
        item = _.findWhere(section.items, {name: itemName});
        if (item) { break; }
      }
    }
    if (!item) { return; }
    return this._onSetCollapsedByKey(item.id, collapsed);
  }

  _registerCommands(accounts) {
    if (accounts == null) { accounts = AccountStore.accounts(); }
    return AccountCommands.registerCommands(accounts);
  }

  _registerMenuItems(accounts) {
    if (accounts == null) { accounts = AccountStore.accounts(); }
    return AccountCommands.registerMenuItems(accounts, FocusedPerspectiveStore.sidebarAccountIds());
  }

  // TODO Refactor this
  // Listen to changes on the account store only for when the account label
  // or order changes. When accounts or added or removed, those changes will
  // come in through the FocusedPerspectiveStore
  _onAccountsChanged() {
    return this._updateSections();
  }

  // TODO Refactor this
  // The FocusedPerspectiveStore tells this store the accounts that should be
  // displayed in the sidebar (i.e. unified inbox vs single account) and will
  // trigger whenever an account is added or removed, as well as when a
  // perspective is focused.
  // However, when udpating the SidebarSections, we also depend on the actual
  // accounts in the AccountStore. The problem is that the FocusedPerspectiveStore
  // triggers before the AccountStore is actually updated, so we need to wait for
  // the AccountStore to get updated (via `defer`) before updateing our sidebar
  // sections
  _onFocusedPerspectiveChanged() {
    return _.defer(() => {
      this._registerCommands();
      this._registerMenuItems();
      return this._updateSections();
    });
  }

  _updateSections() {
    const accounts = FocusedPerspectiveStore.sidebarAccountIds()
      .map(id => AccountStore.accountForId(id))
      .filter(a => !!a);

    if (accounts.length === 0) { return; }
    const multiAccount = accounts.length > 1;

    this._sections[Sections.Standard] = SidebarSection.standardSectionForAccounts(accounts);
    this._sections[Sections.User] = accounts.map(function(acc) {
      const opts = {};
      if (multiAccount) {
        opts.title = acc.label;
        opts.collapsible = true;
      }
      return SidebarSection.forUserCategories(acc, opts);
    });
    return this.trigger();
  }
}


module.exports = new SidebarStore();
