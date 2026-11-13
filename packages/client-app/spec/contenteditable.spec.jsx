import React, { createRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";

const m = vi.hoisted(() => ({
	coreKeyDown: vi.fn(),
	reportError: vi.fn(),
	serviceInstances: [],
}));

vi.mock("prop-types", () => {
	const checker = Object.assign(() => null, { isRequired: () => null });
	const types = new Proxy({}, { get: () => checker });
	return { default: types, ...types };
});
vi.mock("underscore", () => {
	const underscore = {
		extend: (target, ...sources) => Object.assign(target, ...sources),
		isMatch: (object, attrs) => Object.keys(attrs).every((key) => object[key] === attrs[key]),
		isFunction: (value) => typeof value === "function",
		each: (object, iteratee) => Object.entries(object).forEach(([key, value]) => iteratee(value, key)),
	};
	return { default: underscore, ...underscore };
});
vi.mock("electron", () => {
	const ipcRenderer = { on: vi.fn(), send: vi.fn() };
	const remote = {
		app: { quit: vi.fn(), getVersion: () => "0", getPath: () => "/tmp" },
		screen: { getPrimaryDisplay: () => ({ workArea: { width: 100, height: 100 } }) },
		dialog: { showMessageBox: vi.fn() }, getCurrentWindow: () => ({}),
	};
	return { default: { remote, ipcRenderer }, remote, ipcRenderer };
});
vi.mock("@electron/remote", () => {
	const ipcRenderer = { on: vi.fn(), send: vi.fn() };
	const app = { quit: vi.fn(), getVersion: () => "0", getPath: () => "/tmp" };
	const screen = { getPrimaryDisplay: () => ({ workArea: { width: 100, height: 100 } }) };
	const dialog = { showMessageBox: vi.fn() };
	const remote = { app, screen, dialog, getCurrentWindow: () => ({}) };
	return { default: { remote, app, screen, dialog, ipcRenderer }, remote, app, screen, dialog, ipcRenderer };
});
vi.mock("nylas-exports", () => ({
	default: {},
	Utils: { isEqualReact: (left, right) => left === right },
	DOMUtils: {},
}));
vi.mock("nylas-component-kit", () => ({
	default: {},
	KeyCommandsRegion: ({ localHandlers: _localHandlers, ...props }) => <section {...props} />,
}));
vi.mock("../src/components/contenteditable/floating-toolbar.jsx", () => ({ default: () => <aside data-testid="floating-toolbar" /> }));
vi.mock("../src/components/contenteditable/editor-api.js", () => ({
	default: class EditorAPI { constructor(node) { this.node = node; } currentSelection() { return { isInScope: () => true }; } },
}));
vi.mock("../src/components/contenteditable/extended-selection.js", () => ({
	default: class ExtendedSelection {
		isInScope() { return false; }
		importSelection() {}
	},
}));

vi.mock("../src/components/contenteditable/mouse-service.js", () => ({
	default: class MouseService {
		constructor(options) { this.options = options; this.setData = vi.fn(); this.teardown = vi.fn(); m.serviceInstances.push(this); }
		eventHandlers() { return {}; }
	},
}));
vi.mock("../src/components/contenteditable/clipboard-service.js", () => ({
	default: class ClipboardService {
		constructor(options) { this.options = options; this.setData = vi.fn(); this.teardown = vi.fn(); m.serviceInstances.push(this); }
		eventHandlers() { return {}; }
	},
}));

vi.mock("../src/components/contenteditable/tab-manager.js", () => ({ default: class TabManager {} }));
vi.mock("../src/components/contenteditable/link-manager.js", () => ({ default: class LinkManager {} }));
vi.mock("../src/components/contenteditable/list-manager.js", () => ({ default: class ListManager {} }));
vi.mock("../src/components/contenteditable/dom-normalizer.js", () => ({ default: class DOMNormalizer {} }));
vi.mock("../src/components/contenteditable/blockquote-manager.js", () => ({ default: class BlockquoteManager {} }));
vi.mock("../src/components/contenteditable/toolbar-button-manager.js", () => {
	class ToolbarButtonManager {}
	ToolbarButtonManager.onKeyDown = (args) => m.coreKeyDown(args);
	return { default: ToolbarButtonManager };
});
vi.mock("../src/components/contenteditable/emphasis-formatting-extension.js", () => ({ default: class EmphasisFormattingExtension {} }));
vi.mock("../src/components/contenteditable/paragraph-formatting-extension.js", () => ({ default: class ParagraphFormattingExtension {} }));

globalThis.NylasEnv = { reportError: m.reportError, inDevMode: () => false, config: { get: () => null }, keymaps: { loadKeymap: () => ({}) } };

const { default: Contenteditable } = await import("../src/components/contenteditable/contenteditable.jsx");

afterEach(cleanup);

function fixture(overrides = {}) {
	const ref = createRef();
	const props = { value: "<p>Hello</p>", onChange: vi.fn(), floatingToolbar: false, ...overrides };
	const view = render(<Contenteditable ref={ref} {...props} />);
	return { ...view, ref, props, editable: () => view.container.querySelector(".contenteditable") };
}

describe("Contenteditable controlled value contract", () => {
	beforeEach(() => { vi.clearAllMocks(); m.serviceInstances.length = 0; });

	it("renders the value prop as HTML", () => {
		const f = fixture();
		expect(f.editable().innerHTML).toBe("<p>Hello</p>");
	});

	it("renders an empty controlled value", () => {
		const f = fixture({ value: "" });
		expect(f.editable().innerHTML).toBe("");
	});

	it("updates the DOM when the value prop changes", () => {
		const f = fixture();
		f.rerender(<Contenteditable ref={f.ref} {...f.props} value="<strong>Changed</strong>" />);
		expect(f.editable().innerHTML).toBe("<strong>Changed</strong>");
	});

	it("does not call onChange merely because value is rerendered", () => {
		const f = fixture();
		f.rerender(<Contenteditable ref={f.ref} {...f.props} value="<b>Parent update</b>" />);
		expect(f.props.onChange).not.toHaveBeenCalled();
	});

	it("reports mutated HTML through the input-like event contract", () => {
		const f = fixture();
		f.editable().innerHTML = "<p>Typed</p>";
		f.ref.current._onDOMMutated([{ target: f.editable() }]);
		expect(f.props.onChange).toHaveBeenCalledWith({ target: { value: "<p>Typed</p>" } });
	});

	it("ignores an empty mutation batch", () => {
		const f = fixture();
		f.ref.current._onDOMMutated([]);
		expect(f.props.onChange).not.toHaveBeenCalled();
	});

	it("does not notify extensions about mutations marked with the ignore class", () => {
		const extension = { onContentChanged: vi.fn() };
		const f = fixture({ extensions: [extension] });
		const ignored = document.createElement("span");
		ignored.className = Contenteditable.IgnoreMutationClassName;
		f.ref.current._onDOMMutated([{ target: ignored }]);
		expect(extension.onContentChanged).not.toHaveBeenCalled();
	});

	it("exposes the placeholder on the editable element", () => {
		const f = fixture({ placeholder: "Write a reply" });
		expect(f.editable().getAttribute("placeholder")).toBe("Write a reply");
	});

	it("renders an editable DOM node", () => {
		const f = fixture();
		expect(f.editable().getAttribute("contenteditable")).toBe("true");
	});

	it("reaches its editable node and container through object refs", () => {
		const f = fixture();
		expect(f.ref.current._editableNode()).toBe(f.editable());
		expect(f.ref.current.getDOMNode()).toBe(f.editable().parentNode);
	});

	it("uses the component's actual disabled spellcheck behavior", () => {
		const f = fixture({ spellcheck: true });
		expect(f.editable().getAttribute("spellcheck")).toBe("false");
	});

	it("omits the floating toolbar when disabled", () => {
		const f = fixture();
		expect(f.queryByTestId("floating-toolbar")).toBeNull();
	});

	it("renders the floating toolbar when enabled", () => {
		const f = fixture({ floatingToolbar: true });
		expect(f.getByTestId("floating-toolbar")).toBeDefined();
	});
});

describe("Contenteditable focus, blur, and key routing", () => {
	beforeEach(() => { vi.clearAllMocks(); m.serviceInstances.length = 0; });

	it("routes focus to a supplied extension", () => {
		const extension = { onFocus: vi.fn() };
		const f = fixture({ extensions: [extension] });
		fireEvent.focus(f.editable());
		expect(extension.onFocus).toHaveBeenCalledOnce();
	});

	it("passes the focus event to the extension", () => {
		const extension = { onFocus: vi.fn() };
		const f = fixture({ extensions: [extension] });
		fireEvent.focus(f.editable());
		expect(extension.onFocus.mock.calls[0][0].event.type).toBe("focus");
	});

	it("routes blur outside the container to a supplied extension", () => {
		const extension = { onBlur: vi.fn() };
		const f = fixture({ extensions: [extension] });
		fireEvent.blur(f.editable(), { relatedTarget: document.body });
		expect(extension.onBlur).toHaveBeenCalledOnce();
	});

	it("does not route blur when focus remains in the container", () => {
		const extension = { onBlur: vi.fn() };
		const f = fixture({ extensions: [extension] });
		const sibling = document.createElement("button");
		f.editable().parentElement.appendChild(sibling);
		fireEvent.blur(f.editable(), { relatedTarget: sibling });
		expect(extension.onBlur).not.toHaveBeenCalled();
	});

	it("clears dragging state on blur", () => {
		const f = fixture();
		f.ref.current.innerState.dragging = true;
		fireEvent.blur(f.editable(), { relatedTarget: document.body });
		expect(f.ref.current.innerState.dragging).toBe(false);
	});

	it("routes keydown to a supplied extension", () => {
		const extension = { onKeyDown: vi.fn() };
		const f = fixture({ extensions: [extension] });
		fireEvent.keyDown(f.editable(), { key: "Enter" });
		expect(extension.onKeyDown).toHaveBeenCalledOnce();
	});

	it("passes key identity through keydown routing", () => {
		const extension = { onKeyDown: vi.fn() };
		const f = fixture({ extensions: [extension] });
		fireEvent.keyDown(f.editable(), { key: "ArrowDown" });
		expect(extension.onKeyDown.mock.calls[0][0].event.key).toBe("ArrowDown");
	});

	it("routes an unhandled keydown to core extensions", () => {
		const f = fixture();
		fireEvent.keyDown(f.editable(), { key: "Tab" });
		expect(m.coreKeyDown).toHaveBeenCalledOnce();
	});

	it("stops core key routing when a custom extension prevents default", () => {
		const extension = { onKeyDown: ({ event }) => event.preventDefault() };
		const f = fixture({ extensions: [extension] });
		fireEvent.keyDown(f.editable(), { key: "Tab" });
		expect(m.coreKeyDown).not.toHaveBeenCalled();
	});

	it("focuses the rendered editable node through the public method", () => {
		const f = fixture();
		f.ref.current.focus();
		expect(document.activeElement).toBe(f.editable());
	});
});
