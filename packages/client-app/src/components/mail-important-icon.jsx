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
const classNames = require('classnames');
const {Actions,
 Utils,
 Thread,
 TaskFactory,
 CategoryStore,
 FocusedPerspectiveStore,
 AccountStore} = require('nylas-exports');

const ShowImportantKey = 'core.workspace.showImportant';

class MailImportantIcon extends React.Component {
  static initClass() {
    this.displayName = 'MailImportantIcon';
    this.propTypes = {
      thread: PropTypes.object,
      showIfAvailableForAnyAccount: PropTypes.bool
    };
  }

  constructor(props) {
    this.getState = this.getState.bind(this);
    this.componentDidMount = this.componentDidMount.bind(this);
    this.UNSAFE_componentWillReceiveProps = this.UNSAFE_componentWillReceiveProps.bind(this);
    this.componentWillUnmount = this.componentWillUnmount.bind(this);
    this.shouldComponentUpdate = this.shouldComponentUpdate.bind(this);
    this.render = this.render.bind(this);
    this._onToggleImportant = this._onToggleImportant.bind(this);
    this.props = props;
    this.state = this.getState();
  }

  getState(props) {
    let accountId;
    if (props == null) { ({
      props
    } = this); }
    let category = null;
    let visible = false;

    if (props.showIfAvailableForAnyAccount) {
      const perspective = FocusedPerspectiveStore.current();
      for (accountId of Array.from(perspective.accountIds)) {
        var account = AccountStore.accountForId(accountId);
        var accountImportant = CategoryStore.getStandardCategory(account, 'important');
        if (accountImportant) {
          visible = true;
        }
        if (accountId === props.thread.accountId) {
          category = accountImportant;
        }
        if (visible && category) { break; }
      }
    } else {
      category = CategoryStore.getStandardCategory(props.thread.accountId, 'important');
      visible = (category != null);
    }

    const isImportant = category && (_.findWhere(props.thread.categories, {id: category.id}) != null);

    return {visible, category, isImportant};
  }

  componentDidMount() {
    this.unsubscribe = FocusedPerspectiveStore.listen(() => {
      return this.setState(this.getState());
    });
    return this.subscription = NylasEnv.config.onDidChange(ShowImportantKey, () => {
      return this.setState(this.getState());
    });
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    return this.setState(this.getState(nextProps));
  }

  componentWillUnmount() {
    if (typeof this.unsubscribe === 'function') {
      this.unsubscribe();
    }
    return (this.subscription != null ? this.subscription.dispose() : undefined);
  }

  shouldComponentUpdate(nextProps, nextState) {
    return !_.isEqual(nextState, this.state);
  }

  render() {
    let title;
    if (!this.state.visible) { return false; }

    const classes = classNames({
      'mail-important-icon': true,
      'enabled': (this.state.category != null),
      'active': this.state.isImportant
    });

    if (!this.state.category) {
      title = "No important folder / label";
    } else if (this.state.isImportant) {
      title = "Mark as unimportant";
    } else {
      title = "Mark as important";
    }

    return React.createElement("div", {"className": (classes),  
         "title": (title),  
         "onClick": (this._onToggleImportant)});
  }

  _onToggleImportant(event) {
    const {category} = this.state;

    if (category) {
      const isImportant = (_.findWhere(this.props.thread.categories, {id: category.id}) != null);
      const threads = [this.props.thread];

      const source = "Important Icon";

      if (!isImportant) {
        Actions.applyCategoryToThreads({threads, categoryToApply: category, source});
      } else {
        Actions.removeCategoryFromThreads({threads, categoryToRemove: category, source});
      }
    }

    // Don't trigger the thread row click
    return event.stopPropagation();
  }
}
MailImportantIcon.initClass();

module.exports = MailImportantIcon;
