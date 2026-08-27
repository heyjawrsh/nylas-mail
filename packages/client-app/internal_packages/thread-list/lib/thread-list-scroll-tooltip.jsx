/*
 * decaffeinate suggestions:
 * DS002: Fix invalid constructor
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
const React = require('react');
const {Utils, DateUtils} = require('nylas-exports');
const ThreadListStore = require('./thread-list-store');

class ThreadListScrollTooltip extends React.Component {
  constructor(...args) {
    this.componentWillMount = this.componentWillMount.bind(this);
    this.componentWillReceiveProps = this.componentWillReceiveProps.bind(this);
    this.shouldComponentUpdate = this.shouldComponentUpdate.bind(this);
    super(...args);
  }

  static initClass() {
    this.displayName = 'ThreadListScrollTooltip';
    this.propTypes = {
      viewportCenter: React.PropTypes.number.isRequired,
      totalHeight: React.PropTypes.number.isRequired
    };
  }

  componentWillMount() {
    return this.setupForProps(this.props);
  }

  componentWillReceiveProps(newProps) {
    return this.setupForProps(newProps);
  }

  shouldComponentUpdate(newProps, newState) {
    return (this.state != null ? this.state.idx : undefined) !== newState.idx;
  }

  setupForProps(props) {
    const idx = Math.floor((ThreadListStore.dataSource().count() / this.props.totalHeight) * this.props.viewportCenter);
    return this.setState({
      idx,
      item: ThreadListStore.dataSource().get(idx)
    });
  }

  render() {
    let content;
    if (this.state.item) {
      content = DateUtils.shortTimeString(this.state.item.lastMessageReceivedTimestamp);
    } else {
      content = "Loading...";
    }
    return React.createElement("div", {"className": "scroll-tooltip"},
      (content)
    );
  }
}
ThreadListScrollTooltip.initClass();

module.exports = ThreadListScrollTooltip;
