/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS104: Avoid inline assignments
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * DS209: Avoid top-level return
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
const _ = require("underscore");
const _fs = require("fs-plus");
const _path = require("node:path");

const { Listener, Publisher } = require("../modules/reflux-coffee");
const CoffeeHelpers = require("../coffee-helpers");

const Task = require("../tasks/task").default;
const TaskRegistry = require("../../registries/task-registry").default;
const _Utils = require("../models/utils");
const _Reflux = require("reflux");
const Actions = require("../actions").default;
const DatabaseStore = require("./database-store").default;

const { APIError } = require("../errors");

const JSONBlobStorageKey = "task-queue";

if (!NylasEnv.isWorkWindow() && !NylasEnv.inSpecMode()) {
	module.exports = { JSONBlobStorageKey };
} else {
	/*
Public: The TaskQueue is a Flux-compatible Store that manages a queue of {Task}
objects. Each {Task} represents an individual API action, like sending a draft
or marking a thread as "read". Tasks optimistically make changes to the app's
local cache and encapsulate logic for performing changes on the server, rolling
back in case of failure, and waiting on dependent tasks.

The TaskQueue is essential to offline mode in N1. It automatically pauses
when the user's internet connection is unavailable and resumes when online.

The task queue is persisted to disk, ensuring that tasks are executed later,
even if the user quits N1.

The TaskQueue is only available in the app's main window. Rather than directly
queuing tasks, you should use the {Actions} to interact with the {TaskQueue}.
Tasks queued from secondary windows are serialized and sent to the application's
main window via IPC.

*# Queueing a Task

```coffee
if @_thread && @_thread.unread
  Actions.queueTask(new ChangeStarredTask(thread: @_thread, starred: true))
```

*# Dequeueing a Task

```coffee
Actions.dequeueMatchingTask({
  type: 'DestroyCategoryTask',
  matching: {
    categoryId: 'bla'
  }
})
```

Section: Stores
*/
	class TaskQueue {
		static initClass() {
			TaskQueue.include = CoffeeHelpers.includeModule;

			TaskQueue.include(Publisher);
			TaskQueue.include(Listener);
		}

		constructor() {
			this.queue = this.queue.bind(this);
			this.completed = this.completed.bind(this);
			this.allTasks = this.allTasks.bind(this);
			this.enqueue = this.enqueue.bind(this);
			this.enqueueUndoOfTaskId = this.enqueueUndoOfTaskId.bind(this);
			this.dequeue = this.dequeue.bind(this);
			this.dequeueAll = this.dequeueAll.bind(this);
			this.dequeueMatching = this.dequeueMatching.bind(this);
			this.clearCompleted = this.clearCompleted.bind(this);
			this._processQueue = this._processQueue.bind(this);
			this._reportRunLocalTime = this._reportRunLocalTime.bind(this);
			this._processTask = this._processTask.bind(this);
			this._dequeueObsoleteTasks = this._dequeueObsoleteTasks.bind(this);
			this._taskIsBlocked = this._taskIsBlocked.bind(this);
			this._resolveTaskArgument = this._resolveTaskArgument.bind(this);
			this._restoreQueue = this._restoreQueue.bind(this);
			this._saveQueue = this._saveQueue.bind(this);
			this._updateSoon = this._updateSoon.bind(this);
			this._ensurePeriodicUpdates = this._ensurePeriodicUpdates.bind(this);
			this._queue = [];
			this._completed = [];
			this._updatePeriodicallyTimeout = null;
			this._currentSequentialId = Date.now();

			this._restoreQueue();

			this._savedOnUnload = false;
			NylasEnv.onBeforeUnload((finishUnload) => {
				if (this._savedOnUnload) {
					return true;
				}
				this._saveQueue().finally(() => {
					this._savedOnUnload = true;
					return finishUnload();
				});
				return false;
			});

			this.listenTo(Actions.queueTask, this.enqueue);
			this.listenTo(Actions.queueTasks, (tasks) => {
				if (!tasks || !(tasks.length > 0)) {
					return;
				}
				return Array.from(tasks).map((t) => this.enqueue(t));
			});
			this.listenTo(Actions.undoTaskId, this.enqueueUndoOfTaskId);
			this.listenTo(Actions.dequeueTask, this.dequeue);
			this.listenTo(Actions.dequeueAllTasks, this.dequeueAll);
			this.listenTo(Actions.dequeueMatchingTask, this.dequeueMatching);
			this.listenTo(Actions.clearDeveloperConsole, this.clearCompleted);
		}

		queue() {
			return this._queue;
		}

		completed() {
			return this._completed;
		}

		allTasks() {
			return [].concat(this._queue, this._completed);
		}

		/*
  Public: Returns an existing task in the queue that matches the type you provide,
  and any other match properties. Useful for checking to see if something, like
  a "SendDraft" task is in-flight.

  - `type`: The string name of the task class, or the Task class itself. (ie:
    {SaveDraftTask} or 'SaveDraftTask')

  - `matching`: Optional An {Object} with criteria to pass to _.isMatch. For a
     SaveDraftTask, this could be {draftClientId: "123123"}

  Returns a matching {Task}, or null.
  */
		findTask(type, matching) {
			if (matching == null) {
				matching = {};
			}
			return this.findTasks(type, matching)[0];
		}

		findTasks(type, matching, param) {
			if (matching == null) {
				matching = {};
			}
			if (param == null) {
				param = {};
			}
			const { includeCompleted } = param;
			if (!_.isString(type)) {
				type = type.name;
			}
			const tasks = includeCompleted
				? this._queue.concat(this._completed)
				: this._queue;
			const matches = _.filter(tasks, (task) => {
				if (task.constructor.name !== type) {
					return false;
				}
				let isMatch = false;
				if (_.isFunction(matching)) {
					isMatch = matching(task);
				} else {
					isMatch = _.isMatch(task, matching);
				}
				return isMatch;
			});
			return matches != null ? matches : [];
		}

		enqueue(task) {
			if (!(task instanceof Task)) {
				console.log(task);
				throw new Error(
					"You must queue a `Task` instance. Be sure you have the task registered with the TaskRegistry. If this is a task for a custom plugin, you must export a `taskConstructors` array with your `Task` constructors in it. You must all subclass the base Nylas `Task`.",
				);
			}
			if (!TaskRegistry.isInRegistry(task.constructor.name)) {
				console.log(task);
				throw new Error(
					"You must queue a `Task` instance which is registred with the TaskRegistry",
				);
			}
			if (!task.id) {
				console.log(task);
				throw new Error(
					"Tasks must have an ID prior to being queued. Check that your Task constructor is calling `super`",
				);
			}
			if (!task.queueState) {
				console.log(task);
				throw new Error(
					"Tasks must have a queueState prior to being queued. Check that your Task constructor is calling `super`",
				);
			}
			task.sequentialId = ++this._currentSequentialId;

			this._dequeueObsoleteTasks(task);
			const runLocalStart = Date.now();
			return task.runLocal().then(() => {
				const runLocalTime = Date.now() - runLocalStart;
				this._reportRunLocalTime(task, runLocalTime);
				this._queue.push(task);
				return this._updateSoon();
			});
		}

		enqueueUndoOfTaskId(taskId) {
			let task = _.findWhere(this._queue, { id: taskId });
			if (task == null) {
				task = _.findWhere(this._completed, { id: taskId });
			}
			if (task) {
				return this.enqueue(task.createUndoTask());
			}
		}

		dequeue(taskOrId) {
			const task = this._resolveTaskArgument(taskOrId);
			if (!task) {
				throw new Error("Couldn't find task in queue to dequeue");
			}

			if (task.queueState.isProcessing) {
				// We cannot remove a task from the queue while it's running and pretend
				// things have stopped. Ask the task to cancel. It's promise will resolve
				// or reject, and then we'll end up back here.
				return task.cancel();
			} else {
				this._queue.splice(this._queue.indexOf(task), 1);
				this._completed.push(task);
				if (this._completed.length > 1000) {
					this._completed.shift();
				}
				return this._updateSoon();
			}
		}

		dequeueTaskAndDependents(taskOrId) {
			const task = this._resolveTaskArgument(taskOrId);
			if (!task) {
				throw new Error("Couldn't find task in queue to dequeue");
			}
		}

		dequeueAll() {
			return (() => {
				const result = [];
				for (let i = this._queue.length - 1; i >= 0; i--) {
					var task = this._queue[i];
					result.push(this.dequeue(task));
				}
				return result;
			})();
		}

		dequeueMatching({ type, matching }) {
			const task = this.findTask(type, matching);

			if (!task) {
				console.warn(`Could not find matching task: ${type}`, matching);
				return;
			}

			return this.dequeue(task);
		}

		clearCompleted() {
			this._completed = [];
			return this.trigger();
		}

		// Helper Methods

		_processQueue() {
			let started = 0;

			if (this._processQueueTimeout) {
				clearTimeout(this._processQueueTimeout);
				this._processQueueTimeout = null;
			}

			const now = Date.now();
			let reprocessIn = Number.MAX_VALUE;

			for (let i = this._queue.length - 1; i >= 0; i--) {
				var task = this._queue[i];
				if (this._taskIsBlocked(task)) {
					task.queueState.debugStatus = Task.DebugStatus.WaitingOnDependency;
					continue;
				}

				if (task.queueState.retryAfter && task.queueState.retryAfter > now) {
					reprocessIn = Math.min(task.queueState.retryAfter - now, reprocessIn);
					task.queueState.debugStatus = Task.DebugStatus.WaitingToRetry;
					continue;
				}

				this._processTask(task);
				started += 1;
			}

			if (started > 0) {
				this.trigger();
			}

			if (reprocessIn !== Number.MAX_VALUE) {
				return (this._processQueueTimeout = setTimeout(
					this._processQueue,
					reprocessIn + 500,
				));
			}
		}

		_reportRunLocalTime(task, runLocalTime) {
			const taskJSON = JSON.parse(JSON.stringify(task.toJSON()));
			let taskData = _.mapObject(taskJSON, (val, key) => {
				if (key === "folder") {
					return val.display_name;
				}
				if (["labelsToAdd", "labelsToRemove"].includes(key)) {
					return val.map((l) => l.display_name);
				}
				return val;
			});
			taskData = _.omit(taskData, (_val, key) => {
				if (
					[
						"thread",
						"message",
						"draft",
						"messages",
						"threads",
						"queueState",
					].includes(key)
				) {
					return true;
				}
				return key.startsWith("_");
			});
			const eventData = Object.assign({}, taskData, {
				action: "perform-local-task",
				actionTimeMs: runLocalTime,
				taskName: task.constructor.name,
				maxValue: 1000,
				sample: 0.1,
			});
			return Actions.recordPerfMetric(eventData);
		}

		_processTask(task) {
			if (task.queueState.isProcessing) {
				return;
			}

			task.queueState.isProcessing = true;
			return task
				.runRemote()
				.finally(() => {
					task.queueState.isProcessing = false;
					return this.trigger();
				})
				.then((status) => {
					if (status === Task.Status.Retry) {
						task.queueState.retryDelay = Math.round(
							Math.min(
								(task.queueState.retryDelay != null
									? task.queueState.retryDelay
									: 1000) * 2,
								30000,
							),
						);
						task.queueState.retryAfter =
							Date.now() + task.queueState.retryDelay;
					} else {
						this.dequeue(task);
					}
					return this._updateSoon();
				})
				.catch((err) => {
					this._seenDownstream = {};
					return this._notifyOfDependentError(task, err).then((responses) => {
						this._dequeueDownstreamTasks(responses);
						return this.dequeue(task);
					});
				});
		}

		// When we `_notifyOfDependentError`s, we collect a nested array of
		// responses of the tasks we notified. We need to responses to determine
		// whether or not we should dequeue that task.
		_dequeueDownstreamTasks(responses) {
			// Responses are nested arrays due to the recursion
			if (responses == null) {
				responses = [];
			}
			responses = _.flatten(responses);

			// A response may be `null` if it hit our infinite recursion check.
			responses = _.filter(responses, (r) => r != null);

			return responses.forEach((resp) => {
				resp.downstreamTask.queueState.status = Task.Status.Continue;
				resp.downstreamTask.queueState.debugStatus =
					Task.DebugStatus.DequeuedDependency;
				return this.dequeue(resp.downstreamTask);
			});
		}

		// Recursively notifies tasks of dependent errors
		_notifyOfDependentError(failedTask, err) {
			let left;
			const downstream =
				(left = this._tasksToDequeueOnFailure(failedTask)) != null ? left : [];
			return Promise.map(downstream, (downstreamTask) => {
				if (!downstreamTask) {
					return Promise.resolve(null);
				}

				// Infinte recursion check!
				// These will get removed later
				if (this._seenDownstream[downstreamTask.id]) {
					return Promise.resolve(null);
				}
				this._seenDownstream[downstreamTask.id] = true;

				const responseHash = Promise.props({
					returnValue: downstreamTask.onDependentTaskError(failedTask, err),
					downstreamTask,
				});

				return Promise.all([
					responseHash,
					this._notifyOfDependentError(downstreamTask, err),
				]);
			});
		}

		_dequeueObsoleteTasks(task) {
			const obsolete = _.filter(this._queue, (otherTask) => {
				// Do not interrupt tasks which are currently processing
				if (otherTask.queueState.isProcessing) {
					return false;
				}
				// Do not remove ourselves from the queue
				if (otherTask === task) {
					return false;
				}
				// Dequeue tasks which our new task indicates it makes obsolete
				return task.shouldDequeueOtherTask(otherTask);
			});

			return (() => {
				const result = [];
				for (var otherTask of Array.from(obsolete)) {
					otherTask.queueState.status = Task.Status.Continue;
					otherTask.queueState.debugStatus = Task.DebugStatus.DequeuedObsolete;
					result.push(this.dequeue(otherTask));
				}
				return result;
			})();
		}

		_tasksToDequeueOnFailure(failedTask) {
			return _.filter(
				this._queue,
				(otherTask) =>
					failedTask !== otherTask &&
					otherTask.isDependentOnTask(failedTask) &&
					otherTask.shouldBeDequeuedOnDependencyFailure(),
			);
		}

		_taskIsBlocked(task) {
			return _.any(
				this._queue,
				(otherTask) => task !== otherTask && task.isDependentOnTask(otherTask),
			);
		}

		_resolveTaskArgument(taskOrId) {
			if (!taskOrId) {
				return null;
			} else if (taskOrId instanceof Task) {
				return _.find(this._queue, (task) => task === taskOrId);
			} else {
				return _.findWhere(this._queue, { id: taskOrId });
			}
		}

		_restoreQueue() {
			return DatabaseStore.findJSONBlob(JSONBlobStorageKey).then((queue) => {
				// We need to set the processing bit back to false so it gets
				// re-retried upon inflation
				if (queue == null) {
					queue = [];
				}
				for (var task of Array.from(queue)) {
					if (task.queueState == null) {
						task.queueState = {};
					}
					task.queueState.isProcessing = false;
					delete task.queueState.retryAfter;
					delete task.queueState.retryDelay;
				}

				// The Task queue is completely wrecked if an item in the queue is not a
				// task instance. This can happen if we removed or renamed the Task class,
				// or if it was not registred with the TaskRegistry properly.
				queue = queue.filter((task) => task instanceof Task);

				this._queue = queue;
				return this._updateSoon();
			});
		}

		_saveQueue() {
			return DatabaseStore.inTransaction((t) => {
				return t.persistJSONBlob(
					JSONBlobStorageKey,
					this._queue != null ? this._queue : [],
				);
			});
		}

		_updateSoon() {
			if (this._updateSoonThrottled == null) {
				this._updateSoonThrottled = _.throttle(() => {
					this._saveQueue();
					return _.defer(() => {
						this._processQueue();
						return this._ensurePeriodicUpdates();
					});
				}, 10);
			}

			return this._updateSoonThrottled();
		}

		_ensurePeriodicUpdates() {
			const anyIsProcessing = _.any(
				this._queue,
				(task) => task.queueState.isProcessing,
			);

			// The task queue triggers periodically as tasks are processed, even if no
			// major events have occurred. This allows tasks which have state, like
			// SendDraftTask.progress to be propogated through the app and inspected.
			if (anyIsProcessing && !this._updatePeriodicallyTimeout) {
				return (this._updatePeriodicallyTimeout = setInterval(() => {
					return this._updateSoon();
				}, 1000));
			} else if (!anyIsProcessing && this._updatePeriodicallyTimeout) {
				clearTimeout(this._updatePeriodicallyTimeout);
				return (this._updatePeriodicallyTimeout = null);
			}
		}
	}
	TaskQueue.initClass();

	module.exports = new TaskQueue();
	module.exports.JSONBlobStorageKey = JSONBlobStorageKey;
}
