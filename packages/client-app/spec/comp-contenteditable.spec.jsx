import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import BlockquoteManager from "../src/components/contenteditable/blockquote-manager.js";
import EmphasisFormattingExtension from "../src/components/contenteditable/emphasis-formatting-extension.js";
import LinkManager from "../src/components/contenteditable/link-manager.js";
import ListManager from "../src/components/contenteditable/list-manager.js";
import ParagraphFormattingExtension from "../src/components/contenteditable/paragraph-formatting-extension.js";
import TabManager from "../src/components/contenteditable/tab-manager.js";
import ToolbarButtonManager from "../src/components/contenteditable/toolbar-button-manager.js";

afterEach(cleanup);
afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
});

const eventFixture = (overrides = {}) => ({
	key: "",
	shiftKey: false,
	defaultPrevented: false,
	preventDefault: vi.fn(),
	stopPropagation: vi.fn(),
	...overrides,
});

describe("BlockquoteManager", () => {
	it("publishes the quote command", () => {
		expect(Object.keys(BlockquoteManager.keyCommandHandlers())).toEqual([
			"contenteditable:quote",
		]);
	});

	it("formats the current block as a blockquote", () => {
		const editor = { formatBlock: vi.fn() };
		BlockquoteManager.keyCommandHandlers()["contenteditable:quote"]({ editor });
		expect(editor.formatBlock).toHaveBeenCalledWith("BLOCKQUOTE");
	});

	it("ignores keys other than Backspace", () => {
		const editor = { outdent: vi.fn() };
		const event = eventFixture({ key: "Enter" });
		BlockquoteManager.onKeyDown({ editor, event });
		expect(editor.outdent).not.toHaveBeenCalled();
		expect(event.preventDefault).not.toHaveBeenCalled();
	});

	it("outdents Backspace at the start of a blockquote", () => {
		const editor = { outdent: vi.fn() };
		const event = eventFixture({ key: "Backspace" });
		vi.spyOn(BlockquoteManager, "_isInBlockquote").mockReturnValue(true);
		vi.spyOn(BlockquoteManager, "_isAtStartOfLine").mockReturnValue(true);
		BlockquoteManager.onKeyDown({ editor, event });
		expect(editor.outdent).toHaveBeenCalledOnce();
		expect(event.preventDefault).toHaveBeenCalledOnce();
	});

	it("does not outdent a non-collapsed selection", () => {
		const editor = { currentSelection: () => ({ isCollapsed: false }) };
		expect(BlockquoteManager._isInBlockquote(editor)).toBe(false);
	});
});

describe("EmphasisFormattingExtension", () => {
	it("publishes all four emphasis commands", () => {
		expect(Object.keys(EmphasisFormattingExtension.keyCommandHandlers())).toEqual([
			"contenteditable:bold",
			"contenteditable:italic",
			"contenteditable:underline",
			"contenteditable:strikeThrough",
		]);
	});

	it.each([
		["contenteditable:bold", "bold"],
		["contenteditable:italic", "italic"],
		["contenteditable:underline", "underline"],
		["contenteditable:strikeThrough", "strikeThrough"],
	])("dispatches %s to editor.%s", (command, method) => {
		const editor = { [method]: vi.fn() };
		EmphasisFormattingExtension.keyCommandHandlers()[command]({ editor });
		expect(editor[method]).toHaveBeenCalledOnce();
	});

	it("describes the three visible toolbar buttons", () => {
		expect(
			EmphasisFormattingExtension.toolbarButtons().map(
				({ className, tooltip, iconUrl }) => ({ className, tooltip, iconUrl }),
			),
		).toEqual([
			{ className: "btn-bold", tooltip: "Bold", iconUrl: null },
			{ className: "btn-italic", tooltip: "Italic", iconUrl: null },
			{ className: "btn-underline", tooltip: "Underline", iconUrl: null },
		]);
	});

	it("uses the default toolbar component", () => {
		expect(EmphasisFormattingExtension.toolbarComponentConfig()).toBeNull();
	});
});

