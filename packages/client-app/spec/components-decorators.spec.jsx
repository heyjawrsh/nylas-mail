import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

afterEach(cleanup);

const mocks = vi.hoisted(() => ({
	findDOMNode: vi.fn(),
	closePopover: vi.fn(),
	openPopover: vi.fn(),
	workspaceListen: vi.fn(() => vi.fn()),
	topSheet: vi.fn(() => ({ id: "top-sheet" })),
	nodeIsVisible: vi.fn(() => true),
}));

vi.mock("react-dom", async (importOriginal) => ({
	...(await importOriginal()),
	findDOMNode: mocks.findDOMNode,
}));

vi.mock("nylas-exports", () => ({
	Actions: {
		closePopover: mocks.closePopover,
		openPopover: mocks.openPopover,
	},
	WorkspaceStore: {
		listen: mocks.workspaceListen,
		topSheet: mocks.topSheet,
	},
	DOMUtils: { nodeIsVisible: mocks.nodeIsVisible },
}));

vi.mock("nylas-store", () => ({
	default: class NylasStore {
		listeners = [];

		listen(callback) {
			this.listeners.push(callback);
			return () => {
				this.listeners = this.listeners.filter((listener) => listener !== callback);
			};
		}

		trigger() {
			this.listeners.forEach((listener) => listener());
		}
	},
}));

vi.mock("../src/components/key-commands-region.jsx", () => ({
	default: ({ children, localHandlers, ...props }) => (
		<div data-testid="key-region" data-handler-count={Object.keys(localHandlers).length} {...props}>
			{children}
		</div>
	),
}));

import AutoFocuses from "../src/components/decorators/auto-focuses.jsx";
import compose from "../src/components/decorators/compose.js";
import HasTutorialTip from "../src/components/decorators/has-tutorial-tip.jsx";
import ListensToFluxStore from "../src/components/decorators/listens-to-flux-store.jsx";
import ListensToMovementKeys from "../src/components/decorators/listens-to-movement-keys.jsx";
import ListensToObservable from "../src/components/decorators/listens-to-observable.jsx";

class FixtureComponent extends React.Component {
	static displayName = "FixtureComponent";
	static containerRequired = true;
	static containerStyles = { flex: 1 };
	static propTypes = {};

	render() {
		return <div data-testid="fixture">{this.props.label}</div>;
	}
}

describe("compose", () => {
	it("applies decorators from left to right", () => {
		const calls = [];
		const first = (Component) => { calls.push(["first", Component]); return class First extends Component {}; };
		const second = (Component) => { calls.push(["second", Component]); return class Second extends Component {}; };
		const Result = compose(FixtureComponent, first, second);
		expect(calls[0][1]).toBe(FixtureComponent);
		expect(calls[1][1]).not.toBe(FixtureComponent);
		expect(Result.prototype).toBeInstanceOf(calls[1][1]);
	});

});

describe("AutoFocuses", () => {
	beforeEach(() => mocks.findDOMNode.mockReset());

	it("injects its focus callback into the wrapped component", () => {
		const Decorated = AutoFocuses(FixtureComponent, { onMount: false });
		render(<Decorated label="hello" />);
		expect(screen.getByText("hello")).toBeDefined();
	});

	it("focuses the lowest positive tab index", () => {
		const root = document.createElement("div");
		root.focus = vi.fn();
		root.innerHTML = '<input data-testid="plain"><button tabindex="4">four</button><button tabindex="2">two</button>';
		document.body.appendChild(root);
		mocks.findDOMNode.mockReturnValue(root);
		const instance = new (AutoFocuses(FixtureComponent))({});
		instance.mounted = true;
		instance.focusElementWithTabIndex();
		expect(document.activeElement.textContent).toBe("two");
		root.remove();
	});

	it("does not move focus already inside the component", () => {
		const root = document.createElement("div");
		root.innerHTML = '<input data-testid="inside"><button tabindex="1">other</button>';
		document.body.appendChild(root);
		const input = root.querySelector("input");
		input.focus();
		mocks.findDOMNode.mockReturnValue(root);
		const instance = new (AutoFocuses(FixtureComponent))({});
		instance.mounted = true;
		instance.focusElementWithTabIndex();
		expect(document.activeElement).toBe(input);
		root.remove();
	});

	it("does nothing before mounting", () => {
		const instance = new (AutoFocuses(FixtureComponent))({});
		instance.focusElementWithTabIndex();
		expect(mocks.findDOMNode).not.toHaveBeenCalled();
	});

	it("honors disabled mount and update focusing", () => {
		const instance = new (AutoFocuses(FixtureComponent, { onMount: false, onUpdate: false }))({});
		instance.focusElementWithTabIndex = vi.fn();
		instance.componentDidMount();
		instance.componentDidUpdate();
		expect(instance.focusElementWithTabIndex).not.toHaveBeenCalled();
	});
});


