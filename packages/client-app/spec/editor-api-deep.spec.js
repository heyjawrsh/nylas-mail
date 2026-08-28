import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => {
	const selectionInstances = [];
	class ExtendedSelection {
		constructor(rootNode) {
			this.rootNode = rootNode;
			this.getRangeAt = vi.fn(() => document.createRange());
			this.selectFromTo = vi.fn();
			this.exportSelection = vi.fn(() => ({ anchor: "saved" }));
			this.getSelectionTextIndex = vi.fn(() => ({ startIndex: 1, endIndex: 3 }));
			this.importSelection = vi.fn();
			this.select = vi.fn();
			this.selectAllChildren = vi.fn();
			this.restoreSelectionByTextIndex = vi.fn();
			selectionInstances.push(this);
		}
	}
	const underscore = { last: (values) => values[values.length - 1] };
	const domUtils = {
		wrap: vi.fn(),
		unwrapNode: vi.fn(),
		findFirstTextNode: vi.fn(),
		findLastTextNode: vi.fn(),
		regExpSelectorAll: vi.fn(),
	};
	const React = { createElement: vi.fn() };
	const remote = { getCurrentWindow: vi.fn(), getGlobal: vi.fn(), app: { quit: vi.fn() } };
	const electron = { ipcRenderer: { send: vi.fn() }, remote };
	const overlaidComponents = { buildAnchorTag: vi.fn() };
	return { selectionInstances, ExtendedSelection, underscore, domUtils, React, remote, electron, overlaidComponents };
});

vi.mock("underscore", () => ({ default: m.underscore, ...m.underscore }));
vi.mock("nylas-exports", () => ({ default: { DOMUtils: m.domUtils }, DOMUtils: m.domUtils }));
vi.mock("react", () => ({ default: m.React, ...m.React }));
vi.mock("../src/components/contenteditable/extended-selection.js", () => ({ default: m.ExtendedSelection }));
vi.mock("../src/components/overlaid-components/overlaid-components.jsx", () => ({ default: m.overlaidComponents }));
vi.mock("electron", () => ({ default: m.electron, ...m.electron }));
vi.mock("@electron/remote", () => ({ default: m.remote, ...m.remote, remote: m.remote }));

globalThis.NylasEnv = {
	isWorkWindow: vi.fn(() => true),
	inSpecMode: vi.fn(() => true),
	inDevMode: vi.fn(() => false),
	reportError: vi.fn(),
	config: { get: vi.fn(() => null), onDidChange: vi.fn(() => ({ dispose: vi.fn() })) },
	getConfigDirPath: vi.fn(() => "/tmp"),
	getPath: vi.fn(() => "/tmp"),
	getVersion: vi.fn(() => "0.0.0"),
};

const { default: EditorAPI } = await import("../src/components/contenteditable/editor-api.js");

const makeEditor = (html = "<p>hello</p>") => {
	const root = document.createElement("div");
	root.contentEditable = "true";
	root.tabIndex = -1;
	root.innerHTML = html;
	document.body.appendChild(root);
	return { root, editor: new EditorAPI(root), selection: m.selectionInstances.at(-1) };
};