describe("LinkManager", () => {
	it("publishes insert-link command metadata", () => {
		expect(Object.keys(LinkManager.keyCommandHandlers())).toEqual([
			"contenteditable:insert-link",
		]);
		expect(LinkManager.toolbarButtons()[0]).toMatchObject({
			className: "btn-link",
			tooltip: "Edit Link",
			iconUrl: null,
		});
	});

	it("inserts selected prompt text for a collapsed selection", () => {
		vi.useFakeTimers();
		const editor = {
			currentSelection: () => ({ isCollapsed: true }),
			insertHTML: vi.fn(),
		};
		LinkManager._onInsertLink({ editor });
		vi.runAllTimers();
		expect(editor.insertHTML).toHaveBeenCalledWith(
			"<n1-prompt-link>link text</n1-prompt-link>",
			{ selectInsertion: true },
		);
	});

	it("wraps a non-collapsed selection", () => {
		vi.useFakeTimers();
		const editor = {
			currentSelection: () => ({ isCollapsed: false }),
			wrapSelection: vi.fn(),
		};
		LinkManager._onInsertLink({ editor });
		vi.runAllTimers();
		expect(editor.wrapSelection).toHaveBeenCalledWith("n1-prompt-link");
	});

	it("computes a minimum width for short links", () => {
		const link = { getAttribute: () => "https://x.co" };
		expect(LinkManager._linkWidth(link)).toBe(210);
	});

	it("expands the editor for long links", () => {
		const href = "https://example.com/a/very/long/link";
		const link = { getAttribute: () => href };
		expect(LinkManager._linkWidth(link)).toBe(href.length * 8 + 95);
	});

	it("does not show link UI while dragging", () => {
		expect(
			LinkManager.toolbarComponentConfig({ toolbarState: { dragging: true } }),
		).toBeNull();
	});

	it("focuses the link UI for a range selection", () => {
		expect(
			LinkManager._shouldFocusOnMount({
				selectionSnapshot: { isCollapsed: false },
			}),
		).toBe(true);
	});
});

describe("ListManager", () => {
	beforeEach(() => {
		ListManager.originalInput = null;
		ListManager._spaceEntered = false;
	});

	it("publishes numbered and bulleted list commands", () => {
		expect(Object.keys(ListManager.keyCommandHandlers())).toEqual([
			"contenteditable:numbered-list",
			"contenteditable:bulleted-list",
		]);
	});

	it("dispatches the numbered-list command", () => {
		const editor = { insertOrderedList: vi.fn(() => "ordered") };
		expect(ListManager._insertNumberedList({ editor })).toBe("ordered");
		expect(editor.insertOrderedList).toHaveBeenCalledOnce();
	});

	it("dispatches the bulleted-list command", () => {
		const editor = { insertUnorderedList: vi.fn(() => "bulleted") };
		expect(ListManager._insertBulletedList({ editor })).toBe("bulleted");
		expect(editor.insertUnorderedList).toHaveBeenCalledOnce();
	});

	it.each(["- ", "* "])('recognizes the bullet signature "%s"', (text) => {
		expect(ListManager.bulletRegex().test(text)).toBe(true);
	});

	it("recognizes a single-digit numbered signature", () => {
		expect(ListManager.numberRegex().test("1. ")).toBe(true);
		expect(ListManager.numberRegex().test("12. ")).toBe(false);
	});

	it("rejects list signatures without an anchor node", () => {
		expect(ListManager.hasListStartSignature({ isCollapsed: true })).toBe(false);
	});

	it("rejects list signatures for range selections", () => {
		expect(
			ListManager.hasListStartSignature({
				anchorNode: document.createTextNode("- "),
				isCollapsed: false,
			}),
		).toBe(false);
	});

	it("inserts the requested list type outside a list item", () => {
		const editor = {
			currentSelection: () => ({ anchorNode: document.createTextNode("text") }),
			insertOrderedList: vi.fn(),
			insertUnorderedList: vi.fn(),
		};
		vi.spyOn(ListManager, "isInsideListItem").mockReturnValue(false);
		ListManager.insertList(editor, { ordered: true });
		expect(editor.insertOrderedList).toHaveBeenCalledOnce();
		expect(editor.insertUnorderedList).not.toHaveBeenCalled();
	});

	it("indents when list insertion occurs inside a list item", () => {
		const editor = {
			currentSelection: () => ({ anchorNode: document.createTextNode("text") }),
			indent: vi.fn(),
		};
		vi.spyOn(ListManager, "isInsideListItem").mockReturnValue(true);
		ListManager.insertList(editor, { ordered: false });
		expect(editor.indent).toHaveBeenCalledOnce();
	});
});

