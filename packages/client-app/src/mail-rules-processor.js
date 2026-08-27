/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
const _ = require('underscore');

const Task = require('./flux/tasks/task').default;
const Actions = require('./flux/actions').default;
const Category = require('./flux/models/category').default;
const Thread = require('./flux/models/thread').default;
const Message = require('./flux/models/message').default;
const AccountStore = require('./flux/stores/account-store').default;
const DatabaseStore = require('./flux/stores/database-store').default;
const TaskQueueStatusStore = require('./flux/stores/task-queue-status-store');

const {ConditionMode, ConditionTemplates} = require('./mail-rules-templates');

const ChangeUnreadTask = require('./flux/tasks/change-unread-task').default;
const ChangeFolderTask = require('./flux/tasks/change-folder-task').default;
const ChangeStarredTask = require('./flux/tasks/change-starred-task').default;
const ChangeLabelsTask = require('./flux/tasks/change-labels-task').default;
let MailRulesStore = null;

/*
Note: At first glance, it seems like these task factory methods should use the
TaskFactory. Unfortunately, the TaskFactory uses the CategoryStore and other
information about the current view. Maybe after the unified inbox refactor...
*/
var MailRulesActions = {
  markAsImportant(message, thread) {
    return DatabaseStore.findBy(Category, {
      name: 'important',
      accountId: thread.accountId
    }).then(function(important) {
      if (!important) { return Promise.reject(new Error("Could not find `important` label")); }
      return new ChangeLabelsTask({labelsToAdd: [important], threads: [thread.id], source: "Mail Rules"});
    });
  },

  moveToTrash(message, thread) {
    if (AccountStore.accountForId(thread.accountId).usesLabels()) {
      return MailRulesActions.moveToLabel(message, thread, 'trash');
    } else {
      return DatabaseStore.findBy(Category, { name: 'trash', accountId: thread.accountId }).then(function(folder) {
        if (!folder) { return Promise.reject(new Error("The folder could not be found.")); }
        return new ChangeFolderTask({folder, threads: [thread.id], source: "Mail Rules"});
      });
    }
  },

  markAsRead(message, thread) {
    return new ChangeUnreadTask({unread: false, threads: [thread.id], source: "Mail Rules"});
  },

  star(message, thread) {
    return new ChangeStarredTask({starred: true, threads: [thread.id], source: "Mail Rules"});
  },

  changeFolder(message, thread, value) {
    if (!value) { return Promise.reject(new Error("A folder is required.")); }
    return DatabaseStore.findBy(Category, { id: value, accountId: thread.accountId }).then(function(folder) {
      if (!folder) { return Promise.reject(new Error("The folder could not be found.")); }
      return new ChangeFolderTask({folder, threads: [thread.id], source: "Mail Rules"});
    });
  },

  applyLabel(message, thread, value) {
    if (!value) { return Promise.reject(new Error("A label is required.")); }
    return DatabaseStore.findBy(Category, { id: value, accountId: thread.accountId }).then(function(label) {
      if (!label) { return Promise.reject(new Error("The label could not be found.")); }
      return new ChangeLabelsTask({labelsToAdd: [label], threads: [thread.id], source: "Mail Rules"});
    });
  },

  // Should really be moveToArchive but stuck with legacy name
  applyLabelArchive(message, thread) {
    return MailRulesActions.moveToLabel(message, thread, 'all');
  },

  moveToLabel(message, thread, nameOrId) {
    if (!nameOrId) { return Promise.reject(new Error("A label is required.")); }

    return Promise.props({
      withId: DatabaseStore.findBy(Category, { id: nameOrId, accountId: thread.accountId }),
      withName: DatabaseStore.findBy(Category, { name: nameOrId, accountId: thread.accountId })
    }).then(function({withId, withName}) {
      const label = withId || withName;
      if (!label) { return Promise.reject(new Error("The label could not be found.")); }
      return new ChangeLabelsTask({
        source: "Mail Rules",
        labelsToRemove: [].concat(thread.labels).filter(l => {
          return !l.isLockedCategory() && (l.id !== label.id);
        }),
        labelsToAdd: [label],
        threads: [thread.id]
      });
    });
  }
};


class MailRulesProcessor {
  constructor() {
    this.processMessages = this.processMessages.bind(this);
    this._checkRuleForMessage = this._checkRuleForMessage.bind(this);
    this._applyRuleToMessage = this._applyRuleToMessage.bind(this);
  }

  processMessages(messages) {
    if (MailRulesStore == null) { MailRulesStore = require('./flux/stores/mail-rules-store'); }
    if (!(messages.length > 0)) { return Promise.resolve(); }

    const enabledRules = MailRulesStore.rules().filter(r => !r.disabled);

    // When messages arrive, we process all the messages in parallel, but one
    // rule at a time. This is important, because users can order rules which
    // may do and undo a change. Ie: "Star if from Ben, Unstar if subject is "Bla"
    return Promise.each(enabledRules, rule => {
      let matching = messages.filter(message => {
        return this._checkRuleForMessage(rule, message);
      });

      // Rules are declared at the message level, but actions are applied to
      // threads. To ensure we don't apply the same action 50x on the same thread,
      // just process one match per thread.
      matching = _.uniq(matching, false, message => message.threadId);

      return Promise.map(matching, message => {
        // We always pull the thread from the database, even though it may be in
        // `incoming.thread`, because rules may be modifying it as they run!
        return DatabaseStore.find(Thread, message.threadId).then(thread => {
          if (!thread) { return console.warn(`Cannot find thread ${message.threadId} to process mail rules.`); }
          return this._applyRuleToMessage(rule, message, thread);
        });
      });
    });
  }

  _checkRuleForMessage(rule, message) {
    let fn;
    if (rule.conditionMode === ConditionMode.All) {
      fn = _.every;
    } else {
      fn = _.any;
    }

    if (message.accountId !== rule.accountId) { return false; }

    return fn(rule.conditions, condition => {
      const template = _.findWhere(ConditionTemplates, {key: condition.templateKey});
      const value = template.valueForMessage(message);
      return template.evaluate(condition, value);
    });
  }

  _applyRuleToMessage(rule, message, thread) {
    const actionPromises = rule.actions.map(action => {
      const actionFunction = MailRulesActions[action.templateKey];
      if (!actionFunction) {
        return Promise.reject(new Error(`${action.templateKey} is not a supported action.`));
      }
      return actionFunction(message, thread, action.value);
    });

    return Promise.all(actionPromises).then(function(actionResults) {
      const performLocalPromises = [];

      const actionTasks = actionResults.filter(r => r instanceof Task);
      actionTasks.forEach(function(task) {
        performLocalPromises.push(TaskQueueStatusStore.waitForPerformLocal(task));
        return Actions.queueTask(task);
      });

      return Promise.all(performLocalPromises);}).catch(function(err) {
      // Errors can occur if a mail rule specifies an invalid label or folder, etc.
      // Disable the rule. Disable the mail rule so the failure is reflected in the
      // interface.
      Actions.disableMailRule(rule.id, err.toString());
      return Promise.resolve();
    });
  }
}

module.exports = new MailRulesProcessor;
