import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";

const registry = vi.hoisted(() => ({
	components: [],
	visible: false,
	listener: null,
	unlisten: vi.fn(),
	findComponentsMatching: vi.fn((matching) => registry.components),
	showComponentRegions: vi.fn(() => registry.visible),
	listen: vi.fn((listener) => {
		registry.listener = listener;
		return registry.unlisten;
	}),
}));

vi.mock("nylas-exports", () => ({
	default: {
		Actions: {},
		WorkspaceStore: {},
		ComponentRegistry: registry,
	},
	Actions: {},
	WorkspaceStore: {},
	ComponentRegistry: registry,
}));

vi.mock("../src/components/unsafe-component.jsx", () => ({
	// A plain function (not an arrow) so it has a prototype for instanceof.
	default: function UnsafeComponent({ component: Component, onComponentDidRender, ...props }) {
		React.useEffect(() => onComponentDidRender(), [onComponentDidRender]);
		return <Component {...props} />;
	},
}));

import InjectedComponent from "../src/components/injected-component.jsx";
import InjectedComponentLabel from "../src/components/injected-component-label.jsx";
import UnsafeComponent from "../src/components/unsafe-component.jsx";

// injected-component.jsx is CommonJS; Vitest's default interop is the supported surface here.

afterEach(cleanup);

beforeEach(() => {
	registry.components = [];
	registry.visible = false;
	registry.listener = null;
	vi.clearAllMocks();
});

function Fixture({ message, fallback }) {
	return <button data-fallback={String(Boolean(fallback))}>{message}</button>;
}
Fixture.displayName = "Fixture";
Fixture.containerRequired = false;

describe("InjectedComponent", () => {
	it("renders an empty div when the registry has no match", () => {
		const { container } = render(<InjectedComponent matching={{ role: "composer" }} />);
		expect(container.firstChild.tagName).toBe("DIV");
		expect(container.firstChild.childNodes).toHaveLength(0);
	});

	it("asks the registry for the supplied descriptor", () => {
		const matching = { role: "composer", mode: "inline" };
		render(<InjectedComponent matching={matching} />);
		expect(registry.findComponentsMatching).toHaveBeenCalledWith(matching);
	});

	it("renders the first matching component with exposed props", () => {
		registry.components = [Fixture];
		render(
			<InjectedComponent matching={{ role: "composer" }} exposedProps={{ message: "Hello" }} />,
		);
		expect(screen.getByRole("button", { name: "Hello" })).toBeDefined();
	});

	it("passes fallback through even when a registry component wins", () => {
		registry.components = [Fixture];
		render(
			<InjectedComponent matching={{ role: "composer" }} fallback={Fixture} exposedProps={{ message: "Hi" }} />,
		);
		expect(screen.getByRole("button").getAttribute("data-fallback")).toBe("true");
	});

	it("renders the fallback when the registry has no matches", () => {
		render(
			<InjectedComponent matching={{ role: "missing" }} fallback={Fixture} exposedProps={{ message: "Fallback" }} />,
		);
		expect(screen.getByText("Fallback")).toBeDefined();
	});

	it("warns and renders only the first of multiple matches", () => {
		const Other = () => <div>Other</div>;
		Other.containerRequired = false;
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		registry.components = [Fixture, Other];
		render(<InjectedComponent matching={{ role: "many" }} exposedProps={{ message: "First" }} />);
		expect(screen.getByText("First")).toBeDefined();
		expect(screen.queryByText("Other")).toBeNull();
		expect(warn).toHaveBeenCalledOnce();
		warn.mockRestore();
	});

	it("subscribes on mount and unsubscribes on unmount", () => {
		const view = render(<InjectedComponent matching={{ role: "composer" }} />);
		expect(registry.listen).toHaveBeenCalledOnce();
		view.unmount();
		expect(registry.unlisten).toHaveBeenCalledOnce();
	});

	it("refreshes from the registry when its listener fires", () => {
		const view = render(<InjectedComponent matching={{ role: "composer" }} />);
		registry.components = [Fixture];
		act(() => registry.listener());
		expect(view.getByRole("button")).toBeDefined();
	});

	it("refreshes when the matching descriptor changes", () => {
		const view = render(<InjectedComponent matching={{ role: "one" }} />);
		registry.components = [Fixture];
		view.rerender(
			<InjectedComponent matching={{ role: "two" }} exposedProps={{ message: "Changed" }} />,
		);
		expect(screen.getByText("Changed")).toBeDefined();
	});

	it("does not query again for a deeply equal matching descriptor", () => {
		const view = render(<InjectedComponent matching={{ role: "same" }} />);
		registry.findComponentsMatching.mockClear();
		view.rerender(<InjectedComponent matching={{ role: "same" }} />);
		expect(registry.findComponentsMatching).not.toHaveBeenCalled();
	});

	it("calls render and change callbacks for an uncontained component", () => {
		registry.components = [Fixture];
		const onComponentDidRender = vi.fn();
		const onComponentDidChange = vi.fn();
		render(
			<InjectedComponent
				matching={{ role: "composer" }}
				exposedProps={{ message: "Ready" }}
				onComponentDidRender={onComponentDidRender}
				onComponentDidChange={onComponentDidChange}
			/>,
		);
		expect(onComponentDidRender).toHaveBeenCalledOnce();
		expect(onComponentDidChange).toHaveBeenCalledOnce();
	});

	it("shows registry diagnostics when component regions are visible", () => {
		registry.components = [Fixture];
		registry.visible = true;
		const { container } = render(
			<InjectedComponent
				matching={{ role: "composer" }}
				className="custom"
				style={{ color: "red" }}
				exposedProps={{ message: "Visible" }}
			/>,
		);
		expect(container.firstChild.classList.contains("custom")).toBe(true);
		expect(container.firstChild.classList.contains("registered-region-visible")).toBe(true);
		expect(container.firstChild.style.color).toBe("red");
		expect(container.querySelector(".name").textContent).toContain("role: composer");
	});

	it("throws when a required method is absent from the matched class", () => {
		class MissingMethod extends React.Component {
			render() { return <div />; }
		}
		MissingMethod.containerRequired = false;
		registry.components = [MissingMethod];
		expect(() =>
			render(<InjectedComponent matching={{ role: "strict" }} requiredMethods={["archive"]} />),
		).toThrow(/must implement method `archive`/);
	});
});

