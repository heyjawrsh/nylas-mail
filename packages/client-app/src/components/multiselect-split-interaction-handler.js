/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
let MultiselectSplitInteractionHandler;
const _ = require('underscore');
const {Actions,
 WorkspaceStore} = require('nylas-exports');

module.exports =
(MultiselectSplitInteractionHandler = class MultiselectSplitInteractionHandler {
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
    this._turnFocusIntoSelection = this._turnFocusIntoSelection.bind(this);
    this._checkSelectionAndFocusConsistency = this._checkSelectionAndFocusConsistency.bind(this);
    this.props = props;
    ({onFocusItem: this.onFocusItem, onSetCursorPosition: this.onSetCursorPosition} = this.props);
  }

  cssClass() {
    return 'handler-split';
  }

  shouldShowFocus() {
    return true;
  }

  shouldShowCheckmarks() {
    return false;
  }

  shouldShowKeyboardCursor() {
    return this.props.dataSource.selection.count() > 1;
  }

  onClick(item) {
    this.onFocusItem(item);
    this.props.dataSource.selection.clear();
    return this._checkSelectionAndFocusConsistency();
  }

  onMetaClick(item) {
    this._turnFocusIntoSelection();
    this.props.dataSource.selection.toggle(item);
    return this._checkSelectionAndFocusConsistency();
  }

  onShiftClick(item) {
    this._turnFocusIntoSelection();
    this.props.dataSource.selection.expandTo(item);
    return this._checkSelectionAndFocusConsistency();
  }

  onEnter() {}
    // This concept does not exist in split mode

  onDeselect() {
    this.props.dataSource.selection.clear();
    return this._checkSelectionAndFocusConsistency();
  }

  onSelect(items) {
    this.props.dataSource.selection.set(items);
    return this._checkSelectionAndFocusConsistency();
  }

  onSelectKeyboardItem() {
    return this._checkSelectionAndFocusConsistency();
  }

  onShift(delta, options) {
    let action, id, selection;
    if (options.select) {
      this._turnFocusIntoSelection();
    }

    if (this.props.dataSource.selection.count() > 0) {
      ({
        selection
      } = this.props.dataSource);
      const keyboardId = this.props.keyboardCursorId;
      id = keyboardId != null ? keyboardId : this.props.dataSource.selection.top().id;
      action = this.onSetCursorPosition;
    } else {
      id = this.props.focusedId;
      action = this.onFocusItem;
    }

    const current = this.props.dataSource.getById(id);
    let index = this.props.dataSource.indexOfId(id);
    index = Math.max(0, Math.min(index + delta, this.props.dataSource.count() - 1));
    const next = this.props.dataSource.get(index);

    action(next);
    if (options.select) {
      this.props.dataSource.selection.walk({current, next});
    }

    return this._checkSelectionAndFocusConsistency();
  }

  _turnFocusIntoSelection() {
    const {
      focused
    } = this.props;
    this.onFocusItem(null);
    return this.props.dataSource.selection.add(focused);
  }

  _checkSelectionAndFocusConsistency() {
    const {
      focused
    } = this.props;
    const {
      selection
    } = this.props.dataSource;

    if (focused && (selection.count() > 0)) {
      this.props.dataSource.selection.add(focused);
      this.onFocusItem(null);
    }

    if ((selection.count() === 1) && !focused) {
      this.onFocusItem(selection.items()[0]);
      return this.props.dataSource.selection.clear();
    }
  }
});