describe("ListensToObservable", () => {
	it("renders initial observable-derived state", () => {
		const observable = { subscribe: vi.fn(() => ({ dispose: vi.fn() })) };
		const Decorated = ListensToObservable(FixtureComponent, {
			getObservable: () => observable,
			getStateFromObservable: () => ({ label: "initial" }),
		});
		render(<Decorated />);
		expect(screen.getByText("initial")).toBeDefined();
	});

	it("updates from observable emissions", () => {
		let emit;
		const observable = { subscribe: (callback) => { emit = callback; return { dispose: vi.fn() }; } };
		const Decorated = ListensToObservable(FixtureComponent, {
			getObservable: () => observable,
			getStateFromObservable: (data) => ({ label: data || "initial" }),
		});
		render(<Decorated />);
		React.act(() => emit("updated"));
		expect(screen.getByText("updated")).toBeDefined();
	});

	it("caller props override observable state", () => {
		const observable = { subscribe: () => ({ dispose: vi.fn() }) };
		const Decorated = ListensToObservable(FixtureComponent, {
			getObservable: () => observable,
			getStateFromObservable: () => ({ label: "observable" }),
		});
		// The render spread order intentionally gives explicit props precedence.
		render(<Decorated label="caller" />);
		expect(screen.getByText("caller")).toBeDefined();
	});

	it("switches subscriptions when props change", () => {
		const firstDispose = vi.fn();
		const second = { subscribe: vi.fn(() => ({ dispose: vi.fn() })) };
		const getObservable = vi.fn(({ source }) => source === "first"
			? { subscribe: () => ({ dispose: firstDispose }) }
			: second);
		const Decorated = ListensToObservable(FixtureComponent, {
			getObservable,
			getStateFromObservable: () => ({}),
		});
		const view = render(<Decorated source="first" />);
		view.rerender(<Decorated source="second" />);
		expect(firstDispose).toHaveBeenCalledOnce();
		expect(second.subscribe).toHaveBeenCalledOnce();
	});

	it("disposes its current subscription on unmount", () => {
		const dispose = vi.fn();
		const Decorated = ListensToObservable(FixtureComponent, {
			getObservable: () => ({ subscribe: () => ({ dispose }) }),
			getStateFromObservable: () => ({}),
		});
		const view = render(<Decorated />);
		view.unmount();
		expect(dispose).toHaveBeenCalledOnce();
	});
});

describe("ListensToMovementKeys", () => {
	const build = (handlers = {}) => {
		const instance = new (ListensToMovementKeys(FixtureComponent))({ label: "keys" });
		Object.defineProperty(instance, "refs", { value: { composed: handlers } });
		return instance;
	};

	it("wraps the component in a four-command key region", () => {
		const instance = build();
		const { localHandlers } = instance.render().props;
		expect(Object.keys(localHandlers)).toEqual([
			"core:previous-item", "core:next-item", "core:move-left", "core:move-right",
		]);
	});

	it("routes previous and next commands", () => {
		const onArrowUp = vi.fn();
		const onArrowDown = vi.fn();
		const instance = build({ onArrowUp, onArrowDown });
		const event = { stopPropagation: vi.fn() };
		instance.localKeyHandlers()["core:previous-item"](event);
		instance.localKeyHandlers()["core:next-item"](event);
		expect(onArrowUp).toHaveBeenCalledWith(event);
		expect(onArrowDown).toHaveBeenCalledWith(event);
	});

	it("requires the down handler before routing left and right", () => {
		const onArrowLeft = vi.fn();
		const onArrowRight = vi.fn();
		const instance = build({ onArrowLeft, onArrowRight });
		const event = { stopPropagation: vi.fn() };
		// The source guards both horizontal commands with onArrowDown, despite
		// invoking the horizontal handlers afterward.
		instance.localKeyHandlers()["core:move-left"](event);
		instance.localKeyHandlers()["core:move-right"](event);
		expect(onArrowLeft).not.toHaveBeenCalled();
		expect(onArrowRight).not.toHaveBeenCalled();
	});

	it("routes Enter and stops propagation", () => {
		const onEnter = vi.fn();
		const instance = build({ onEnter });
		const event = { key: "Enter", stopPropagation: vi.fn(), preventDefault: vi.fn() };
		instance.onKeyDown(event);
		expect(onEnter).toHaveBeenCalledWith(event);
		expect(event.stopPropagation).toHaveBeenCalledOnce();
	});

	it("routes Tab and prevents its browser default", () => {
		const onTab = vi.fn();
		const instance = build({ onTab });
		const event = { key: "Tab", shiftKey: false, stopPropagation: vi.fn(), preventDefault: vi.fn() };
		instance.onKeyDown(event);
		expect(onTab).toHaveBeenCalledWith(event);
		expect(event.preventDefault).toHaveBeenCalledOnce();
	});

	it("routes Shift-Tab separately", () => {
		const onShiftTab = vi.fn();
		const instance = build({ onShiftTab });
		const event = { key: "Tab", shiftKey: true, stopPropagation: vi.fn(), preventDefault: vi.fn() };
		instance.onKeyDown(event);
		expect(onShiftTab).toHaveBeenCalledWith(event);
	});

	it("does not consume commands without a handler", () => {
		const instance = build();
		const event = { key: "Enter", stopPropagation: vi.fn(), preventDefault: vi.fn() };
		instance.onKeyDown(event);
		instance.localKeyHandlers()["core:previous-item"](event);
		expect(event.stopPropagation).not.toHaveBeenCalled();
	});

});

describe("HasTutorialTip", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		NylasEnv.config.get.mockReturnValue([]);
		NylasEnv.config.pushAtKeyPath = vi.fn();
		NylasEnv.themes = { onDidChangeActiveThemes: vi.fn(() => ({ dispose: vi.fn() })) };
		window.requestAnimationFrame = vi.fn((callback) => { callback(); return 1; });
	});

	it("requires a display name", () => {
		expect(() => HasTutorialTip(() => <div />, {})).toThrow("must have a displayName");
	});

	it("returns the original component when its tip was seen", () => {
		NylasEnv.config.get.mockReturnValue(["FixtureComponent"]);
		expect(HasTutorialTip(FixtureComponent, {})).toBe(FixtureComponent);
	});



});