describe("EditorAPI selection and DOM surfaces", () => {
	beforeEach(() => {
		document.body.innerHTML = "";
		vi.clearAllMocks();
		document.execCommand = vi.fn(() => true);
	});

	it("constructs an extended selection scoped to the editor root", () => {
		const { root, selection } = makeEditor();
		expect(selection.rootNode).toBe(root);
	});

	it("returns the current extended selection", () => {
		const { editor, selection } = makeEditor();
		expect(editor.currentSelection()).toBe(selection);
	});

	it("wraps the current range and selects the wrapper", () => {
		const { editor, selection } = makeEditor();
		const wrapper = document.createElement("code");
		m.domUtils.wrap.mockReturnValue(wrapper);
		expect(editor.wrapSelection("code")).toBe(editor);
		expect(selection.select).toHaveBeenCalledWith(wrapper);
	});

	it("unwraps a node and selects from its first to last text node", () => {
		const { root, editor, selection } = makeEditor("<span><b>one</b>two</span>");
		const first = root.querySelector("b").firstChild;
		const last = root.querySelector("span").lastChild;
		m.domUtils.unwrapNode.mockReturnValue([root.querySelector("b"), last]);
		m.domUtils.findFirstTextNode.mockReturnValue(first);
		m.domUtils.findLastTextNode.mockReturnValue(last);
		expect(editor.unwrapNodeAndSelectAll(root.querySelector("span"))).toBe(editor);
		expect(selection.selectFromTo).toHaveBeenCalledWith(first, last);
	});

	it("leaves the selection unchanged when unwrapping replaces no nodes", () => {
		const { editor, selection } = makeEditor();
		m.domUtils.unwrapNode.mockReturnValue([]);
		expect(editor.unwrapNodeAndSelectAll(document.createElement("span"))).toBe(editor);
		expect(selection.selectFromTo).not.toHaveBeenCalled();
	});

	it("finds regular-expression matches within the editor root", () => {
		const { root, editor } = makeEditor();
		m.domUtils.regExpSelectorAll.mockReturnValue([root.firstChild]);
		expect(editor.regExpSelectorAll(/hello/)).toEqual([root.firstChild]);
		expect(m.domUtils.regExpSelectorAll).toHaveBeenCalledWith(root, /hello/);
	});

	it("runs an unfocused mutation without exporting the selection", () => {
		const { editor, selection } = makeEditor();
		const result = editor.whilePreservingSelection(() => "changed");
		expect(result).toBe("changed");
		expect(selection.exportSelection).not.toHaveBeenCalled();
	});

	it("restores the selection after a focused mutation", () => {
		const { root, editor, selection } = makeEditor();
		root.focus();
		const mutation = vi.fn();
		expect(editor.whilePreservingSelection(mutation)).toBe(editor);
		expect(selection.select).toHaveBeenCalledWith({ anchor: "saved" });
	});

	it("preserves selection while focus is inside the editor", () => {
		const { root, editor, selection } = makeEditor("<button>child</button>");
		root.querySelector("button").focus();
		editor.whilePreservingSelection(vi.fn());
		expect(selection.exportSelection).toHaveBeenCalledOnce();
	});

	it("forwards text-index arguments", () => {
		const { editor, selection, root } = makeEditor();
		expect(editor.getSelectionTextIndex(root, "extra")).toEqual({ startIndex: 1, endIndex: 3 });
		expect(selection.getSelectionTextIndex).toHaveBeenCalledWith(root, "extra");
	});

	it("imports a selection and remains chainable", () => {
		const { editor, selection } = makeEditor();
		const saved = { anchor: 2 };
		expect(editor.importSelection(saved)).toBe(editor);
		expect(selection.importSelection).toHaveBeenCalledWith(saved);
	});

	it("selects arbitrary endpoints and remains chainable", () => {
		const { editor, selection, root } = makeEditor();
		expect(editor.select(root.firstChild, root.lastChild)).toBe(editor);
		expect(selection.select).toHaveBeenCalledWith(root.firstChild, root.lastChild);
	});

	it("selects all children and remains chainable", () => {
		const { editor, selection, root } = makeEditor();
		expect(editor.selectAllChildren(root)).toBe(editor);
		expect(selection.selectAllChildren).toHaveBeenCalledWith(root);
	});

	it("restores a selection by text index and remains chainable", () => {
		const { editor, selection, root } = makeEditor();
		expect(editor.restoreSelectionByTextIndex(root, 1, 4)).toBe(editor);
		expect(selection.restoreSelectionByTextIndex).toHaveBeenCalledWith(root, 1, 4);
	});

	it("normalizes adjacent text nodes in the editor", () => {
		const { root, editor } = makeEditor("");
		root.append("one", "two");
		expect(editor.normalize()).toBe(editor);
		expect(root.childNodes).toHaveLength(1);
	});
});

