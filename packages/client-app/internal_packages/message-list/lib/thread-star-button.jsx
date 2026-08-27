'use strict';

const _ = require('underscore');
const React = require('react');
const {Actions, Utils} = require('nylas-exports');
const {RetinaImg} = require('nylas-component-kit');

class StarButton extends React.Component {
  static displayName = "StarButton";
  static containerRequired = false;
  static propTypes = {thread: React.PropTypes.object};

  constructor() {
    super(...arguments);
    this.render = this.render.bind(this);
    this._onStarToggle = this._onStarToggle.bind(this);
  }

  render() {
    const selected = (this.props.thread != null) && this.props.thread.starred;
    return <button className="btn btn-toolbar" style={{order: -104}} title={selected ? "Remove star" : "Add star"} onClick={this._onStarToggle}>
      <RetinaImg name="toolbar-star.png" mode={RetinaImg.Mode.ContentIsMask} selected={selected} />
    </button>;
  }

  _onStarToggle(e) {
    Actions.toggleStarredThreads({source: "Toolbar Button: Message List", threads: [this.props.thread]});
    return e.stopPropagation();
  }
}

module.exports = StarButton;
