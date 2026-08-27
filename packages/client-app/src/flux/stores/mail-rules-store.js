/*
 * decaffeinate suggestions:
 * DS002: Fix invalid constructor
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
const NylasStore = require("nylas-store");
const _ = require("underscore");
const Rx = require("rx-lite");
const AccountStore = require("./account-store").default;
const DatabaseStore = require("./database-store").default;
const TaskQueueStatusStore = require("./task-queue-status-store");
const ReprocessMailRulesTask =
	require("../tasks/reprocess-mail-rules-task").default;
const Utils = require("../models/utils");
const Actions = require("../actions").default;

const {
	ConditionMode,
	ConditionTemplates,
	ActionTemplates,
} = require("../../mail-rules-templates");

const RulesJSONBlobKey = "MailRules-V2";

class MailRulesStore extends NylasStore {
	constructor() {
		this.rules = this.rules.bind(this);
		this.rulesForAccountId = this.rulesForAccountId.bind(this);
		this.disabledRules = this.disabledRules.bind(this);
		this._onDeleteMailRule = this._onDeleteMailRule.bind(this);
		this._onReorderMailRule = this._onReorderMailRule.bind(this);
		this._onAddMailRule = this._onAddMailRule.bind(this);
		this._onUpdateMailRule = this._onUpdateMailRule.bind(this);
		this._onDisableMailRule = this._onDisableMailRule.bind(this);
		this._saveMailRules = this._saveMailRules.bind(this);
		this._rules = [];

		const query = DatabaseStore.findJSONBlob(RulesJSONBlobKey);
		this._subscription = Rx.Observable.fromQuery(query).subscribe((rules) => {
			this._rules = rules != null ? rules : [];
			return this.trigger();
		});

		this.listenTo(Actions.addMailRule, this._onAddMailRule);
		this.listenTo(Actions.deleteMailRule, this._onDeleteMailRule);
		this.listenTo(Actions.reorderMailRule, this._onReorderMailRule);
		this.listenTo(Actions.updateMailRule, this._onUpdateMailRule);
		this.listenTo(Actions.disableMailRule, this._onDisableMailRule);
	}

	rules() {
		return this._rules;
	}

	rulesForAccountId(accountId) {
		return this._rules.filter((f) => f.accountId === accountId);
	}

	disabledRules(accountId) {
		return this._rules.filter((f) => f.disabled);
	}

	_onDeleteMailRule(id) {
		this._rules = this._rules.filter((f) => f.id !== id);
		this._saveMailRules();
		return this.trigger();
	}

	_onReorderMailRule(id, newIdx) {
		const currentIdx = _.findIndex(this._rules, _.matcher({ id }));
		if (currentIdx === -1) {
			return;
		}
		const rule = this._rules[currentIdx];
		this._rules.splice(currentIdx, 1);
		this._rules.splice(newIdx, 0, rule);
		this._saveMailRules();
		return this.trigger();
	}

	_onAddMailRule(properties) {
		const defaults = {
			id: Utils.generateTempId(),
			name: "Untitled Rule",
			conditionMode: ConditionMode.All,
			conditions: [ConditionTemplates[0].createDefaultInstance()],
			actions: [ActionTemplates[0].createDefaultInstance()],
			disabled: false,
		};

		if (!properties.accountId) {
			throw new Error("AddMailRule: you must provide an account id.");
		}

		this._rules.push(_.extend(defaults, properties));
		this._saveMailRules();
		return this.trigger();
	}

	_onUpdateMailRule(id, properties) {
		const existing = _.find(this._rules, (f) => id === f.id);
		for (var key in properties) {
			var val = properties[key];
			existing[key] = val;
		}
		this._saveMailRules();
		return this.trigger();
	}

	_onDisableMailRule(id, reason) {
		const existing = _.find(this._rules, (f) => id === f.id);
		if (!existing || existing.disabled === true) {
			return;
		}

		// Disable the task
		existing.disabled = true;
		existing.disabledReason = reason;
		this._saveMailRules();

		// Cancel all bulk processing jobs
		for (var task of Array.from(
			TaskQueueStatusStore.tasksMatching(ReprocessMailRulesTask, {}),
		)) {
			Actions.dequeueTask(task.id);
		}

		return this.trigger();
	}

	_saveMailRules() {
		if (this._saveMailRulesDebounced == null) {
			this._saveMailRulesDebounced = _.debounce(() => {
				return DatabaseStore.inTransaction((t) => {
					return t.persistJSONBlob(RulesJSONBlobKey, this._rules);
				});
			}, 1000);
		}
		return this._saveMailRulesDebounced();
	}
}

module.exports = new MailRulesStore();