describe("EditorAPI command and block-transform surfaces", () => {
	beforeEach(() => {
		document.body.innerHTML = "";
		vi.clearAllMocks();
		document.execCommand = vi.fn(() => true);
	});

	it("applies bold formatting", () => {
		const { editor } = makeEditor();
		expect(editor.bold()).toBe(editor);
		expect(document.execCommand).toHaveBeenCalledWith("bold", false);
	});

	it("applies italic formatting", () => {
		const { editor } = makeEditor();
		editor.italic();
		expect(document.execCommand).toHaveBeenCalledWith("italic", false);
	});

	it("applies underline formatting", () => {
		const { editor } = makeEditor();
		editor.underline();
		expect(document.execCommand).toHaveBeenCalledWith("underline", false);
	});

	it("applies strike-through formatting", () => {
		const { editor } = makeEditor();
		editor.strikeThrough();
		expect(document.execCommand).toHaveBeenCalledWith("strikeThrough", false);
	});

	it("sets the foreground color", () => {
		const { editor } = makeEditor();
		editor.foreColor("#123456");
		expect(document.execCommand).toHaveBeenCalledWith("foreColor", false, "#123456");
	});

	it("sets the background color", () => {
		const { editor } = makeEditor();
		editor.backColor("yellow");
		expect(document.execCommand).toHaveBeenCalledWith("backColor", false, "yellow");
	});

	it("sets the font family", () => {
		const { editor } = makeEditor();
		editor.fontName("serif");
		expect(document.execCommand).toHaveBeenCalledWith("fontName", false, "serif");
	});

	it("sets the font size", () => {
		const { editor } = makeEditor();
		editor.fontSize("4");
		expect(document.execCommand).toHaveBeenCalledWith("fontSize", false, "4");
	});

	it("creates a link", () => {
		const { editor } = makeEditor();
		editor.createLink("https://example.test");
		expect(document.execCommand).toHaveBeenCalledWith("createLink", false, "https://example.test");
	});

	it("transforms the current block", () => {
		const { editor } = makeEditor();
		editor.formatBlock("blockquote");
		expect(document.execCommand).toHaveBeenCalledWith("formatBlock", false, "blockquote");
	});

	it("applies a heading transform", () => {
		const { editor } = makeEditor();
		editor.heading("h2");
		expect(document.execCommand).toHaveBeenCalledWith("heading", false, "h2");
	});

	it("indents the current block", () => {
		const { editor } = makeEditor();
		editor.indent();
		expect(document.execCommand).toHaveBeenCalledWith("indent", false);
	});

	it("outdents the current block", () => {
		const { editor } = makeEditor();
		editor.outdent();
		expect(document.execCommand).toHaveBeenCalledWith("outdent", false);
	});

	it("creates an ordered list", () => {
		const { editor } = makeEditor();
		editor.insertOrderedList();
		expect(document.execCommand).toHaveBeenCalledWith("insertOrderedList", false);
	});

	it("creates an unordered list", () => {
		const { editor } = makeEditor();
		editor.insertUnorderedList();
		expect(document.execCommand).toHaveBeenCalledWith("insertUnorderedList", false);
	});

	it("centers the current block", () => {
		const { editor } = makeEditor();
		editor.justifyCenter();
		expect(document.execCommand).toHaveBeenCalledWith("justifyCenter", false);
	});

	it("inserts plain text", () => {
		const { editor } = makeEditor();
		editor.insertText("new text");
		expect(document.execCommand).toHaveBeenCalledWith("insertText", false, "new text");
	});

	it("inserts an image", () => {
		const { editor } = makeEditor();
		editor.insertImage("cid:image-1");
		expect(document.execCommand).toHaveBeenCalledWith("insertImage", false, "cid:image-1");
	});

	it("inserts HTML without a selection wrapper by default", () => {
		const { editor } = makeEditor();
		expect(editor.insertHTML("<b>new</b>")).toBe(editor);
		expect(document.execCommand).toHaveBeenCalledWith("insertHTML", false, "<b>new</b>");
	});

	it("wraps inserted HTML temporarily when selecting the insertion", () => {
		const { root, editor } = makeEditor("");
		document.execCommand.mockImplementation((_command, _ui, html) => { root.innerHTML = html; return true; });
		m.domUtils.unwrapNode.mockImplementation((node) => [...node.childNodes]);
		m.domUtils.findFirstTextNode.mockImplementation((node) => node.firstChild || node);
		m.domUtils.findLastTextNode.mockImplementation((node) => node.lastChild || node);
		expect(editor.insertHTML("<b>new</b>", { selectInsertion: true })).toBe(editor);
		expect(document.execCommand).toHaveBeenCalledWith("insertHTML", false, '<span id="tmp-html-insertion-wrap"><b>new</b></span>');
	});

	it("toggles CSS styling mode", () => {
		const { editor } = makeEditor();
		editor.styleWithCSS(true);
		expect(document.execCommand).toHaveBeenCalledWith("styleWithCSS", false, true);
	});

	it("removes current formatting", () => {
		const { editor } = makeEditor();
		editor.removeFormat();
		expect(document.execCommand).toHaveBeenCalledWith("removeFormat", false);
	});

	it("undoes the latest edit", () => {
		const { editor } = makeEditor();
		editor.undo();
		expect(document.execCommand).toHaveBeenCalledWith("undo", false);
	});

	it("redoes the latest reverted edit", () => {
		const { editor } = makeEditor();
		editor.redo();
		expect(document.execCommand).toHaveBeenCalledWith("redo", false);
	});

	it.each([
		["copy", "copy"],
		["cut", "cut"],
		["decreaseFontSize", "decreaseFontSize"],
		["delete", "delete"],
		["forwardDelete", "forwardDelete"],
		["increaseFontSize", "increaseFontSize"],
		["insertHorizontalRule", "insertHorizontalRule"],
		["insertParagraph", "insertParagraph"],
		["justifyFull", "justifyFull"],
		["justifyLeft", "justifyLeft"],
		["justifyRight", "justifyRight"],
		["paste", "paste"],
		["selectAll", "selectAll"],
		["subscript", "subscript"],
		["superscript", "superscript"],
		["unlink", "unlink"],
	])("delegates %s as one editor command", (method, command) => {
		const { editor } = makeEditor();
		expect(editor[method]()).toBe(editor);
		expect(document.execCommand).toHaveBeenCalledWith(command, false);
	});

	it("sets the highlight color", () => {
		const { editor } = makeEditor();
		editor.hiliteColor("orange");
		expect(document.execCommand).toHaveBeenCalledWith("hiliteColor", false, "orange");
	});
});

