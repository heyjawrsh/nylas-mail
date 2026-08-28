import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	findJSONBlob: vi.fn(() => "query"), subscribe: vi.fn(), generateTempId: vi.fn(() => "temp-id"),
	tasksMatching: vi.fn(() => []), dequeueTask: vi.fn(),
}));

vi.mock("nylas-store", () => ({ default: class NylasStore { trigger = vi.fn(); listenTo = vi.fn(); } }));
vi.mock("rx-lite", () => {
	const Observable = { fromQuery: () => ({ subscribe: mocks.subscribe }) };
	return { default: { Observable }, Observable };
});
vi.mock("../src/flux/stores/account-store.js", () => ({ default: {} }));
vi.mock("../src/flux/stores/database-store.js", () => ({ default: { findJSONBlob: mocks.findJSONBlob, inTransaction: vi.fn() } }));
vi.mock("../src/flux/stores/task-queue-status-store.js", () => ({ default: { tasksMatching: mocks.tasksMatching }, tasksMatching: mocks.tasksMatching }));
vi.mock("../src/flux/tasks/reprocess-mail-rules-task.js", () => ({ default: class ReprocessMailRulesTask {} }));
vi.mock("../src/flux/models/utils.js", () => ({ default: { generateTempId: mocks.generateTempId }, generateTempId: mocks.generateTempId }));
vi.mock("../src/flux/actions.js", () => ({ default: {
	addMailRule: {}, deleteMailRule: {}, reorderMailRule: {}, updateMailRule: {}, disableMailRule: {},
	dequeueTask: mocks.dequeueTask,
} }));
vi.mock("../src/mail-rules-templates.js", () => ({
	ConditionMode: { All: "all" },
	ConditionTemplates: [{ createDefaultInstance: () => ({ type: "condition" }) }],
	ActionTemplates: [{ createDefaultInstance: () => ({ type: "action" }) }],
}));

import mailRulesStore from "../src/flux/stores/mail-rules-store.js";

describe("MailRulesStore", () => {
	let store;

	beforeEach(() => {
		vi.clearAllMocks();
		mocks.subscribe.mockImplementation(() => ({ dispose: vi.fn() }));
		store = new mailRulesStore.constructor();
		store._saveMailRules = vi.fn();
		vi.clearAllMocks();
	});



	it("filters rules for an account", () => {
		store._rules = [{ accountId: "a" }, { accountId: "b" }];
		expect(store.rulesForAccountId("a")).toEqual([{ accountId: "a" }]);
	});

	it("reports disabled rules across accounts", () => {
		store._rules = [{ accountId: "a", disabled: true }, { accountId: "b", disabled: false }];
		// The account argument is intentionally ignored by the implementation.
		expect(store.disabledRules("b")).toEqual([{ accountId: "a", disabled: true }]);
	});



	it("deletes only the matching rule", () => {
		store._rules = [{ id: "one" }, { id: "two" }];
		store._onDeleteMailRule("one");
		expect(store.rules()).toEqual([{ id: "two" }]);
	});

	it("reorders a known rule", () => {
		store._rules = [{ id: "one" }, { id: "two" }, { id: "three" }];
		store._onReorderMailRule("three", 0);
		expect(store.rules().map((rule) => rule.id)).toEqual(["three", "one", "two"]);
	});

	it("does nothing when reordering an unknown rule", () => {
		store._rules = [{ id: "one" }];
		store._onReorderMailRule("missing", 0);
		expect(store._saveMailRules).not.toHaveBeenCalled();
	});

	it("updates the requested rule in place", () => {
		const rule = { id: "one", name: "Old" };
		store._rules = [rule];
		store._onUpdateMailRule("one", { name: "New", disabled: true });
		expect(rule).toEqual({ id: "one", name: "New", disabled: true });
	});

	it("disables a rule and cancels reprocessing tasks", () => {
		store._rules = [{ id: "one", disabled: false }];
		mocks.tasksMatching.mockReturnValue([{ id: "job-1" }, { id: "job-2" }]);
		store._onDisableMailRule("one", "invalid condition");
		expect(store.rules()[0]).toEqual(expect.objectContaining({ disabled: true, disabledReason: "invalid condition" }));
		expect(mocks.dequeueTask.mock.calls).toEqual([["job-1"], ["job-2"]]);
	});

	it("does not disable an already disabled rule twice", () => {
		store._rules = [{ id: "one", disabled: true }];
		store._onDisableMailRule("one", "again");
		expect(store._saveMailRules).not.toHaveBeenCalled();
	});
});
