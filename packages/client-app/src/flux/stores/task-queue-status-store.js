/*
 * decaffeinate suggestions:
 * DS002: Fix invalid constructor
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
const _ = require("underscore");
const Rx = require("rx-lite");
const NylasStore = require("nylas-store").default || require("nylas-store");
const DatabaseStore = require("./database-store.js").default;
const _AccountStore = require("./account-store.js").default;
const TaskQueue = require("./task-queue.js");

// Public: The TaskQueueStatusStore allows you to inspect the task queue from
// any window, even though the queue itself only runs in the work window.
//
class TaskQueueStatusStore extends NylasStore {
	constructor() {
		super();
		this.waitForPerformLocal = this.waitForPerformLocal.bind(this);
		this.waitForPerformRemote = this.waitForPerformRemote.bind(this);
		this._queue = [];
		this._waitingLocals = [];
		this._waitingRemotes = [];

		const query = DatabaseStore.findJSONBlob(TaskQueue.JSONBlobStorageKey);
		Rx.Observable.fromQuery(query).subscribe((json) => {
			this._queue = json || [];
			this._waitingLocals = this._waitingLocals.filter(({ task, resolve }) => {
				const queuedTask = _.findWhere(this._queue, { id: task.id });
				if (!queuedTask || queuedTask.queueState.localComplete) {
					resolve(task);
					return false;
				}
				return true;
			});
			this._waitingRemotes = this._waitingRemotes.filter(
				({ task, resolve }) => {
					const queuedTask = _.findWhere(this._queue, { id: task.id });
					if (!queuedTask) {
						resolve(task);
						return false;
					}
					return true;
				},
			);
			return this.trigger();
		});
	}

	queue() {
		return this._queue;
	}

	waitForPerformLocal(task) {
		return new Promise((resolve, _reject) => {
			return this._waitingLocals.push({ task, resolve });
		});
	}

	waitForPerformRemote(task) {
		return new Promise((resolve, _reject) => {
			return this._waitingRemotes.push({ task, resolve });
		});
	}

	tasksMatching(type, matching) {
		if (matching == null) {
			matching = {};
		}
		if (!_.isString(type)) {
			type = type.name;
		}
		return this._queue.filter(
			(task) => task.constructor.name === type && _.isMatch(task, matching),
		);
	}
}

module.exports = new TaskQueueStatusStore();
