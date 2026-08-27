/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
const _ = require('underscore');
const React = require('react');
const {Actions} = require('nylas-exports');
const {FluxContainer,
 FocusContainer,
 EmptyListState,
 MultiselectList} = require('nylas-component-kit');
const DraftListStore = require('./draft-list-store');
const DraftListColumns = require('./draft-list-columns');

class DraftList extends React.Component {
  constructor(...args) {
    super(...args);
    this.render = this.render.bind(this);
    this._keymapHandlers = this._keymapHandlers.bind(this);
    this._onDoubleClick = this._onDoubleClick.bind(this);
    this._onRemoveFromView = this._onRemoveFromView.bind(this);
  }

  static initClass() {
    this.displayName = 'DraftList';
    this.containerRequired = false;
  }

  render() {
    return (
      <FluxContainer
        stores={[DraftListStore]}
        getStateFromStores={ () => ({
          dataSource: DraftListStore.dataSource()
        }) }>
        <FocusContainer collection="draft">
          <MultiselectList
            className="draft-list"
            columns={DraftListColumns.Wide}
            onDoubleClick={this._onDoubleClick}
            EmptyComponent={EmptyListState}
            keymapHandlers={this._keymapHandlers()}
            itemPropsProvider={this._itemPropsProvider}
            itemHeight={39}
          />
        </FocusContainer>
      </FluxContainer>
    );
  }

  _itemPropsProvider(draft) {
    const props = {};
    if (draft.uploadTaskId) { props.className = 'sending'; }
    return props;
  }

  _keymapHandlers() {
    return {
      'core:delete-item': this._onRemoveFromView,
      'core:gmail-remove-from-view': this._onRemoveFromView,
      'core:remove-from-view': this._onRemoveFromView
    };
  }

  _onDoubleClick(draft) {
    if (!draft.uploadTaskId) {
      return Actions.composePopoutDraft(draft.clientId);
    }
  }

  // Additional Commands

  _onRemoveFromView() {
    const drafts = DraftListStore.dataSource().selection.items();
    return Array.from(drafts).map((draft) => Actions.destroyDraft(draft.clientId));
  }
}
DraftList.initClass();

module.exports = DraftList;
