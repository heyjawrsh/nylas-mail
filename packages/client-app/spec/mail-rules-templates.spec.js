import { describe, expect, it, vi } from "vitest";

vi.mock("nylas-observables", () => ({
	default: {
		Categories: { forAccount: vi.fn() },
	},
}));

import { ConditionMode, ConditionTemplates } from "../src/mail-rules-templates.js";

const template = (key) => ConditionTemplates.find((candidate) => candidate.key === key);
const contact = (email, name) => ({ email, name });
const message = (overrides = {}) => ({
	from: [contact("alice@example.com", "Alice Adams")],
	to: [contact("bob@example.com", "Bob Brown")],
	cc: [contact("carol@example.com", "Carol Clark")],
	bcc: [contact("dave@example.com", "Dave Davis")],
	files: [{ filename: "invoice.pdf" }, { filename: "notes.txt" }],
	starred: false,
	subject: "Quarterly Planning",
	body: "Hello project team",
	...overrides,
});
const evaluate = (key, value, comparatorKey, msg = message()) =>
	template(key).evaluate({ templateKey: key, comparatorKey, value }, template(key).valueForMessage(msg));

describe("mail rule condition modes", () => {
	it("exports the any mode value", () => {
		expect(ConditionMode.Any).toBe("any");
	});

	it("exports the all mode value", () => {
		expect(ConditionMode.All).toBe("all");
	});
});

describe("mail rule condition template values", () => {
	it("returns sender emails followed by sender names", () => {
		expect(template("from").valueForMessage(message())).toEqual(["alice@example.com", "Alice Adams"]);
	});

	it("returns To emails followed by To names", () => {
		expect(template("to").valueForMessage(message())).toEqual(["bob@example.com", "Bob Brown"]);
	});

	it("returns Cc emails followed by Cc names", () => {
		expect(template("cc").valueForMessage(message())).toEqual(["carol@example.com", "Carol Clark"]);
	});

	it("returns Bcc emails followed by Bcc names", () => {
		expect(template("bcc").valueForMessage(message())).toEqual(["dave@example.com", "Dave Davis"]);
	});

	it("returns all recipient emails before all recipient names", () => {
		expect(template("anyRecipient").valueForMessage(message())).toEqual([
			"bob@example.com", "carol@example.com", "dave@example.com", "alice@example.com",
			"Bob Brown", "Carol Clark", "Dave Davis", "Alice Adams",
		]);
	});

	it("returns attachment filenames", () => {
		expect(template("anyAttachmentName").valueForMessage(message())).toEqual(["invoice.pdf", "notes.txt"]);
	});

	it("returns true as a string for a starred message", () => {
		expect(template("starred").valueForMessage(message({ starred: true }))).toBe("true");
	});

	it("returns false as a string for an unstarred message", () => {
		expect(template("starred").valueForMessage(message())).toBe("false");
	});

	it("returns the subject unchanged", () => {
		expect(template("subject").valueForMessage(message())).toBe("Quarterly Planning");
	});

	it("returns the body unchanged", () => {
		expect(template("body").valueForMessage(message())).toBe("Hello project team");
	});
});

describe("mail rule condition template evaluation", () => {
	it("finds a case-insensitive substring in any array entry", () => {
		expect(evaluate("from", "ADAMS", "contains")).toBe(true);
	});

	it("returns false when no array entry contains the value", () => {
		expect(evaluate("to", "alice", "contains")).toBe(false);
	});

	it("evaluates the beginsWith comparator case-insensitively", () => {
		// Despite often being called startsWith, the persisted comparator key is `beginsWith`.
		expect(evaluate("subject", "quarter", "beginsWith")).toBe(true);
	});

	it("evaluates the endsWith comparator case-insensitively", () => {
		expect(evaluate("body", "TEAM", "endsWith")).toBe(true);
	});

	it("evaluates equals as an exact comparison", () => {
		expect(evaluate("subject", "Quarterly Planning", "equals")).toBe(true);
	});

	it("does not case-fold equals comparisons", () => {
		expect(evaluate("subject", "quarterly planning", "equals")).toBe(false);
	});

	it("evaluates regular expressions case-insensitively", () => {
		expect(evaluate("anyAttachmentName", "^INVOICE\\.PDF$", "matchesExpression")).toBe(true);
	});

	it("evaluates doesNotContain for scalar text", () => {
		expect(evaluate("body", "confidential", "doesNotContain")).toBe(true);
	});

	it("uses exact default comparison for enum templates", () => {
		expect(evaluate("starred", "false", undefined)).toBe(true);
	});

	it("rejects a different enum value through default comparison", () => {
		expect(evaluate("starred", "true", undefined)).toBe(false);
	});
});
