// React 19 has no way to look up a component's DOM node, so a component a
// parent measures hands its node over through getDOMNode(). These specs cover
// the parents that used to do that lookup themselves.
import React from "react";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { domNodeOf } from "../src/components/dom-node.js";
import ReactCSSTransitionGroup from "../src/components/css-transition-group-compat.jsx";
import ScrollRegion from "../src/components/scroll-region.jsx";
import Flexbox from "../src/components/flexbox.jsx";
import KeyCommandsRegion from "../src/components/key-commands-region.jsx";
import { TableRow } from "../src/components/table/table.jsx";
import { SelectableTableRow } from "../src/components/selectable-table.jsx";
import LazyRenderedList from "../src/components/lazy-rendered-list.jsx";

afterEach(cleanup);

class Panel extends React.Component {
	rootRef = React.createRef();
	getDOMNode() {
		return this.rootRef.current;
	}
	render() {
		return (
			<div ref={this.rootRef} className="panel">
				{this.props.label}
			</div>
		);
	}
}

class NoAccessor extends React.Component {
	render() {
		return <div className="no-accessor">{this.props.label}</div>;
	}
}

describe("domNodeOf", () => {
	it("returns a DOM node as-is", () => {
		const node = document.createElement("div");
		expect(domNodeOf(node)).toBe(node);
	});

	it("resolves a component instance through getDOMNode()", () => {
		const node = document.createElement("span");
		expect(domNodeOf({ getDOMNode: () => node })).toBe(node);
	});

	it("returns null for empty refs and instances without an accessor", () => {
		expect(domNodeOf(null)).toBeNull();
		expect(domNodeOf(undefined)).toBeNull();
		expect(domNodeOf({})).toBeNull();
		expect(domNodeOf({ getDOMNode: () => undefined })).toBeNull();
	});
});

describe("ReactCSSTransitionGroup children", () => {
	const group = (child) => (
		<ReactCSSTransitionGroup
			transitionName="fade"
			transitionAppear
			transitionAppearTimeout={50}
			transitionEnterTimeout={50}
			transitionLeaveTimeout={50}
		>
			{child}
		</ReactCSSTransitionGroup>
	);

	it("animates a component child through its getDOMNode()", () => {
		const { container } = render(group(<Panel key="a" label="A" />));
		expect(container.querySelector(".panel").className).toContain("fade-appear");
	});

	it("keeps the caller's own ref on a component child", () => {
		const ref = React.createRef();
		render(group(<Panel key="a" ref={ref} label="A" />));
		expect(ref.current).toBeInstanceOf(Panel);
	});

	it("keeps the caller's own ref on a DOM child", () => {
		const ref = React.createRef();
		const { container } = render(
			group(
				<div key="a" ref={ref} className="dom-child">
					A
				</div>,
			),
		);
		expect(ref.current).toBe(container.querySelector(".dom-child"));
		expect(ref.current.className).toContain("fade-appear");
	});

	it("renders a component child with no accessor without throwing", () => {
		const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
		const { container, rerender } = render(group(<NoAccessor key="a" label="A" />));
		rerender(group(<NoAccessor key="b" label="B" />));
		expect(container.querySelector(".no-accessor")).not.toBeNull();
		expect(consoleError).not.toHaveBeenCalled();
		consoleError.mockRestore();
	});

	it("keeps a leaving component child until its leave transition ends", () => {
		vi.useFakeTimers();
		const { container, rerender } = render(group(<Panel key="a" label="A" />));
		rerender(group(<Panel key="b" label="B" />));
		const panels = () => [...container.querySelectorAll(".panel")];
		const leaving = panels().find((n) => n.textContent === "A");
		expect(panels()).toHaveLength(2);
		expect(leaving.className).toContain("fade-exit");
		act(() => {
			vi.advanceTimersByTime(60);
		});
		expect(panels().map((n) => n.textContent)).toEqual(["B"]);
		vi.useRealTimers();
	});
});

describe("ScrollRegion", () => {
	it("hands over its root node", () => {
		const ref = React.createRef();
		const { container } = render(
			<ScrollRegion ref={ref} className="list">
				<div>content</div>
			</ScrollRegion>,
		);
		expect(ref.current.getDOMNode()).toBe(container.querySelector(".scroll-region"));
	});

	it("scrolls to a component through the component's getDOMNode()", () => {
		const region = React.createRef();
		const panel = React.createRef();
		render(
			<ScrollRegion ref={region}>
				<Panel ref={panel} label="row" />
			</ScrollRegion>,
		);
		const node = panel.current.getDOMNode();
		const rect = vi.spyOn(node, "getBoundingClientRect");
		region.current.scrollTo(panel.current);
		expect(rect).toHaveBeenCalled();
	});

	it("reads and writes scrollTop on its content node", () => {
		const ref = React.createRef();
		const { container } = render(
			<ScrollRegion ref={ref}>
				<div>content</div>
			</ScrollRegion>,
		);
		ref.current.scrollTop = 42;
		expect(container.querySelector(".scroll-region-content").scrollTop).toBe(42);
		expect(ref.current.scrollTop).toBe(42);
	});
});

describe("root node accessors", () => {
	it("Flexbox hands over its root div", () => {
		const ref = React.createRef();
		const { container } = render(<Flexbox ref={ref} className="box" />);
		expect(ref.current.getDOMNode()).toBe(container.querySelector(".box"));
	});

	it("KeyCommandsRegion hands over its root div and listens on it", () => {
		const ref = React.createRef();
		const onFocusIn = vi.fn();
		const { container } = render(
			<KeyCommandsRegion ref={ref} className="region" onFocusIn={onFocusIn}>
				<input />
			</KeyCommandsRegion>,
		);
		const root = container.querySelector(".region");
		expect(ref.current.getDOMNode()).toBe(root);
		act(() => {
			root.querySelector("input").focus();
		});
		expect(onFocusIn).toHaveBeenCalled();
	});

	it("SelectableTableRow reaches its <tr> through TableRow", () => {
		const tableDataSource = {
			columns: () => ["a"],
			cellAt: () => "cell",
			rowAt: () => ["cell"],
		};
		const ref = React.createRef();
		const { container } = render(
			<table>
				<tbody>
					<SelectableTableRow
						ref={ref}
						rowIdx={0}
						tableDataSource={tableDataSource}
						selection={{ rowIdx: 1, colIdx: 0 }}
						CellRenderer={({ children }) => <td>{children}</td>}
					/>
				</tbody>
			</table>,
		);
		expect(ref.current.getDOMNode()).toBe(container.querySelector("tr"));
		expect(TableRow.prototype.getDOMNode).toBeTypeOf("function");
	});

	it("LazyRenderedList reads scrollTop from its root element", () => {
		const ref = React.createRef();
		const { container } = render(
			<LazyRenderedList
				ref={ref}
				items={Array.from({ length: 50 }, (_v, i) => i)}
				itemHeight={10}
				containerHeight={50}
				RootRenderer="div"
				ItemRenderer={({ item }) => <div>{item}</div>}
			/>,
		);
		container.firstChild.scrollTop = 200;
		act(() => {
			ref.current.onScroll();
		});
		expect(ref.current.state.start).toBe(10);
	});
});
