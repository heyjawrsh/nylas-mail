import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	layoutMode: vi.fn(() => "list"),
	accountForId: vi.fn(),
}));

vi.mock("../src/flux/stores/account-store.js", () => ({
	default: { listen: vi.fn(() => vi.fn()), accountForId: mocks.accountForId },
}));
vi.mock("../src/flux/stores/workspace-store.js", () => ({
	default: { listen: vi.fn(() => vi.fn()), layoutMode: mocks.layoutMode },
}));
vi.mock("../src/flux/stores/database-store.js", () => ({
	default: { listen: vi.fn(() => vi.fn()) },
}));
vi.mock("../src/flux/stores/focused-perspective-store.js", () => ({ default: {} }));
vi.mock("../src/mailbox-perspective.js", () => ({ default: class MailboxPerspective {} }));
vi.mock("../src/flux/actions.js", () => ({
	default: {
		setFocus: { listen: vi.fn(() => vi.fn()) },
		setCursorPosition: { listen: vi.fn(() => vi.fn()) },
	},
}));
vi.mock("../src/flux/models/thread.js", () => ({ default: class Thread {} }));
vi.mock("../src/flux/models/model.js", () => ({
	default: class Model {
		constructor(values = {}) { Object.assign(this, values); }
	},
}));

import focusedContentStore from "../src/flux/stores/focused-content-store.js";
import Model from "../src/flux/models/model.js";

describe("FocusedContentStore", () => {
	let store;
	const model = (values = {}) => new Model({ id: "item-1", accountId: "account-1", ...values });

	beforeEach(() => {
		vi.clearAllMocks();
		mocks.layoutMode.mockReturnValue("list");
		mocks.accountForId.mockReturnValue({ id: "account-1" });
		NylasEnv.timer = { start: vi.fn() };
		window.requestAnimationFrame = vi.fn((callback) => { callback(); return 1; });
		store = new focusedContentStore.constructor();
		store.trigger = vi.fn();
	});

	it("starts with keyboard cursor enabled in list layout", () => {
		expect(store.keyboardCursorEnabled()).toBe(true);
	});

	it("starts with keyboard cursor disabled outside list layout", () => {
		mocks.layoutMode.mockReturnValue("split");
		store = new focusedContentStore.constructor();
		expect(store.keyboardCursorEnabled()).toBe(false);
	});

	it("focuses a model in a collection", () => {
		const item = model();
		store._onFocus({ collection: "thread", item });
		expect(store.focused("thread")).toBe(item);
	});

	it("exposes the focused model ID", () => {
		store._onFocus({ collection: "thread", item: model({ id: "thread-2" }) });
		expect(store.focusedId("thread")).toBe("thread-2");
	});

	it("returns undefined when a collection is not focused", () => {
		expect(store.focusedId("thread")).toBeUndefined();
	});

	it("records click focus", () => {
		store._onFocus({ collection: "thread", item: model(), usingClick: true });
		expect(store.didFocusUsingClick("thread")).toBe(true);
	});

	it("defaults click focus to false", () => {
		expect(store.didFocusUsingClick("thread")).toBe(false);
	});

	it("moves a focused model to the keyboard cursor", () => {
		const item = model();
		store._onFocus({ collection: "thread", item });
		expect(store.keyboardCursor("thread")).toBe(item);
	});

	it("sets keyboard focus directly", () => {
		store._onFocusKeyboard({ collection: "thread", item: model({ id: "thread-3" }) });
		expect(store.keyboardCursorId("thread")).toBe("thread-3");
	});

	it("rejects a non-model primary focus", () => {
		expect(() => store._onFocus({ collection: "thread", item: { id: "x" } })).toThrow("requires a Model");
	});

	it("rejects primary focus without a collection", () => {
		expect(() => store._onFocus({ item: model() })).toThrow("requires a collection");
	});

	it("rejects a non-model keyboard focus", () => {
		expect(() => store._onFocusKeyboard({ collection: "thread", item: {} })).toThrow("requires a Model");
	});

	it("rejects keyboard focus without a collection", () => {
		expect(() => store._onFocusKeyboard({ item: model() })).toThrow("requires a collection");
	});

	it("does not trigger again for the same focused ID", () => {
		store._onFocus({ collection: "thread", item: model() });
		store.trigger.mockClear();
		store._onFocus({ collection: "thread", item: model() });
		expect(store.trigger).not.toHaveBeenCalled();
	});

	it("publishes collection-scoped focus changes", () => {
		store._onFocus({ collection: "thread", item: model() });
		const payload = store.trigger.mock.calls[0][0];
		expect(payload.impactsCollection("thread")).toBe(true);
		expect(payload.impactsCollection("message")).toBe(false);
	});

	it("removes focused models whose account disappeared", () => {
		store._focused.thread = model();
		mocks.accountForId.mockReturnValue(null);
		store._onAccountsChange();
		expect(store.focused("thread")).toBeUndefined();
	});

	it("publishes when an account removal clears focus", () => {
		store._focused.thread = model();
		mocks.accountForId.mockReturnValue(null);
		store._onAccountsChange();
		expect(store.trigger.mock.calls[0][0].impactsCollection("thread")).toBe(true);
	});

	it("keeps focused models belonging to active accounts", () => {
		const item = model();
		store._focused.thread = item;
		store._onAccountsChange();
		expect(store.focused("thread")).toBe(item);
		expect(store.trigger).not.toHaveBeenCalled();
	});

	it("refreshes a focused model after a database change", () => {
		const replacement = model({ subject: "Updated" });
		store._focused.thread = model();
		store._onDataChange({ objectClass: "Model", type: "persist", objects: [replacement] });
		expect(store.focused("thread")).toBe(replacement);
	});

	it("clears a focused model after unpersist", () => {
		store._focused.thread = model();
		store._onDataChange({ objectClass: "Model", type: "unpersist", objects: [model()] });
		expect(store.focused("thread")).toBeNull();
	});

	it("ignores database changes without an object class", () => {
		store._focused.thread = model();
		store._onDataChange({ objects: [model()] });
		expect(store.trigger).not.toHaveBeenCalled();
	});

	it("moves focus into keyboard cursors when list layout is enabled", () => {
		store._keyboardCursorEnabled = false;
		store._focused.thread = model();
		store._onWorkspaceChange();
		expect(store.keyboardCursorId("thread")).toBe("item-1");
		expect(store.focused("thread")).toBeUndefined();
	});

	it("moves keyboard cursors into focus when list layout is disabled", () => {
		store._keyboardCursor.thread = model();
		store._keyboardCursorEnabled = true;
		mocks.layoutMode.mockReturnValue("split");
		store._onWorkspaceChange();
		expect(store.focusedId("thread")).toBe("item-1");
	});
});
