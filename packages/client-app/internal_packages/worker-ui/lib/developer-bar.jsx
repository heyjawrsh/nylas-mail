/*
 * decaffeinate suggestions:
 * DS002: Fix invalid constructor
 * DS102: Remove unnecessary code created because of implicit returns
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
const _ = require("underscore");
const React = require("react");
const {
	DatabaseStore,
	AccountStore,
	TaskQueue,
	Actions,
	Contact,
	Utils,
	Message,
} = require("nylas-exports");
const { InjectedComponentSet } = require("nylas-component-kit");

const DeveloperBarStore = require("./developer-bar-store");
const DeveloperBarTask = require("./developer-bar-task");
const DeveloperBarCurlItem = require("./developer-bar-curl-item");
const DeveloperBarLongPollItem = require("./developer-bar-long-poll-item");

class DeveloperBar extends React.Component {
	static initClass() {
		DeveloperBar.displayName = "DeveloperBar";

		DeveloperBar.containerRequired = false;
	}

	constructor(props) {
		this.componentDidMount = this.componentDidMount.bind(this);
		this.componentWillUnmount = this.componentWillUnmount.bind(this);
		this.render = this.render.bind(this);
		this._renderDeltaStates = this._renderDeltaStates.bind(this);
		this._sectionContent = this._sectionContent.bind(this);
		this._onChange = this._onChange.bind(this);
		this._onClear = this._onClear.bind(this);
		this._onFilter = this._onFilter.bind(this);
		this._onDequeueAll = this._onDequeueAll.bind(this);
		this._onExpandSection = this._onExpandSection.bind(this);
		this._getStateFromStores = this._getStateFromStores.bind(this);
		this.props = props;
		this.state = _.extend(this._getStateFromStores(), {
			section: "curl",
			filter: "",
		});
	}

	componentDidMount() {
		this.taskQueueUnsubscribe = TaskQueue.listen(this._onChange);
		return (this.activityStoreUnsubscribe = DeveloperBarStore.listen(
			this._onChange,
		));
	}

	componentWillUnmount() {
		if (this.taskQueueUnsubscribe) {
			this.taskQueueUnsubscribe();
		}
		if (this.activityStoreUnsubscribe) {
			return this.activityStoreUnsubscribe();
		}
	}

	render() {
		return (
			<div className="developer-bar">
				<div className="controls">
					<div className="btn-container pull-left">
						<div className="btn" onClick={() => this._onExpandSection("queue")}>
							<span>
								Client Tasks (
								{this.state.queue != null ? this.state.queue.length : undefined}
								)
							</span>
						</div>
					</div>
					<div className="btn-container pull-left">
						<div
							className="btn"
							onClick={() => this._onExpandSection("providerSyncbackRequests")}
						>
							<span>Provider Syncback Requests</span>
						</div>
					</div>
					<div className="btn-container pull-left">
						<div
							className="btn"
							onClick={() => this._onExpandSection("long-polling")}
						>
							{this._renderDeltaStates()}
							<span>Cloud Deltas</span>
						</div>
					</div>
					<div className="btn-container pull-left">
						<div className="btn" onClick={() => this._onExpandSection("curl")}>
							<span>Requests: {this.state.curlHistory.length}</span>
						</div>
					</div>
					<div className="btn-container pull-left">
						<div
							className="btn"
							onClick={() => this._onExpandSection("local-sync")}
						>
							<span>Local Sync Engine</span>
						</div>
					</div>
				</div>
				{this._sectionContent()}
				<div className="footer">
					<div className="btn" onClick={this._onClear}>
						Clear
					</div>
					<input
						className="filter"
						placeholder="Filter..."
						value={this.state.filter}
						onChange={this._onFilter}
					/>
				</div>
			</div>
		);
	}

	_renderDeltaStates() {
		return _.map(this.state.longPollStates, (status, accountId) => {
			return (
				<div className="delta-state-wrap" key={accountId}>
					<div
						title={`Account ${accountId} - Cloud State: ${status}`}
						key={`${accountId}-n1Cloud`}
						className={`activity-status-bubble state-${status}`}
					></div>
				</div>
			);
		});
	}

	_sectionContent() {
		let itemDivs;
		let i, task;
		let expandedDiv = <div></div>;

		const matchingFilter = (item) => {
			if (this.state.filter === "") {
				return true;
			}
			return JSON.stringify(item).indexOf(this.state.filter) >= 0;
		};

		if (this.state.section === "curl") {
			itemDivs = this.state.curlHistory
				.filter(matchingFilter)
				.map((item) => <DeveloperBarCurlItem item={item} key={item.id} />);
			return (expandedDiv = (
				<div className="expanded-section curl-history">{itemDivs}</div>
			));
		} else if (this.state.section === "long-polling") {
			itemDivs = this.state.longPollHistory
				.filter(matchingFilter)
				.map((item) => (
					<DeveloperBarLongPollItem
						item={item}
						ignoredBecause={item.ignoredBecause}
						key={`${item.cursor}-${item.timestamp}`}
					/>
				));
			return (expandedDiv = (
				<div className="expanded-section long-polling">{itemDivs}</div>
			));
		} else if (this.state.section === "local-sync") {
			return (expandedDiv = (
				<div className="expanded-section local-sync">
					<InjectedComponentSet matching={{ role: "Developer:LocalSyncUI" }} />
				</div>
			));
		} else if (this.state.section === "providerSyncbackRequests") {
			const reqs = this.state.providerSyncbackRequests.map((req) => {
				return (
					<div key={req.id}>
						&nbsp;{req.type}: {req.status} - {JSON.stringify(req.props)}
					</div>
				);
			});
			return (expandedDiv = (
				<div className="expanded-section provider-syncback-requests">
					{reqs}
				</div>
			));
		} else if (this.state.section === "queue") {
			const _queue = this.state.queue.filter(matchingFilter);
			const queueDivs = (() => {
				const result = [];
				for (i = this.state.queue.length - 1; i >= 0; i--) {
					task = this.state.queue[i];
					// We need to pass the task separately because we want to update
					// when just that variable changes. Otherwise, since the `task`
					// pointer doesn't change, the `DeveloperBarTask` doesn't know to
					// update.
					var { status } = this.state.queue[i].queueState;
					result.push(
						<DeveloperBarTask
							task={task}
							key={task.id}
							status={status}
							type="queued"
						/>,
					);
				}
				return result;
			})();

			const _queueCompleted = this.state.completed.filter(matchingFilter);
			const queueCompletedDivs = (() => {
				const result1 = [];
				for (i = this.state.completed.length - 1; i >= 0; i--) {
					task = this.state.completed[i];
					result1.push(
						<DeveloperBarTask task={task} key={task.id} type="completed" />,
					);
				}
				return result1;
			})();

			expandedDiv = (
				<div className="expanded-section queue">
					<div className="btn queue-buttons" onClick={this._onDequeueAll}>
						Remove Queued Tasks
					</div>
					<div className="section-content">
						{queueDivs}
						<hr />
						{queueCompletedDivs}
					</div>
				</div>
			);

			return expandedDiv;
		}
	}

	_onChange() {
		return this.setState(this._getStateFromStores());
	}

	_onClear() {
		return Actions.clearDeveloperConsole();
	}

	_onFilter(ev) {
		return this.setState({ filter: ev.target.value });
	}

	_onDequeueAll() {
		return Actions.dequeueAllTasks();
	}

	_onExpandSection(section) {
		this.setState(this._getStateFromStores());
		return this.setState({ section });
	}

	_getStateFromStores() {
		return {
			queue: Utils.deepClone(TaskQueue._queue),
			completed: TaskQueue._completed,
			curlHistory: DeveloperBarStore.curlHistory(),
			longPollHistory: DeveloperBarStore.longPollHistory(),
			longPollStates: DeveloperBarStore.longPollStates(),
			providerSyncbackRequests: DeveloperBarStore.providerSyncbackRequests(),
		};
	}
}
DeveloperBar.initClass();

module.exports = DeveloperBar;
