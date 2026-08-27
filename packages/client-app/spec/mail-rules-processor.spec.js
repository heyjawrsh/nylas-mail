import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	find: vi.fn(),
	findBy: vi.fn(),
	queueTask: vi.fn(),
	disableMailRule: vi.fn(),
	waitForPerformLocal: vi.fn(),
	rules: vi.fn(() => []),
}));

vi.mock("../src/flux/tasks/task.js", () => ({
	default: class Task {
		constructor(options = {}) {
			Object.assign(this, options);
		}
	},
}));
vi.mock("../src/flux/actions.js", () => ({
	default: {
		queueTask: mocks.queueTask,
		disableMailRule: mocks.disableMailRule,
	},
}));
vi.mock("../src/flux/models/category.js", () => ({ default: class Category {} }));
vi.mock("../src/flux/models/thread.js", () => ({ default: class Thread {} }));
vi.mock("../src/flux/models/message.js", () => ({ default: class Message {} }));
vi.mock("../src/flux/stores/account-store.js", () => ({
	default: { accountForId: vi.fn(() => ({ usesLabels: () => false })) },
}));
vi.mock("../src/flux/stores/database-store.js", () => ({
	default: { find: mocks.find, findBy: mocks.findBy },
}));
vi.mock("../src/flux/stores/task-queue-status-store.js", () => ({
	waitForPerformLocal: mocks.waitForPerformLocal,
}));
vi.mock("../src/flux/stores/mail-rules-store.js", () => ({ rules: mocks.rules }));

vi.mock("../src/flux/tasks/change-unread-task.js", async () => {
	const { default: Task } = await import("../src/flux/tasks/task.js");
	return {
		default: class extends Task {
			constructor(options) {
				super(options);
				this.flag = "unread";
			}
		},
	};
});
vi.mock("../src/flux/tasks/change-starred-task.js", async () => {
	const { default: Task } = await import("../src/flux/tasks/task.js");
	return {
		default: class extends Task {
			constructor(options) {
				super(options);
				this.flag = "starred";
			}
		},
	};
});
vi.mock("../src/flux/tasks/change-folder-task.js", async () => {
	const { default: Task } = await import("../src/flux/tasks/task.js");
	return { default: class extends Task {} };
});
vi.mock("../src/flux/tasks/change-labels-task.js", async () => {
	const { default: Task } = await import("../src/flux/tasks/task.js");
	return { default: class extends Task {} };
});

import processor from "../src/mail-rules-processor.js";

const message = (overrides = {}) => ({
	accountId: "account-1",
	threadId: "thread-1",
	from: [{ email: "alice@example.com", name: "Alice Adams" }],
	to: [{ email: "bob@example.com", name: "Bob Brown" }],
	cc: [{ email: "carol@example.com", name: "Carol Clark" }],
	bcc: [],
	files: [],
	subject: "Quarterly Planning",
	body: "Hello team",
	...overrides,
});
const condition = (templateKey, value, comparatorKey = "contains") => ({
	templateKey,
	comparatorKey,
	value,
});
const rule = (conditions, overrides = {}) => ({
	id: "rule-1",
	accountId: "account-1",
	conditionMode: "all",
	conditions,
	actions: [],
	...overrides,
});

describe("MailRulesProcessor matching", () => {
	it("matches a sender email", () => {
		expect(processor._checkRuleForMessage(rule([condition("from", "alice@")] ), message())).toBe(true);
	});

	it("matches a sender display name case-insensitively", () => {
		expect(processor._checkRuleForMessage(rule([condition("from", "ALICE ADAMS")]), message())).toBe(true);
	});

	it("rejects a sender that is absent", () => {
		expect(processor._checkRuleForMessage(rule([condition("from", "mallory")]), message())).toBe(false);
	});

	it("matches a To address", () => {
		expect(processor._checkRuleForMessage(rule([condition("to", "bob@example.com", "equals")]), message())).toBe(true);
	});

	it("matches a To display name", () => {
		expect(processor._checkRuleForMessage(rule([condition("to", "Brown", "endsWith")]), message())).toBe(true);
	});

	it("matches any recipient across from, to, cc, and bcc", () => {
		const msg = message({ bcc: [{ email: "hidden@example.com", name: "Hidden" }] });
		expect(processor._checkRuleForMessage(rule([condition("anyRecipient", "hidden@")] ), msg)).toBe(true);
	});

	it("includes the sender in any-recipient matching", () => {
		expect(processor._checkRuleForMessage(rule([condition("anyRecipient", "Alice")]), message())).toBe(true);
	});

	it("matches subject text case-insensitively", () => {
		expect(processor._checkRuleForMessage(rule([condition("subject", "PLANNING")]), message())).toBe(true);
	});

	it("supports subject regular expressions", () => {
		expect(processor._checkRuleForMessage(rule([condition("subject", "^Quarterly\\s+Plan", "matchesExpression")]), message())).toBe(true);
	});

	it("requires every condition in all mode", () => {
		const conditions = [condition("from", "alice"), condition("subject", "missing")];
		expect(processor._checkRuleForMessage(rule(conditions), message())).toBe(false);
	});

	it("accepts one matching condition in any mode", () => {
		const conditions = [condition("from", "missing"), condition("subject", "planning")];
		expect(processor._checkRuleForMessage(rule(conditions, { conditionMode: "any" }), message())).toBe(true);
	});

	it("rejects messages belonging to another account", () => {
		expect(processor._checkRuleForMessage(rule([condition("subject", "planning")]), message({ accountId: "other" }))).toBe(false);
	});
});

describe("MailRulesProcessor actions", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.waitForPerformLocal.mockResolvedValue(undefined);
	});




	it("does not queue anything for an empty action list", async () => {
		await processor._applyRuleToMessage(rule([]), message(), { id: "thread-1" });
		expect(mocks.queueTask).not.toHaveBeenCalled();
	});


	it("disables a rule when an unset action is unsupported", async () => {
		await processor._applyRuleToMessage(rule([], { actions: [{ templateKey: "unstar" }] }), message(), { id: "thread-1" });
		expect(mocks.disableMailRule).toHaveBeenCalledWith("rule-1", expect.stringContaining("unstar is not a supported action"));
		expect(mocks.queueTask).not.toHaveBeenCalled();
	});
});
