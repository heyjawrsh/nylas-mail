import React, { createRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const m = vi.hoisted(() => ({
	menuItems: [],
	menuPopups: vi.fn(),
	registeredObjectReplacer: (_key, value) => value,
	registeredObjectReviver: (_key, value) => value,
}));

vi.mock("prop-types", () => {
	const checker = Object.assign(() => null, { isRequired: () => null });
	const types = new Proxy({ arrayOf: () => checker, oneOfType: () => checker }, { get: (target, key) => target[key] || checker });
	return { default: types };
});
vi.mock("classnames", () => ({
	default: (...values) => values.flatMap((value) => typeof value === "string" ? [value] : value && typeof value === "object" ? Object.keys(value).filter((key) => value[key]) : []).join(" "),
}));
vi.mock("underscore", () => {
	const underscore = {
		values: (object) => Object.values(object || {}),
		uniq: (items) => [...new Set(items || [])],
		extend: (target, ...sources) => Object.assign(target, ...sources),
		extendOwn: (target, ...sources) => Object.assign(target, ...sources),
		debounce: (fn) => fn,
		last: (items) => items?.[items.length - 1],
		isArray: Array.isArray,
	};
	return { default: underscore, ...underscore };
});
vi.mock("react-dom", async (importOriginal) => {
	const actual = await importOriginal();
	const findDOMNode = (value) => value instanceof Element ? value : value?.inputRef?.current || value;
	return { ...actual, default: { ...actual.default, findDOMNode }, findDOMNode };
});
vi.mock("@electron/remote", () => {
	const remote = {
		Menu: class Menu {
			append(item) { m.menuItems.push(item); }
			popup(window) { m.menuPopups(window); }
		},
		MenuItem: class MenuItem { constructor(options) { Object.assign(this, options); } },
		getCurrentWindow: vi.fn(() => "current-window"),
	};
	return { default: remote, ...remote, remote };
});
vi.mock("nylas-exports", () => ({
	Utils: { registeredObjectReplacer: m.registeredObjectReplacer, registeredObjectReviver: m.registeredObjectReviver },
	RegExpUtils: { emailRegex: () => /[\w.+-]+@[\w.-]+\.[A-Za-z]+/ },
}));
vi.mock("nylas-component-kit", () => ({
	Menu: class Menu extends React.Component {
		getSelectedItem() { return this.props.items[0] || null; }
		render() {
			return <div className={this.props.className} tabIndex={-1}>
				{this.props.headerComponents}
				{this.props.items.map((item) => <button type="button" data-testid={`suggestion-${item.id}`} key={item.id} onMouseDown={() => this.props.onSelect(item)}>{this.props.itemContent(item)}</button>)}
			</div>;
		}
	},
}));
vi.mock("../src/components/retina-img.jsx", () => ({ default: Object.assign(() => <span data-testid="retina-img" />, { Mode: { ContentIsMask: "mask" } }) }));
vi.mock("../src/components/key-commands-region.jsx", () => ({
	default: class KeyCommandsRegion extends React.Component {
		render() { const { localHandlers: _handlers, ...props } = this.props; return <div {...props} />; }
	},
}));

import TokenizingTextField from "../src/components/tokenizing-text-field.jsx";

afterEach(cleanup);

const token = (id, label = id) => ({ id, label, toString: () => label });
const alice = token("alice", "Alice");
const bob = token("bob", "Bob");
const cara = token("cara", "Cara");

function fixture(overrides = {}) {
	const ref = createRef();
	const props = {
		tokens: [alice, bob],
		tokenKey: (item) => item.id,
		tokenRenderer: ({ token: item }) => <span>{item.label}</span>,
		tokenIsValid: () => true,
		onRequestCompletions: vi.fn(() => []),
		completionNode: (item) => <span>{item.label}</span>,
		onAdd: vi.fn(),
		onRemove: vi.fn(),
		...overrides,
	};
	const view = render(<TokenizingTextField ref={ref} {...props} />);
	return { ...view, ref, props, input: () => view.container.querySelector("input") };
}

describe("TokenizingTextField rendering and suggestions", () => {
	beforeEach(() => { vi.clearAllMocks(); m.menuItems.length = 0; });

	it("renders tokens in their supplied order", () => {
		fixture();
		expect(screen.getByText("Alice").compareDocumentPosition(screen.getByText("Bob")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
	});

	it("marks invalid tokens", () => {
		const { container } = fixture({ tokenIsValid: (item) => item !== bob });
		expect(container.querySelectorAll(".token.invalid")).toHaveLength(1);
	});

	it("shows a placeholder only when input and tokens are empty", () => {
		fixture({ tokens: [], placeholder: "Recipients" });
		expect(screen.getByText("Recipients")).toBeDefined();
	});

	it("renders a menu prompt with punctuation", () => {
		fixture({ menuPrompt: "To" });
		expect(screen.getByText("To:")).toBeDefined();
	});

	it("requests suggestions for changed input after trimming leading whitespace", () => {
		const f = fixture();
		fireEvent.change(f.input(), { target: { value: "  ca" } });
		expect(f.props.onRequestCompletions).toHaveBeenLastCalledWith("ca", { clear: undefined });
	});

	it("renders returned suggestions", () => {
		const f = fixture({ onRequestCompletions: vi.fn(() => [cara]) });
		fireEvent.change(f.input(), { target: { value: "ca" } });
		expect(screen.getByTestId("suggestion-cara")).toBeDefined();
	});

	it("filters suggestions already present as tokens", () => {
		const f = fixture({ onRequestCompletions: vi.fn(() => [alice, cara]) });
		fireEvent.change(f.input(), { target: { value: "a" } });
		expect(screen.queryByTestId("suggestion-alice")).toBeNull();
		expect(screen.getByTestId("suggestion-cara")).toBeDefined();
	});

	it("accepts asynchronous suggestions while mounted", async () => {
		const f = fixture({ onRequestCompletions: vi.fn(() => Promise.resolve([cara])) });
		fireEvent.change(f.input(), { target: { value: "ca" } });
		await waitFor(() => expect(screen.getByTestId("suggestion-cara")).toBeDefined());
	});

	it("clears invalid completion return values", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const f = fixture({ onRequestCompletions: vi.fn(() => null) });
		fireEvent.change(f.input(), { target: { value: "x" } });
		expect(f.ref.current.state.completions).toEqual([]);
		expect(warn).toHaveBeenCalledOnce();
		warn.mockRestore();
	});

	it("adds a clicked suggestion", () => {
		const f = fixture({ onRequestCompletions: vi.fn(() => [cara]) });
		fireEvent.change(f.input(), { target: { value: "ca" } });
		fireEvent.mouseDown(screen.getByTestId("suggestion-cara"));
		expect(f.props.onAdd).toHaveBeenCalledWith([cara]);
	});
});

describe("TokenizingTextField keyboard and token management", () => {
	it("submits the first completion with Enter", () => {
		const f = fixture({ onRequestCompletions: vi.fn(() => [cara]) });
		fireEvent.change(f.input(), { target: { value: "ca" } });
		fireEvent.keyDown(f.input(), { key: "Enter" });
		expect(f.props.onAdd).toHaveBeenCalledWith([cara]);
	});

	it("submits raw input with comma when there are no completions", () => {
		const f = fixture();
		fireEvent.change(f.input(), { target: { value: "new" } });
		fireEvent.keyDown(f.input(), { key: "," });
		expect(f.props.onAdd).toHaveBeenCalledWith("new", {});
	});

	it("does not submit whitespace-only input", () => {
		const f = fixture();
		fireEvent.change(f.input(), { target: { value: " " } });
		fireEvent.keyDown(f.input(), { key: "Tab" });
		expect(f.props.onAdd).not.toHaveBeenCalled();
	});

	it("allows submission policy to replace a completion with text", () => {
		const onInputTrySubmit = vi.fn(() => "replacement@example.com");
		const f = fixture({ onInputTrySubmit });
		fireEvent.change(f.input(), { target: { value: "replacement" } });
		fireEvent.keyDown(f.input(), { key: "Enter" });
		expect(f.props.onAdd).toHaveBeenCalledWith("replacement@example.com", { skipNameLookup: true });
	});

	it("uses a custom key-breaking policy", () => {
		const f = fixture({ shouldBreakOnKeydown: (event) => event.key === ";" });
		fireEvent.change(f.input(), { target: { value: "new" } });
		fireEvent.keyDown(f.input(), { key: ";" });
		expect(f.props.onAdd).toHaveBeenCalledWith("new", {});
	});

	it("selects the last token on the first Backspace", () => {
		const f = fixture();
		fireEvent.keyDown(f.input(), { key: "Backspace" });
		expect(f.ref.current.state.selectedKeys).toEqual(["bob"]);
		expect(f.props.onRemove).not.toHaveBeenCalled();
	});

	it("removes selected tokens on the next Backspace", () => {
		const f = fixture();
		act(() => f.ref.current.setState({ selectedKeys: ["bob"] }));
		fireEvent.keyDown(f.input(), { key: "Backspace" });
		expect(f.props.onRemove).toHaveBeenCalledWith([bob]);
	});

	it("notifies when removal is attempted on an empty field", () => {
		const onEmptied = vi.fn();
		const f = fixture({ tokens: [], onEmptied });
		fireEvent.keyDown(f.input(), { key: "Delete" });
		expect(onEmptied).toHaveBeenCalledOnce();
	});

	it("selects a clicked token exclusively", () => {
		const f = fixture();
		fireEvent.click(screen.getByText("Alice"));
		expect(f.ref.current.state.selectedKeys).toEqual(["alice"]);
	});

	it("meta-click toggles a token in a multi-selection", () => {
		const f = fixture();
		fireEvent.click(screen.getByText("Alice"));
		fireEvent.click(screen.getByText("Bob"), { metaKey: true });
		expect(f.ref.current.state.selectedKeys).toEqual(["alice", "bob"]);
	});

	it("Shift+Left expands keyboard selection", () => {
		const f = fixture();
		act(() => f.ref.current.setState({ selectedKeys: ["bob"] }));
		fireEvent.keyDown(f.input(), { key: "ArrowLeft", shiftKey: true });
		expect(f.ref.current.state.selectedKeys).toEqual(["bob", "alice"]);
	});

	it("Escape clears completions", () => {
		const f = fixture({ onRequestCompletions: vi.fn(() => [cara]) });
		fireEvent.change(f.input(), { target: { value: "ca" } });
		fireEvent.keyDown(f.input(), { key: "Escape" });
		// completions clear via the debounced completion request; assert the request
		expect(f.props.onRequestCompletions).toHaveBeenCalledWith("", { clear: true });
	});

	it("prevents adding raw input at the token limit", () => {
		const f = fixture({ maxTokens: 2 });
		act(() => f.ref.current._addInputValue("cara"));
		expect(f.props.onAdd).not.toHaveBeenCalled();
	});
});

describe("Token editing, focus, paste, and actions", () => {
	it("enters token editing mode on double click", () => {
		fixture({ onEdit: vi.fn() });
		fireEvent.doubleClick(screen.getByText("Alice"));
		expect(screen.getByDisplayValue("Alice")).toBeDefined();
	});

	it("commits edited token text on blur", () => {
		const onEdit = vi.fn();
		fixture({ onEdit });
		fireEvent.doubleClick(screen.getByText("Alice"));
		const edit = screen.getByDisplayValue("Alice");
		fireEvent.change(edit, { target: { value: "Alicia" } });
		fireEvent.blur(edit);
		expect(onEdit).toHaveBeenCalledWith(alice, "Alicia");
	});

	it("does not edit when onEdit is absent", () => {
		fixture();
		fireEvent.doubleClick(screen.getByText("Alice"));
		expect(screen.queryByDisplayValue("Alice")).toBeNull();
	});

	it("reports edit motions even without text editing", () => {
		const onEditMotion = vi.fn();
		fixture({ onEditMotion });
		fireEvent.doubleClick(screen.getByText("Alice"));
		expect(onEditMotion).toHaveBeenCalledWith(alice);
	});

	it("adds an email-like paste immediately", () => {
		const f = fixture();
		fireEvent.paste(f.input(), { clipboardData: { getData: (type) => type === "text/plain" ? "cara@example.com" : "" } });
		expect(f.props.onAdd).toHaveBeenCalledWith("cara@example.com", { skipNameLookup: true });
	});

	it("adds serialized tokens from a drop", () => {
		const f = fixture();
		const wrap = f.container.querySelector(".tokenizing-field-wrap");
		fireEvent.drop(wrap, { dataTransfer: { types: ["nylas-token-items"], getData: () => JSON.stringify([cara]) } });
		expect(f.props.onAdd).toHaveBeenCalledWith([expect.objectContaining({ id: "cara" })]);
	});

	it("calls the supplied secondary token action", () => {
		const onTokenAction = vi.fn();
		fixture({ onTokenAction });
		fireEvent.click(screen.getAllByRole("button")[0]);
		expect(onTokenAction).toHaveBeenCalledWith(alice);
	});

	it("builds the default Remove action", () => {
		const f = fixture();
		// Exercise menu construction directly: the legacy click handler reads the
		// browser's global `event`, which jsdom intentionally does not guarantee.
		act(() => f.ref.current._showDefaultTokenMenu(alice));
		expect(m.menuItems.map((item) => item.label)).toEqual(["Remove"]);
		m.menuItems[0].click();
		expect(f.props.onRemove).toHaveBeenCalledWith([alice]);
	});

	it("calls onFocus and requests completions when focused", () => {
		const onFocus = vi.fn();
		const f = fixture({ onFocus });
		fireEvent.focus(f.input());
		expect(onFocus).toHaveBeenCalledOnce();
		expect(f.props.onRequestCompletions).toHaveBeenCalledWith("", { clear: undefined });
	});

	it("leaves app-blur input untouched when relatedTarget is absent", () => {
		const f = fixture();
		fireEvent.change(f.input(), { target: { value: "draft" } });
		fireEvent.blur(f.input(), { relatedTarget: null });
		expect(f.props.onAdd).not.toHaveBeenCalled();
		expect(f.input().value).toBe("draft");
	});
});
