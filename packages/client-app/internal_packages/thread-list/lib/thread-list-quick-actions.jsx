/*
 * decaffeinate suggestions:
 * DS002: Fix invalid constructor
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
const React = require('react');
const {Actions,
 CategoryStore,
 TaskFactory,
 AccountStore,
 FocusedPerspectiveStore} = require('nylas-exports');

class ThreadArchiveQuickAction extends React.Component {
  constructor(...args) {
    this.render = this.render.bind(this);
    this._onArchive = this._onArchive.bind(this);
    super(...args);
  }

  static initClass() {
    this.displayName = 'ThreadArchiveQuickAction';
    this.propTypes =
      {thread: PropTypes.object};
  }

  render() {
    const allowed = FocusedPerspectiveStore.current().canArchiveThreads([this.props.thread]);
    if (!allowed) { return React.createElement("span", null); }

    return React.createElement("div", { 
      "key": "archive",  
      "title": "Archive",  
      "style": ({ order: 100 }),  
      "className": "btn action action-archive",  
      "onClick": (this._onArchive)});
  }

  shouldComponentUpdate(newProps, newState) {
    return newProps.thread.id !== (this.props != null ? this.props.thread.id : undefined);
  }

  _onArchive(event) {
    // Don't trigger the thread row click
    event.stopPropagation();
    return Actions.archiveThreads({
      source: "Quick Actions: Thread List",
      threads: [this.props.thread],
    });
  }
}
ThreadArchiveQuickAction.initClass();

class ThreadTrashQuickAction extends React.Component {
  constructor(...args) {
    this.render = this.render.bind(this);
    this._onRemove = this._onRemove.bind(this);
    super(...args);
  }

  static initClass() {
    this.displayName = 'ThreadTrashQuickAction';
    this.propTypes =
      {thread: PropTypes.object};
  }

  render() {
    const allowed = FocusedPerspectiveStore.current().canMoveThreadsTo([this.props.thread], 'trash');
    if (!allowed) { return React.createElement("span", null); }

    return React.createElement("div", { 
      "key": "remove",  
      "title": "Trash",  
      "style": ({ order: 110 }),  
      "className": 'btn action action-trash',  
      "onClick": (this._onRemove)});
  }

  shouldComponentUpdate(newProps, newState) {
    return newProps.thread.id !== (this.props != null ? this.props.thread.id : undefined);
  }

  _onRemove(event) {
    Actions.trashThreads({
      source: "Quick Actions: Thread List",
      threads: [this.props.thread],
    });
    // Don't trigger the thread row click
    return event.stopPropagation();
  }
}
ThreadTrashQuickAction.initClass();

module.exports = { ThreadArchiveQuickAction, ThreadTrashQuickAction };
