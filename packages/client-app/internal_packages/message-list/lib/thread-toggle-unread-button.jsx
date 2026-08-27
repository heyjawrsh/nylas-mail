'use strict';

const {Actions, React, FocusedContentStore} = require('nylas-exports');
const {RetinaImg} = require('nylas-component-kit');

class ThreadToggleUnreadButton extends React.Component {
  static displayName = "ThreadToggleUnreadButton";
  static containerRequired = false;

  constructor() {
    super(...arguments);
    this.render = this.render.bind(this);
    this._onClick = this._onClick.bind(this);
  }

  render() {
    const fragment = (this.props.thread != null ? this.props.thread.unread : undefined) ? "read" : "unread";
    return <button className="btn btn-toolbar" style={{order: -105}} title={`Mark as ${fragment}`} onClick={this._onClick}>
      <RetinaImg name={`toolbar-markas${fragment}.png`} mode={RetinaImg.Mode.ContentIsMask} />
    </button>;
  }

  _onClick(e) {
    Actions.toggleUnreadThreads({source: "Toolbar Button: Thread List", threads: [this.props.thread]});
    Actions.popSheet();
    return e.stopPropagation();
  }
}

module.exports = ThreadToggleUnreadButton;
