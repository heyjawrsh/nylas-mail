/*
 * decaffeinate suggestions:
 * DS002: Fix invalid constructor
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
const React = require("react");
const _ReactDOM = require("react-dom");
const ReactCSSTransitionGroup = require("../../../../src/components/css-transition-group-compat.jsx");
const _ = require("underscore");
const classNames = require("classnames");

const SyncActivity = require("./sync-activity").default;
const SyncbackActivity = require("./syncback-activity").default;

const {
	Utils,
	Actions,
	TaskQueue,
	AccountStore,
	FolderSyncProgressStore,
	TaskQueueStatusStore,
	PerformSendActionTask,
	SendDraftTask,
} = require("nylas-exports");

const SEND_TASK_CLASSES = [PerformSendActionTask, SendDraftTask];

class ActivitySidebar extends React.Component {
	static initClass() {
		ActivitySidebar.displayName = "ActivitySidebar";

		ActivitySidebar.containerRequired = false;
		ActivitySidebar.containerStyles = {
			minWidth: 165,
			maxWidth: 400,
		};
	}

	constructor(props) {
		super();
		this.shouldComponentUpdate = this.shouldComponentUpdate.bind(this);
		this.componentDidMount = this.componentDidMount.bind(this);
		this.componentWillUnmount = this.componentWillUnmount.bind(this);
		this.render = this.render.bind(this);
		this._onDataChanged = this._onDataChanged.bind(this);
		this._getStateFromStores = this._getStateFromStores.bind(this);
		this.props = props;
		this.state = this._getStateFromStores();
	}

	shouldComponentUpdate(nextProps, nextState) {
		return (
			!Utils.isEqualReact(nextProps, this.props) ||
			!Utils.isEqualReact(nextState, this.state)
		);
	}

	componentDidMount() {
		this._unlisteners = [];
		this._unlisteners.push(TaskQueueStatusStore.listen(this._onDataChanged));
		return this._unlisteners.push(
			FolderSyncProgressStore.listen(this._onDataChanged),
		);
	}

	componentWillUnmount() {
		return Array.from(this._unlisteners).map((unlisten) => unlisten());
	}

	render() {
		const sendTasks = [];
		const nonSendTasks = [];
		this.state.tasks.forEach((task) => {
			if (SEND_TASK_CLASSES.some((taskClass) => task instanceof taskClass)) {
				return sendTasks.push(task);
			} else {
				return nonSendTasks.push(task);
			}
		});

		const names = classNames({
			"sidebar-activity": true,
			"sidebar-activity-error": typeof error !== "undefined" && error !== null,
		});

		const wrapperClass = "sidebar-activity-transition-wrapper ";

		const inside = React.createElement(
			ReactCSSTransitionGroup,
			{
				className: names,
				transitionLeaveTimeout: 625,
				transitionEnterTimeout: 125,
				transitionName: "activity-opacity",
			},
			React.createElement(SyncbackActivity, { syncbackTasks: sendTasks }),
			React.createElement(SyncActivity, {
				initialSync: !this.state.isInitialSyncComplete,
				syncbackTasks: nonSendTasks,
			}),
		);

		return React.createElement(
			ReactCSSTransitionGroup,
			{
				className: wrapperClass,
				transitionLeaveTimeout: 625,
				transitionEnterTimeout: 125,
				transitionName: "activity-opacity",
			},
			inside,
		);
	}

	_onDataChanged() {
		return this.setState(this._getStateFromStores());
	}

	_getStateFromStores() {
		return {
			tasks: TaskQueueStatusStore.queue(),
			isInitialSyncComplete: FolderSyncProgressStore.isSyncComplete(),
		};
	}
}
ActivitySidebar.initClass();

module.exports = ActivitySidebar;