describe("ParagraphFormattingExtension", () => {
	it("publishes indent and outdent commands", () => {
		expect(Object.keys(ParagraphFormattingExtension.keyCommandHandlers())).toEqual([
			"contenteditable:indent",
			"contenteditable:outdent",
		]);
	});

	it.each([
		["contenteditable:indent", "indent"],
		["contenteditable:outdent", "outdent"],
	])("dispatches %s to editor.%s", (command, method) => {
		const editor = { [method]: vi.fn() };
		ParagraphFormattingExtension.keyCommandHandlers()[command]({ editor });
		expect(editor[method]).toHaveBeenCalledOnce();
	});

	it("has no paragraph toolbar buttons or custom component", () => {
		expect(ParagraphFormattingExtension.toolbarButtons()).toEqual([]);
		expect(ParagraphFormattingExtension.toolbarComponentConfig()).toBeNull();
	});
});

describe("TabManager", () => {
	it("stops propagation for an already prevented event", () => {
		const event = eventFixture({ defaultPrevented: true });
		TabManager.onKeyDown({ editor: {}, event });
		expect(event.stopPropagation).toHaveBeenCalledOnce();
	});

	it("ignores non-Tab keys", () => {
		const event = eventFixture({ key: "Enter" });
		TabManager.onKeyDown({ editor: {}, event });
		expect(event.preventDefault).not.toHaveBeenCalled();
		expect(event.stopPropagation).not.toHaveBeenCalled();
	});

	it("inserts a tab into a collapsed selection", () => {
		const editor = {
			currentSelection: () => ({ isCollapsed: true }),
			insertText: vi.fn(),
		};
		const event = eventFixture({ key: "Tab" });
		TabManager.onKeyDown({ editor, event });
		expect(editor.insertText).toHaveBeenCalledWith("\t");
		expect(event.preventDefault).toHaveBeenCalledOnce();
		expect(event.stopPropagation).toHaveBeenCalledOnce();
	});

	it("replaces a range selection with a tab", () => {
		const editor = {
			currentSelection: () => ({ isCollapsed: false }),
			insertText: vi.fn(),
		};
		TabManager.onKeyDown({ editor, event: eventFixture({ key: "Tab" }) });
		expect(editor.insertText).toHaveBeenCalledWith("\t");
	});

	it("deletes a range selection on Shift-Tab", () => {
		const editor = {
			currentSelection: () => ({ isCollapsed: false }),
			insertText: vi.fn(),
		};
		TabManager.onKeyDown({
			editor,
			event: eventFixture({ key: "Tab", shiftKey: true }),
		});
		expect(editor.insertText).toHaveBeenCalledWith("");
	});
});

describe("ToolbarButtonManager", () => {
	it("publishes an empty base toolbar", () => {
		expect(ToolbarButtonManager.toolbarButtons()).toEqual([]);
	});

	it.each([
		{ dragging: true, selectionSnapshot: { isCollapsed: false } },
		{ doubleDown: true, selectionSnapshot: { isCollapsed: false } },
		{ selectionSnapshot: null },
		{ selectionSnapshot: { isCollapsed: true } },
	])("hides the toolbar for unavailable state %#", (toolbarState) => {
		expect(
			ToolbarButtonManager.toolbarComponentConfig({ toolbarState }),
		).toBeNull();
	});

	it("collects extension buttons and wraps clicks in atomicEdit", () => {
		const innerClick = vi.fn();
		const atomicEdit = vi.fn();
		const toolbarState = {
			atomicEdit,
			extensions: [
				{ toolbarButtons: () => [{ tooltip: "Bold", onClick: innerClick }] },
				{ toolbarButtons: () => [{ tooltip: "Spacer" }] },
			],
		};
		const configs = ToolbarButtonManager._toolbarButtonConfigs(toolbarState);
		expect(configs.map(({ tooltip }) => tooltip)).toEqual(["Bold", "Spacer"]);
		const event = eventFixture();
		configs[0].onClick(event);
		expect(atomicEdit).toHaveBeenCalledWith(innerClick, { event });
	});
});
