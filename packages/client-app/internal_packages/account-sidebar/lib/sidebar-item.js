/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS104: Avoid inline assignments
 * DS204: Change includes calls to have a more natural evaluation order
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
const _ = require('underscore');
const _str = require('underscore.string');
const {WorkspaceStore,
 MailboxPerspective,
 FocusedPerspectiveStore,
 SyncbackCategoryTask,
 DestroyCategoryTask,
 CategoryStore,
 Actions,
 Utils,
 RegExpUtils} = require('nylas-exports');
const {OutlineViewItem} = require('nylas-component-kit');

const SidebarActions = require('./sidebar-actions');

const idForCategories = categories => _.pluck(categories, 'id').join('-');

const countForItem = function(perspective) {
  const unreadCountEnabled = NylasEnv.config.get('core.workspace.showUnreadForAllCategories');
  if (perspective.isInbox() || unreadCountEnabled) {
    return perspective.unreadCount();
  }
  return 0;
};

const isItemSelected = function(perspective) {
  let needle;
  return ((needle = WorkspaceStore.rootSheet(), [WorkspaceStore.Sheet.Threads, WorkspaceStore.Sheet.Drafts].includes(needle)) &&
    FocusedPerspectiveStore.current().isEqual(perspective));
};

const isItemCollapsed = function(id) {
  if (NylasEnv.savedState.sidebarKeysCollapsed[id] !== undefined) {
    return NylasEnv.savedState.sidebarKeysCollapsed[id];
  } else {
    return true;
  }
};

const toggleItemCollapsed = function(item) {
  if (!(item.children.length > 0)) { return; }
  return SidebarActions.setKeyCollapsed(item.id, !isItemCollapsed(item.id));
};

const onDeleteItem = function(item) {
  // TODO Delete multiple categories at once
  if (item.deleted === true) { return; }
  const category = item.perspective.category();
  if (!category) { return; }

  return Actions.queueTask(new DestroyCategoryTask({category}));
};

const onEditItem = function(item, value) {
  let newDisplayName;
  if (!value) { return; }
  if (item.deleted === true) { return; }
  const category = item.perspective.category();
  if (!category) { return; }
  const re = RegExpUtils.subcategorySplitRegex();
  let match = re.exec(category.displayName);
  let lastMatch = match;
  while (match) {
    lastMatch = match;
    match = re.exec(category.displayName);
  }
  if (lastMatch) {
    newDisplayName = category.displayName.slice(0, lastMatch.index + 1) + value;
  } else {
    newDisplayName = value;
  }
  if (newDisplayName === category.displayName) {
    return;
  }
  return Actions.queueTask(new SyncbackCategoryTask({category, displayName: newDisplayName}));
};


class SidebarItem {

  static forPerspective(id, perspective, opts) {
    let counterStyle, left;
    if (opts == null) { opts = {}; }
    if (perspective.isInbox()) { counterStyle = OutlineViewItem.CounterStyles.Alt; }

    return _.extend({
      id,
      name: perspective.name,
      contextMenuLabel: perspective.name,
      count: countForItem(perspective),
      iconName: perspective.iconName,
      children: [],
      perspective,
      selected: isItemSelected(perspective),
      collapsed: (left = isItemCollapsed(id)) != null ? left : true,
      counterStyle,
      onDelete: opts.deletable ? onDeleteItem : undefined,
      onEdited: opts.editable ? onEditItem : undefined,
      onCollapseToggled: toggleItemCollapsed,

      onDrop(item, event) {
        const jsonString = event.dataTransfer.getData('nylas-threads-data');
        let jsonData = null;
        try {
          jsonData = JSON.parse(jsonString);
        } catch (err) {
          console.error(`JSON parse error: ${err}`);
        }
        if (!jsonData) { return; }
        return Actions.moveThreadsToPerspective({
          targetPerspective: item.perspective,
          threadIds: jsonData.threadIds,
          accountIds: jsonData.accountIds,
        });
      },

      shouldAcceptDrop(item, event) {
        const target = item.perspective;
        const current = FocusedPerspectiveStore.current();
        if (!event.dataTransfer.types.includes('nylas-threads-data')) { return false; }
        if (target.isEqual(current)) { return false; }

        // We can't inspect the drag payload until drop, so we use a dataTransfer
        // type to encode the account IDs of threads currently being dragged.
        const accountsType = event.dataTransfer.types.find(t => t.startsWith('nylas-accounts='));
        const accountIds = (accountsType || "").replace('nylas-accounts=', '').split(',');
        return target.canReceiveThreadsFromAccountIds(accountIds);
      },

      onSelect(item) {
        return Actions.focusMailboxPerspective(item.perspective);
      }
    }, opts);
  }


  static forCategories(categories, opts) {
    if (categories == null) { categories = []; }
    if (opts == null) { opts = {}; }
    const id = idForCategories(categories);
    const contextMenuLabel = _str.capitalize(categories[0] != null ? categories[0].displayType() : undefined);
    const perspective = MailboxPerspective.forCategories(categories);

    if (opts.deletable == null) { opts.deletable = true; }
    if (opts.editable == null) { opts.editable = true; }
    opts.contextMenuLabel = contextMenuLabel;
    return this.forPerspective(id, perspective, opts);
  }

  static forSnoozed(accountIds, opts) {
    // TODO This constant should be available elsewhere
    if (opts == null) { opts = {}; }
    const constants = require('../../thread-snooze/lib/snooze-constants');
    const displayName = constants.SNOOZE_CATEGORY_NAME;
    let id = displayName;
    if (opts.name) { id += `-${opts.name}`; }
    if (!opts.name) { opts.name = "Snoozed"; }
    opts.iconName= 'snooze.png';

    let categories = accountIds.map(accId => {
      return _.findWhere(CategoryStore.categories(accId), {displayName});
  });
    categories = _.compact(categories);

    const perspective = MailboxPerspective.forCategories(categories);
    if (!perspective.name) { perspective.name = id; }
    return this.forPerspective(id, perspective, opts);
  }

  static forStarred(accountIds, opts) {
    if (opts == null) { opts = {}; }
    const perspective = MailboxPerspective.forStarred(accountIds);
    let id = 'Starred';
    if (opts.name) { id += `-${opts.name}`; }
    return this.forPerspective(id, perspective, opts);
  }

  static forUnread(accountIds, opts) {
    if (opts == null) { opts = {}; }
    let categories = accountIds.map(accId => {
      return CategoryStore.getStandardCategory(accId, 'inbox');
    });

    // NOTE: It's possible for an account to not yet have an `inbox`
    // category. Since the `SidebarStore` triggers on `AccountStore`
    // changes, it'll trigger the exact moment an account is added to the
    // config. However, the API has not yet come back with the list of
    // `categories` for that account.
    categories = _.compact(categories);

    const perspective = MailboxPerspective.forUnread(categories);
    let id = 'Unread';
    if (opts.name) { id += `-${opts.name}`; }
    return this.forPerspective(id, perspective, opts);
  }

  static forDrafts(accountIds, opts) {
    if (opts == null) { opts = {}; }
    const perspective = MailboxPerspective.forDrafts(accountIds);
    const id = `Drafts-${opts.name}`;
    return this.forPerspective(id, perspective, opts);
  }
}

module.exports = SidebarItem;
