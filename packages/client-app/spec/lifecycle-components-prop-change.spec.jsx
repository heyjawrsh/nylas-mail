// Prop-change behaviour of the kit components whose legacy lifecycles moved to
// getDerivedStateFromProps, getSnapshotBeforeUpdate or componentDidUpdate.
import React from "react";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/components/contenteditable/contenteditable.jsx", () => ({
	IgnoreMutationClassName: "ignore-mutations",
}));
vi.mock("../src/components/retina-img.jsx", () => ({
	default: Object.assign(() => <i />, { Mode: { ContentPreserve: "preserve" } }),
}));

const { default: OverlaidComponents } = await import(
	"../src/components/overlaid-components/overlaid-components.jsx"
);
const { default: Menu } = await import("../src/components/menu.jsx");
const { default: Spinner } = await import("../src/components/spinner.jsx");
const { default: TimePicker } = await import("../src/components/time-picker.jsx");
const { default: LinkEditor } = await import("../src/components/contenteditable/link-editor.jsx");
const { default: FloatingToolbar } = await import(
	"../src/components/contenteditable/floating-toolbar.jsx"
);
const { default: Webview } = await import("../src/components/webview.jsx");
const { default: ScrollRegion } = await import("../src/components/scroll-region.jsx");
const { DOMUtils } = await import("nylas-exports");

afterEach(() => {
	cleanup();
	vi.useRealTimers();
});

describe("OverlaidComponents observer teardown", () => {
	it("disconnects its observers before the update reaches the DOM", () => {
		const seen = [];
		const disconnect = vi
			.spyOn(MutationObserver.prototype, "disconnect")
			.mockImplementation(function () {
				seen.push(document.querySelector(".probe")?.textContent);
			});
		const view = render(
			<OverlaidComponents>
				<div className="probe">old</div>
			</OverlaidComponents>,
		);
		seen.length = 0;
		view.rerender(
			<OverlaidComponents>
				<div className="probe">new</div>
			</OverlaidComponents>,
		);
		// The first disconnects (teardown) see the old DOM; reconnecting in
		// componentDidUpdate then disconnects again against the new DOM.
		expect(seen[0]).toBe("old");
		expect(seen.at(-1)).toBe("new");
		disconnect.mockRestore();
	});
});

describe("Menu selection across new items", () => {
	const item = (id) => ({ id });
	const menu = (items, extra = {}) => (
		<Menu
			items={items}
			itemKey={(i) => i.id}
			itemContent={(i) => <span className="label">{i.id}</span>}
			onSelect={() => {}}
			{...extra}
		/>
	);
	const selected = (container) => container.querySelector(".selected .label")?.textContent;

	it("keeps the selected item by key, on the same render as the new items", () => {
		const seen = [];
		const didUpdate = Menu.prototype.componentDidUpdate;
		// Spied before mount: Menu binds its lifecycles in the constructor.
		const spy = vi.spyOn(Menu.prototype, "componentDidUpdate").mockImplementation(function (...args) {
			seen.push(selected(this._rootRef.current));
			return didUpdate.apply(this, args);
		});
		const view = render(menu([item("a"), item("b")], { defaultSelectedIndex: 1 }));
		expect(selected(view.container)).toBe("b");
		view.rerender(menu([item("x"), item("y"), item("b")], { defaultSelectedIndex: 1 }));
		expect(selected(view.container)).toBe("b");
		// Every commit had "b" selected, so componentDidUpdate never scrolled
		// to a stale row.
		expect(seen).toEqual(["b"]);
		spy.mockRestore();
	});

	it("keeps a hovered selection through an unrelated re-render", () => {
		const items = [item("a"), item("b")];
		const view = render(menu(items));
		fireEvent.mouseDown(view.container.querySelectorAll(".label")[1]);
		expect(selected(view.container)).toBe("b");
		view.rerender(menu(items));
		expect(selected(view.container)).toBe("b");
	});
});

describe("Spinner on a visible change", () => {
	it("shows after its delay when visible turns on, and hides when it turns off", () => {
		vi.useFakeTimers();
		const view = render(<Spinner visible={false} />);
		const spinner = () => view.container.querySelector(".spinner");
		expect(spinner().classList.contains("hidden")).toBe(true);
		view.rerender(<Spinner visible />);
		act(() => vi.advanceTimersByTime(300));
		expect(spinner().classList.contains("hidden")).toBe(false);
		view.rerender(<Spinner visible={false} />);
		expect(spinner().classList.contains("hidden")).toBe(true);
	});

	it("doesn't restart its show timer on an unrelated re-render", () => {
		vi.useFakeTimers();
		const view = render(<Spinner visible={false} />);
		view.rerender(<Spinner visible />);
		act(() => vi.advanceTimersByTime(200));
		view.rerender(<Spinner visible style={{ top: 1 }} />);
		act(() => vi.advanceTimersByTime(100));
		expect(view.container.querySelector(".spinner").classList.contains("hidden")).toBe(false);
	});
});

