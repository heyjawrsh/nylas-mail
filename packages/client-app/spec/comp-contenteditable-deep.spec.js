import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DOMUtils } from "nylas-exports";

import EmphasisFormattingExtension from "../src/components/contenteditable/emphasis-formatting-extension.js";
import LinkManager from "../src/components/contenteditable/link-manager.js";
import ListManager from "../src/components/contenteditable/list-manager.js";
import ParagraphFormattingExtension from "../src/components/contenteditable/paragraph-formatting-extension.js";

const stubEditor = (overrides = {}) => ({
	getHTML: vi.fn(() => ""),
	setHTML: vi.fn(),
	currentSelection: vi.fn(() => ({ isCollapsed: true })),
	select: vi.fn(),
	rootNode: document.createElement("div"),
	...overrides,
});

const keyEvent = (overrides = {}) => ({
	key: "",
	shiftKey: false,
	preventDefault: vi.fn(),
	...overrides,
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe("EmphasisFormattingExtension command callbacks", () => {
	it("bold calls the editor once and returns undefined", () => {
		const editor = stubEditor({ bold: vi.fn(() => "ignored") });
		expect(EmphasisFormattingExtension._onBold({ editor })).toBeUndefined();
		expect(editor.bold).toHaveBeenCalledOnce();
	});

	it("italic calls the editor once", () => {
		const editor = stubEditor({ italic: vi.fn() });
		EmphasisFormattingExtension._onItalic({ editor });
		expect(editor.italic).toHaveBeenCalledOnce();
	});

	it("underline calls the editor once", () => {
		const editor = stubEditor({ underline: vi.fn() });
		EmphasisFormattingExtension._onUnderline({ editor });
		expect(editor.underline).toHaveBeenCalledOnce();
	});

	it("strike-through calls the editor once", () => {
		const editor = stubEditor({ strikeThrough: vi.fn() });
		EmphasisFormattingExtension._onStrikeThrough({ editor });
		expect(editor.strikeThrough).toHaveBeenCalledOnce();
	});

	it("toolbar click handlers are the same functions as key handlers", () => {
		const commands = EmphasisFormattingExtension.keyCommandHandlers();
		const buttons = EmphasisFormattingExtension.toolbarButtons();
		expect(buttons.map((button) => button.onClick)).toEqual([
			commands["contenteditable:bold"],
			commands["contenteditable:italic"],
			commands["contenteditable:underline"],
		]);
	});
});

describe("LinkManager link insertion and edits", () => {
	it("returns an empty href for null and non-element values", () => {
		expect(LinkManager._linkAttributeHref(null)).toBe("");
		expect(LinkManager._linkAttributeHref({})).toBe("");
	});

	it("passes toolbar saves through atomicEdit with the selected link", () => {
		const atomicEdit = vi.fn();
		const link = document.createElement("a");
		link.href = "https://example.test";
		vi.spyOn(LinkManager, "_linkAtCursor").mockReturnValue(link);
		const config = LinkManager.toolbarComponentConfig({
			toolbarState: {
				atomicEdit,
				selectionSnapshot: { isCollapsed: true },
			},
		});

		config.props.onSaveUrl("https://new.test", link);
		expect(atomicEdit).toHaveBeenCalledWith(LinkManager._onSaveUrl, {
			url: "https://new.test",
			linkToModify: link,
		});
	});

	it("passes toolbar completion through atomicEdit", () => {
		const atomicEdit = vi.fn();
		vi.spyOn(LinkManager, "_linkAtCursor").mockReturnValue(
			document.createElement("a"),
		);
		const config = LinkManager.toolbarComponentConfig({
			toolbarState: {
				atomicEdit,
				selectionSnapshot: { isCollapsed: true },
			},
		});
		config.props.onDoneWithLink();
		expect(atomicEdit).toHaveBeenCalledWith(LinkManager._onDoneWithLink);
	});

	it("unwraps every pending prompt when link editing finishes", () => {
		const rootNode = document.createElement("div");
		rootNode.innerHTML =
			"<n1-prompt-link>one</n1-prompt-link><n1-prompt-link>two</n1-prompt-link>";
		const editor = stubEditor({ rootNode, unwrapNodeAndSelectAll: vi.fn() });
		LinkManager._onDoneWithLink({ editor });
		expect(editor.unwrapNodeAndSelectAll).toHaveBeenCalledTimes(2);
	});

	it("creates a new link at the restored selection", () => {
		const editor = stubEditor({
			createLink: vi.fn(),
			unwrapNodeAndSelectAll: vi.fn(),
		});
		LinkManager._onSaveUrl({
			editor,
			url: "https://example.test",
			linkToModify: null,
		});
		expect(editor.createLink).toHaveBeenCalledWith("https://example.test");
	});

	it("unlinks the restored selection for a blank URL", () => {
		const editor = stubEditor({ unlink: vi.fn(), unwrapNodeAndSelectAll: vi.fn() });
		LinkManager._onSaveUrl({ editor, url: "  ", linkToModify: null });
		expect(editor.unlink).toHaveBeenCalledOnce();
	});



	it("does nothing when an old link has no equivalent live node", () => {
		const editor = stubEditor({ createLink: vi.fn(), unlink: vi.fn() });
		vi.spyOn(DOMUtils, "findSimilarNodeAtIndex").mockReturnValue(null);
		LinkManager._onSaveUrl({
			editor,
			url: "https://new.test",
			linkToModify: document.createElement("a"),
		});
		expect(editor.createLink).not.toHaveBeenCalled();
		expect(editor.unlink).not.toHaveBeenCalled();
	});

	it("does not rewrite an unchanged URL after trimming whitespace", () => {
		const oldLink = document.createElement("a");
		oldLink.setAttribute("href", " https://same.test ");
		const editor = stubEditor({ createLink: vi.fn() });
		vi.spyOn(DOMUtils, "findSimilarNodeAtIndex").mockReturnValue(oldLink);
		LinkManager._onSaveUrl({ editor, url: "https://same.test", linkToModify: oldLink });
		expect(editor.createLink).not.toHaveBeenCalled();
		expect(editor.select).not.toHaveBeenCalled();
	});
});

describe("ListManager indentation and automatic lists", () => {
	beforeEach(() => {
		ListManager.originalInput = null;
		ListManager._spaceEntered = false;
	});

	it("records a space key for the next content-change pass", () => {
		vi.spyOn(DOMUtils, "isInList").mockReturnValue(false);
		ListManager.onKeyDown({ editor: stubEditor(), event: keyEvent({ key: " " }) });
		expect(ListManager._spaceEntered).toBe(true);
	});



	it("does not consume Tab for a range selection", () => {
		const editor = stubEditor({
			currentSelection: vi.fn(() => ({ isCollapsed: false })),
			indent: vi.fn(),
		});
		vi.spyOn(DOMUtils, "isInList").mockReturnValue(true);
		const event = keyEvent({ key: "Tab" });
		ListManager.onKeyDown({ editor, event });
		expect(event.preventDefault).not.toHaveBeenCalled();
		expect(editor.indent).not.toHaveBeenCalled();
	});

	it("outdents twice when undoing an automatically-created list", () => {
		ListManager.originalInput = "- ";
		const editor = stubEditor({ outdent: vi.fn() });
		vi.spyOn(ListManager, "restoreOriginalInput").mockImplementation(() => {
			ListManager.originalInput = null;
		});
		ListManager.outdentListItem(editor);
		// The first outdent exits the generated list; the second is the method's
		// unconditional legacy outdent and is observable behavior.
		expect(editor.outdent).toHaveBeenCalledTimes(2);
	});

	it("outdents once for a normal list item", () => {
		const editor = stubEditor({ outdent: vi.fn() });
		ListManager.outdentListItem(editor);
		expect(editor.outdent).toHaveBeenCalledOnce();
	});



	it("restores a bullet prefix and moves the caret by two characters", () => {
		const text = document.createTextNode("task");
		const selection = { anchorNode: text };
		const editor = stubEditor({ currentSelection: vi.fn(() => selection) });
		ListManager.originalInput = "- ";
		vi.spyOn(DOMUtils.Mutating, "moveSelectionToIndexInAnchorNode").mockImplementation(() => {});
		ListManager.restoreOriginalInput(editor);
		expect(text.textContent).toBe("- task");
		expect(DOMUtils.Mutating.moveSelectionToIndexInAnchorNode).toHaveBeenCalledWith(selection, 2);
	});
});

describe("ParagraphFormattingExtension command callbacks", () => {
	it("indent ignores the editor return value", () => {
		const editor = stubEditor({ indent: vi.fn(() => "ignored") });
		expect(ParagraphFormattingExtension._onIndent({ editor })).toBeUndefined();
	});

	it("outdent ignores the editor return value", () => {
		const editor = stubEditor({ outdent: vi.fn(() => "ignored") });
		expect(ParagraphFormattingExtension._onOutdent({ editor })).toBeUndefined();
	});

	it("exposes stable direct callbacks from the command map", () => {
		const commands = ParagraphFormattingExtension.keyCommandHandlers();
		expect(commands["contenteditable:indent"]).toBe(ParagraphFormattingExtension._onIndent);
		expect(commands["contenteditable:outdent"]).toBe(ParagraphFormattingExtension._onOutdent);
	});
});
