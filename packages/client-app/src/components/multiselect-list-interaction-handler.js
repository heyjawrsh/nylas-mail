/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
let MultiselectListInteractionHandler;
const _ = require('underscore');
const {Actions,
 WorkspaceStore} = require('nylas-exports');

module.exports =
(MultiselectListInteractionHandler = class MultiselectListInteractionHandler {
  constructor(props) {
    this.cssClass = this.cssClass.bind(this);
    this.shouldShowFocus = this.shouldShowFocus.bind(this);
    this.shouldShowCheckmarks = this.shouldShowCheckmarks.bind(this);
    this.shouldShowKeyboardCursor = this.shouldShowKeyboardCursor.bind(this);
    this.onClick = this.onClick.bind(this);
    this.onMetaClick = this.onMetaClick.bind(this);
    this.onShiftClick = this.onShiftClick.bind(this);
    this.onEnter = this.onEnter.bind(this);
    this.onDeselect = this.onDeselect.bind(this);
    this.onSelect = this.onSelect.bind(this);
    this.onSelectKeyboardItem = this.onSelectKeyboardItem.bind(this);
    this.onShift = this.onShift.bind(this);
    this._keyboardContext = this._keyboardContext.bind(this);
    this.props = props;
    ({onFocusItem: this.onFocusItem, onSetCursorPosition: this.onSetCursorPosition} = this.props);
  }

  cssClass() {
    return 'handler-list';
  }

  shouldShowFocus() {
    return false;
  }

  shouldShowCheckmarks() {
    return true;
  }

  shouldShowKeyboardCursor() {
    return true;
  }

  onClick(item) {
    return this.onFocusItem(item);
  }

  onMetaClick(item) {
    this.props.dataSource.selection.toggle(item);
    return this.onSetCursorPosition(item);
  }

  onShiftClick(item) {
    this.props.dataSource.selection.expandTo(item);
    return this.onSetCursorPosition(item);
  }

  onEnter() {
    const {
      keyboardCursorId
    } = this.props;
    if (keyboardCursorId) {
      const item = this.props.dataSource.getById(keyboardCursorId);
      return this.onFocusItem(item);
    }
  }

  onDeselect() {
    return this.props.dataSource.selection.clear();
  }

  onSelect(items) {
    return this.props.dataSource.selection.set(items);
  }

  onSelectKeyboardItem() {
    const {id} = this._keyboardContext();
    if (!id) { return; }
    return this.props.dataSource.selection.toggle(this.props.dataSource.getById(id));
  }

  onShift(delta, options) {
    if (options == null) { options = {}; }
    const {id, action} = this._keyboardContext();

    const current = this.props.dataSource.getById(id);
    let index = this.props.dataSource.indexOfId(id);
    index = Math.max(0, Math.min(index + delta, this.props.dataSource.count() - 1));
    const next = this.props.dataSource.get(index);

    action(next);
    if (options.select) {
      return this.props.dataSource.selection.walk({current, next});
    }
  }

  _keyboardContext() {
    if (WorkspaceStore.topSheet().root) {
      return {id: this.props.keyboardCursorId, action: this.onSetCursorPosition};
    } else {
      return {id: this.props.focusedId, action: this.onFocusItem};
    }
  }
});
