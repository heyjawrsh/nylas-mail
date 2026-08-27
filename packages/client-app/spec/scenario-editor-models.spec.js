import { describe, expect, it, vi } from "vitest";

vi.mock("underscore", () => ({
	default: {
		isEqual: (actual, desired) => JSON.stringify(actual) === JSON.stringify(desired),
	},
}));

import {
	Comparator,
	Comparators,
	Template,
} from "../src/components/scenario-editor-models.js";

describe("scenario editor comparators", () => {
	it("calls a comparator with actual and desired values", () => {
		const fn = vi.fn(() => true);
		const comparator = new Comparator("custom", fn);
		expect(comparator.evaluate({ actual: "one", desired: "two" })).toBe(true);
		expect(fn).toHaveBeenCalledWith({ actual: "one", desired: "two" });
	});

	it("matches when any actual array item matches", () => {
		const comparator = new Comparator("is two", ({ actual }) => actual === 2);
		expect(comparator.evaluate({ actual: [1, 2, 3] })).toBe(true);
	});

	it("rejects an actual array when no item matches", () => {
		const comparator = new Comparator("is four", ({ actual }) => actual === 4);
		expect(comparator.evaluate({ actual: [1, 2, 3] })).toBe(false);
	});

	it("default comparator deeply compares values", () => {
		expect(Comparator.Default.evaluate({ actual: { id: 1 }, desired: { id: 1 } })).toBe(true);
		expect(Comparator.Default.evaluate({ actual: { id: 1 }, desired: { id: 2 } })).toBe(false);
	});

	it("contains ignores case", () => {
		expect(Comparators.String.contains.evaluate({ actual: "Quarterly REPORT", desired: "report" })).toBe(true);
	});

	it("contains rejects empty operands", () => {
		expect(Comparators.String.contains.evaluate({ actual: "report", desired: "" })).toBe(false);
		expect(Comparators.String.contains.evaluate({ actual: null, desired: "report" })).toBe(false);
	});

	it("does-not-contain ignores case", () => {
		expect(Comparators.String.doesNotContain.evaluate({ actual: "Quarterly report", desired: "memo" })).toBe(true);
		expect(Comparators.String.doesNotContain.evaluate({ actual: "Quarterly report", desired: "REPORT" })).toBe(false);
	});

	it("does-not-contain rejects empty operands", () => {
		// Actual behavior treats a missing desired value as no valid comparison,
		// rather than considering every string to not contain it.
		expect(Comparators.String.doesNotContain.evaluate({ actual: "report", desired: "" })).toBe(false);
	});

	it("begins-with ignores case", () => {
		expect(Comparators.String.beginsWith.evaluate({ actual: "Quarterly report", desired: "QUARTER" })).toBe(true);
	});

	it("begins-with rejects empty operands", () => {
		expect(Comparators.String.beginsWith.evaluate({ actual: "report", desired: null })).toBe(false);
	});

	it("ends-with ignores case", () => {
		expect(Comparators.String.endsWith.evaluate({ actual: "Quarterly REPORT", desired: "report" })).toBe(true);
	});

	it("ends-with rejects empty operands", () => {
		expect(Comparators.String.endsWith.evaluate({ actual: undefined, desired: "report" })).toBe(false);
	});

	it("equals uses strict equality", () => {
		expect(Comparators.String.equals.evaluate({ actual: "1", desired: 1 })).toBe(false);
		expect(Comparators.String.equals.evaluate({ actual: "same", desired: "same" })).toBe(true);
	});

	it("matches a case-insensitive regular expression", () => {
		expect(Comparators.String.matchesExpression.evaluate({ actual: "Invoice 42", desired: "invoice \\d+" })).toBe(true);
	});

	it("regex matching rejects empty operands", () => {
		expect(Comparators.String.matchesExpression.evaluate({ actual: "Invoice", desired: "" })).toBe(false);
	});
});

describe("scenario editor templates", () => {
	it("exposes its key, type, and default name", () => {
		const template = new Template("subject", Template.Type.String);
		expect(template.key).toBe("subject");
		expect(template.type).toBe("String");
		expect(template.name).toBe("subject");
	});

	it("accepts display options", () => {
		const template = new Template("subject", Template.Type.String, {
			name: "Message subject",
			valueLabel: "includes",
		});
		expect(template.name).toBe("Message subject");
		expect(template.valueLabel).toBe("includes");
	});

	it("rejects a missing key", () => {
		expect(() => new Template("", Template.Type.String)).toThrow("valid key");
	});

	it("rejects an unknown type", () => {
		expect(() => new Template("subject", "Number")).toThrow("valid type");
	});

	it("requires values for enum templates", () => {
		expect(() => new Template("state", Template.Type.Enum)).toThrow("`values`");
	});

	it("allows enum templates with values", () => {
		const values = [{ name: "Open", value: "open" }];
		expect(new Template("state", Template.Type.Enum, { values }).values).toBe(values);
	});

	it("creates a default instance from the first comparator", () => {
		const template = new Template("subject", Template.Type.String);
		expect(template.createDefaultInstance()).toEqual({
			templateKey: "subject",
			comparatorKey: "contains",
			value: undefined,
		});
	});

	it("creates a comparator-free instance for the none type", () => {
		const template = new Template("always", Template.Type.None);
		expect(template.createDefaultInstance().comparatorKey).toBeUndefined();
	});

	it("coerces an instance to the template key", () => {
		const template = new Template("subject", Template.Type.String);
		const instance = { templateKey: "sender", comparatorKey: "contains" };
		expect(template.coerceInstance(instance).templateKey).toBe("subject");
	});

	it("preserves a supported comparator during coercion", () => {
		const template = new Template("subject", Template.Type.String);
		const instance = { comparatorKey: "endsWith" };
		expect(template.coerceInstance(instance).comparatorKey).toBe("endsWith");
	});

	it("replaces an unsupported comparator during coercion", () => {
		const template = new Template("subject", Template.Type.String);
		const instance = { comparatorKey: "unknown" };
		expect(template.coerceInstance(instance).comparatorKey).toBe("contains");
	});

	it("removes a comparator during none-type coercion", () => {
		const template = new Template("always", Template.Type.None);
		const instance = { comparatorKey: "contains" };
		expect(template.coerceInstance(instance).comparatorKey).toBeUndefined();
	});

	it("evaluates with the selected comparator", () => {
		const template = new Template("subject", Template.Type.String);
		expect(template.evaluate({ comparatorKey: "endsWith", value: "report" }, "Annual Report")).toBe(true);
	});

	it("falls back to deep equality for an unknown comparator", () => {
		const template = new Template("state", Template.Type.Enum, {
			values: [{ name: "Open", value: "open" }],
		});
		expect(template.evaluate({ comparatorKey: "missing", value: "open" }, "open")).toBe(true);
	});

	it("applies a selected comparator to every array item", () => {
		const template = new Template("recipients", Template.Type.String);
		expect(template.evaluate({ comparatorKey: "contains", value: "ada" }, ["Bob", "Ada Lovelace"])).toBe(true);
	});
});