describe("EditorAPI custom components and unsupported commands", () => {
	beforeEach(() => {
		document.body.innerHTML = "";
		vi.clearAllMocks();
		document.execCommand = vi.fn(() => true);
	});

	it("builds and inserts a custom-component anchor", () => {
		const { editor } = makeEditor();
		m.overlaidComponents.buildAnchorTag.mockReturnValue({ anchorId: "anchor-1", anchorTag: '<img data-overlay-id="anchor-1">' });
		expect(editor.insertCustomComponent("calendar", { eventId: "e1" })).toBe("anchor-1");
		expect(m.overlaidComponents.buildAnchorTag).toHaveBeenCalledWith("calendar", { eventId: "e1" }, undefined);
	});

	it("uses empty props when inserting a custom component without props", () => {
		const { editor } = makeEditor();
		m.overlaidComponents.buildAnchorTag.mockReturnValue({ anchorId: "anchor-2", anchorTag: "<img>" });
		editor.insertCustomComponent("poll");
		expect(m.overlaidComponents.buildAnchorTag).toHaveBeenCalledWith("poll", {}, undefined);
	});

	it("removes a custom-component anchor from the editor document", () => {
		const { root, editor } = makeEditor('<p><img data-overlay-id="anchor-1"></p>');
		const removed = editor.removeCustomComponentByAnchorId("anchor-1");
		expect(removed.tagName).toBe("IMG");
		expect(root.querySelector("img")).toBeNull();
	});

	it("returns undefined for an empty custom-component anchor id", () => {
		const { editor } = makeEditor();
		expect(editor.removeCustomComponentByAnchorId("")).toBeUndefined();
	});

	it("returns undefined when a custom-component anchor is absent", () => {
		const { editor } = makeEditor();
		expect(editor.removeCustomComponentByAnchorId("missing")).toBeUndefined();
	});

	it("rejects the unsupported content-read-only command", () => {
		const { editor } = makeEditor();
		expect(() => editor.contentReadOnly()).toThrow("Not implemented");
	});

	it("rejects the unsupported inline-table-editing command", () => {
		const { editor } = makeEditor();
		expect(() => editor.enableInlineTableEditing()).toThrow("Not implemented");
	});

	it("rejects the unsupported object-resizing command", () => {
		const { editor } = makeEditor();
		expect(() => editor.enableObjectResizing()).toThrow("Not implemented");
	});

	it("rejects the unsupported insert-break-on-return command", () => {
		const { editor } = makeEditor();
		expect(() => editor.insertBrOnReturn()).toThrow("Not implemented");
	});

	it("rejects the unsupported legacy CSS command", () => {
		const { editor } = makeEditor();
		expect(() => editor.useCSS()).toThrow("Not implemented");
	});
});