describe("InjectedComponent DOM methods", () => {
	const withUnsafeInner = (inner) => {
		let injected;
		render(
			<InjectedComponent
				ref={(value) => {
					injected = value;
				}}
				matching={{ role: "composer" }}
			/>,
		);
		injected.innerRef = {
			current: Object.assign(Object.create(UnsafeComponent.prototype), inner),
		};
		return injected;
	};

	it.each(["focus", "blur"])(
		"%s falls back to the UnsafeComponent when it has no injected instance",
		(method) => {
			const inner = { injected: null, [method]: vi.fn() };
			const injected = withUnsafeInner(inner);
			expect(() => injected[method]()).not.toThrow();
			expect(inner[method]).toHaveBeenCalledOnce();
		},
	);

	it("prefers the injected instance's method when there is one", () => {
		const inner = { injected: { focus: vi.fn() }, focus: vi.fn() };
		withUnsafeInner(inner).focus();
		expect(inner.injected.focus).toHaveBeenCalledOnce();
		expect(inner.focus).not.toHaveBeenCalled();
	});
});

describe("InjectedComponentLabel", () => {
	it("preserves matching key order in its description", () => {
		render(<InjectedComponentLabel matching={{ role: "toolbar", mode: "compact" }} />);
		expect(screen.getByText("role: toolbar, mode: compact", { exact: false })).toBeDefined();
	});

	it("renders location arrays as comma-separated ids", () => {
		render(<InjectedComponentLabel matching={{ locations: [{ id: "one" }, { id: "two" }] }} />);
		expect(screen.getByText(/locations: one,two/)).toBeDefined();
	});

	it("omits the prop suffix when matching is the only prop", () => {
		const { container } = render(<InjectedComponentLabel matching={{ role: "toolbar" }} />);
		expect(container.querySelector(".name").textContent).toBe(" role: toolbar");
	});

	it("describes extra values using their constructor names", () => {
		render(<InjectedComponentLabel matching={{}} items={[]} callback={() => {}} />);
		const label = screen.getByText(/items:<Array>/);
		expect(label.textContent).toContain("callback:<Function>");
	});
});
