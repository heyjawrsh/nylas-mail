/*
 * decaffeinate suggestions:
 * DS002: Fix invalid constructor
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
const _ = require('underscore');
const React = require('react');
const ReactDOM = require('react-dom');
const classNames = require('classnames');
const RetinaImg = require('./retina-img').default;
const EventedIFrame = require('./evented-iframe');
const {FolderSyncProgressStore,
 FocusedPerspectiveStore} = require('nylas-exports');
const {SyncingListState} = require('nylas-component-kit');


const INBOX_ZERO_ANIMATIONS = [
  'gem',
  'oasis',
  'tron',
  'airstrip',
  'galaxy',
];

class EmptyPerspectiveState extends React.Component {
  static initClass() {
    this.displayName = "EmptyPerspectiveState";
  
    this.propTypes = {
      perspective: PropTypes.object,
      messageContent: PropTypes.node,
    };
  }

  render() {
    const {messageContent, perspective} = this.props;
    let name = perspective.categoriesSharedName();
    if (perspective.isArchive()) { name = 'archive'; }
    if (!name) { ({
      name
    } = perspective); }
    if (name) { name = name.toLowerCase(); }

    return React.createElement("div", {"className": "perspective-empty-state"},
      (name ?
        React.createElement(RetinaImg, { 
          "name": (`ic-emptystate-${name}.png`),  
          "mode": (RetinaImg.Mode.ContentIsMask)
        }) : undefined
      ),
      React.createElement("div", {"className": "message"}, (messageContent))
    );
  }
}
EmptyPerspectiveState.initClass();

class EmptyInboxState extends React.Component {
  constructor(...args) {
    this._getScalingFactor = this._getScalingFactor.bind(this);
    this._getAnimationName = this._getAnimationName.bind(this);
    super(...args);
  }

  static initClass() {
    this.displayName = "EmptyInboxState";
  
    this.propTypes =
      {containerRect: PropTypes.object,};
  }

  _getScalingFactor() {
    const {width} = this.props.containerRect;
    if (!width) { return null; }
    if (width > 600) { return null; }
    return (width + 100) / 1000;
  }

  _getAnimationName(now) {
    if (now == null) { now = new Date(); }
    const msInADay = 8.64e7;
    const msSinceEpoch = now.getTime() - (now.getTimezoneOffset() * 1000 * 60);
    const daysSinceEpoch = Math.floor(msSinceEpoch / msInADay);
    const idx = daysSinceEpoch  % INBOX_ZERO_ANIMATIONS.length;
    return INBOX_ZERO_ANIMATIONS[idx];
  }

  render() {
    const animationName = this._getAnimationName();
    const factor = this._getScalingFactor();
    const style = factor ?
      {transform: `scale(${factor})`}
    :
      {};

    return React.createElement("div", {"className": "inbox-zero-animation"},
      React.createElement("div", {"className": "animation-wrapper", "style": (style)},
        React.createElement("iframe", {"src": (`animations/inbox-zero/${animationName}/${animationName}.html`)}),
        React.createElement("div", {"className": "message"}, "Hooray! You’re done.")
      )
    );
  }
}
EmptyInboxState.initClass();


class EmptyListState extends React.Component {
  static initClass() {
    this.displayName = 'EmptyListState';
    this.propTypes =
      {visible: PropTypes.bool.isRequired};
  }

  constructor(props) {
    this._getDimensions = this._getDimensions.bind(this);
    this._onResize = this._onResize.bind(this);
    this.props = props;
    this._mounted = false;
    this.state = Object.assign({
      active: false,
      rect: {}
    },
      this._getStateFromStores());
  }

  componentDidMount() {
    this._mounted = true;
    this._unlisteners = [];
    this._unlisteners.push(FolderSyncProgressStore.listen((() => this.setState(this._getStateFromStores())), this));
    this._unlisteners.push(FocusedPerspectiveStore.listen((() => this.setState(this._getStateFromStores())), this));
    window.addEventListener('resize', this._onResize);
    if (this.props.visible && !this.state.active) {
      const rect = this._getDimensions();
      return this.setState({active:true, rect});
    }
  }

  shouldComponentUpdate(nextProps, nextState) {
    if (nextProps.visible !== this.props.visible) { return true; }
    return !_.isEqual(nextState, this.state);
  }

  componentWillUnmount() {
    this._mounted = false;
    for (var unlisten of Array.from(this._unlisteners)) { unlisten(); }
    return window.removeEventListener('resize', this._onResize);
  }

  componentDidUpdate() {
    if (this.props.visible && !this.state.active) {
      const rect = this._getDimensions();
      return this.setState({active:true, rect});
    }
  }

  UNSAFE_componentWillReceiveProps(newProps) {
    if (newProps.visible === false) {
      return this.setState({active:false});
    }
  }

  render() {
    if (!this.props.visible) { return React.createElement("span", null); }
    let ContentComponent = EmptyPerspectiveState;
    const current = FocusedPerspectiveStore.current();

    let messageContent = current.emptyMessage();
    if (this.state.syncing) {
      messageContent = React.createElement(SyncingListState, {"empty": true});
    } else if (current.isInbox()) {
      ContentComponent = EmptyInboxState;
    }

    const classes = classNames({
      'empty-state': true,
      'active': this.state.active
    });

    return React.createElement("div", {"className": (classes)},
      React.createElement(ContentComponent, { 
        "perspective": (current),  
        "containerRect": (this.state.rect),  
        "messageContent": (messageContent)
      })
    );
  }

  _getDimensions() {
    if (!this._mounted) { return null; }
    const node = ReactDOM.findDOMNode(this);
    const rect = node.getBoundingClientRect();
    return {width: rect.width, height: rect.height};
  }

  _onResize() {
    const rect = this._getDimensions();
    if (rect) {
      return this.setState({rect});
    }
  }

  _getStateFromStores() {
    return {syncing: FocusedPerspectiveStore.current().hasSyncingCategories()};
  }
}
EmptyListState.initClass();

module.exports = EmptyListState;