describe("TimePicker local text", () => {
	const noon = new Date(2026, 0, 1, 12, 0).valueOf();
	const one = new Date(2026, 0, 1, 13, 0).valueOf();

	it("keeps text being typed through an unrelated re-render", () => {
		const view = render(<TimePicker value={noon} />);
		const input = view.container.querySelector("input");
		fireEvent.change(input, { target: { value: "3p" } });
		view.rerender(<TimePicker value={noon} onChange={() => {}} />);
		expect(input.value).toBe("3p");
	});

	it("re-derives the text when the value changes", () => {
		const view = render(<TimePicker value={noon} />);
		const input = view.container.querySelector("input");
		fireEvent.change(input, { target: { value: "3p" } });
		view.rerender(<TimePicker value={one} />);
		expect(input.value).toBe("1:00 PM");
	});
});

describe("LinkEditor url field", () => {
	const linkTo = (href) => {
		const a = document.createElement("a");
		a.setAttribute("href", href);
		return a;
	};
	const editor = (link, extra = {}) => (
		<LinkEditor onSaveUrl={() => {}} onDoneWithLink={() => {}} linkToModify={link} {...extra} />
	);

	it("keeps a url being typed through an unrelated re-render", () => {
		const link = linkTo("https://a.test");
		const view = render(editor(link));
		const input = view.container.querySelector("input");
		fireEvent.change(input, { target: { value: "https://typed.test" } });
		view.rerender(editor(link, { focusOnMount: false }));
		expect(input.value).toBe("https://typed.test");
	});

	it("shows the new link's url when the link changes", () => {
		const view = render(editor(linkTo("https://a.test")));
		const input = view.container.querySelector("input");
		fireEvent.change(input, { target: { value: "https://typed.test" } });
		view.rerender(editor(linkTo("https://b.test")));
		expect(input.value).toBe("https://b.test");
	});
});

describe("FloatingToolbar on new props", () => {
	it("re-measures the toolbar on a deep-equal re-render, as before", () => {
		const anchor = document.createElement("span");
		let left = 100;
		anchor.getBoundingClientRect = () => ({ left, top: 50, width: 10, height: 10, bottom: 60, right: left + 10 });
		const editableNode = document.createElement("div");
		editableNode.getBoundingClientRect = () => ({ left: 0, top: 0, width: 400, height: 300, bottom: 300, right: 400 });
		const Tool = () => <div className="tool" />;
		const extension = {
			toolbarComponentConfig: () => ({ component: Tool, locationRefNode: anchor, width: 40, height: 20 }),
		};
		const ref = React.createRef();
		const view = render(<FloatingToolbar ref={ref} extensions={[extension]} atomicEdit={() => {}} />);
		act(() => ref.current.componentWillReceiveInnerProps({ editableNode }));
		const before = ref.current.state.toolbarLeft;
		left = 200;
		// A new (but deep-equal) extensions array, like Contenteditable passes.
		view.rerender(<FloatingToolbar ref={ref} extensions={[extension]} atomicEdit={() => {}} />);
		expect(ref.current.state.toolbarLeft).not.toBe(before);
		expect(ref.current.innerProps.extensions[0]).toBe(extension);
	});
});

describe("Webview on a new src", () => {
	it("resets its loading state and points the webview at the new src", () => {
		const ref = React.createRef();
		const view = render(<Webview ref={ref} src="https://a.test/" />);
		const webview = view.container.querySelector("webview");
		expect(webview.src).toBe("https://a.test/");
		act(() => ref.current.setState({ ready: true, error: "x" }));
		view.rerender(<Webview ref={ref} src="https://b.test/" />);
		expect(webview.src).toBe("https://b.test/");
		expect(ref.current.state).toMatchObject({ ready: false, error: null, webviewLoading: true });
	});

	it("leaves the webview alone on an unrelated re-render", () => {
		const ref = React.createRef();
		const view = render(<Webview ref={ref} src="https://a.test/" />);
		act(() => ref.current.setState({ ready: true }));
		view.rerender(<Webview ref={ref} src="https://a.test/" onDidFinishLoad={() => {}} />);
		expect(ref.current.state.ready).toBe(true);
	});
});

describe("ScrollRegion scrollbar cache", () => {
	it("rebuilds the scrollbar when its tooltip component changes, and only then", () => {
		const TipA = () => null;
		const TipB = () => null;
		const ref = React.createRef();
		const view = render(<ScrollRegion ref={ref} scrollTooltipComponent={TipA}><div /></ScrollRegion>);
		const first = ref.current._scrollbarComponent;
		view.rerender(<ScrollRegion ref={ref} scrollTooltipComponent={TipA}><div /></ScrollRegion>);
		expect(ref.current._scrollbarComponent).toBe(first);
		view.rerender(<ScrollRegion ref={ref} scrollTooltipComponent={TipB}><div /></ScrollRegion>);
		expect(ref.current._scrollbarComponent).not.toBe(first);
		expect(ref.current._scrollbarComponent.props.scrollTooltipComponent).toBe(TipB);
	});
});
