import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("nylas-exports", () => ({
	Utils: {
		fastOmit: (object, keys) =>
			Object.fromEntries(
				Object.entries(object || {}).filter(([key]) => !keys.includes(key)),
			),
		isEqualReact: (left, right) => JSON.stringify(left) === JSON.stringify(right),
	},
}));

vi.mock("../src/components/swipe-container.jsx", () => ({
	default: ({ children, onClick, style, ...props }) => (
		<div data-testid="swipe-container" onClick={onClick} style={style} {...props}>
			{children}
		</div>
	),
}));

import ListTabularItem from "../src/components/list-tabular-item.jsx";
import TableDataSource from "../src/components/table/table-data-source.js";

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
	vi.useRealTimers();
});

const records = [
	{ id: "m3", sender: { name: "Zoe" }, subject: "Roadmap", unread: false, receivedAt: 30 },
	{ id: "m1", sender: { name: "Ada" }, subject: "Alpha", unread: true, receivedAt: 10 },
	{ id: "m2", sender: null, subject: "Budget", unread: true, receivedAt: 20 },
];

const columns = [
	{ name: "Sender", flex: 2, resolver: (item) => item.sender?.name || "Unknown" },
	{ name: "Subject", width: 240, resolver: (item) => item.subject },
	{ name: "Status", flex: 1, resolver: (item) => (item.unread ? "Unread" : "Read") },
];

const buildSource = (items, definitions = columns) =>
	new TableDataSource({
		columns: definitions.map(({ name }) => name),
		rows: items.map((item) => definitions.map(({ resolver }) => resolver(item))),
	});

describe("column resolvers building table rows", () => {
	it("builds headers from column names", () => {
		expect(buildSource(records).columns()).toEqual(["Sender", "Subject", "Status"]);
	});

	it("builds each row in declared column order", () => {
		expect(buildSource(records).rowAt(0)).toEqual(["Zoe", "Roadmap", "Read"]);
	});

	it("resolves nested values with a fallback", () => {
		expect(buildSource(records).cellAt({ rowIdx: 2, colIdx: 0 })).toBe("Unknown");
	});

	it("resolves derived boolean labels", () => {
		expect(buildSource(records).rows().map((row) => row[2])).toEqual([
			"Read",
			"Unread",
			"Unread",
		]);
	});

	it("keeps the input row order", () => {
		// TableDataSource does not sort implicitly; row builders own ordering.
		expect(buildSource(records).rows().map((row) => row[1])).toEqual([
			"Roadmap",
			"Alpha",
			"Budget",
		]);
	});

	it("represents an upstream ascending sort exactly", () => {
		const sorted = [...records].sort((a, b) => a.subject.localeCompare(b.subject));
		expect(buildSource(sorted).rows().map((row) => row[1])).toEqual([
			"Alpha",
			"Budget",
			"Roadmap",
		]);
	});

	it("represents an upstream descending numeric sort exactly", () => {
		const dateColumn = [{ name: "Received", resolver: (item) => item.receivedAt }];
		const sorted = [...records].sort((a, b) => b.receivedAt - a.receivedAt);
		expect(buildSource(sorted, dateColumn).rows()).toEqual([[30], [20], [10]]);
	});

	it("filters built rows using resolved cell values", () => {
		const unread = buildSource(records).filterRows((row) => row[2] === "Unread");
		expect(unread.rows()).toEqual([
			["Ada", "Alpha", "Unread"],
			["Unknown", "Budget", "Unread"],
		]);
	});

	it("preserves headers when all rows are filtered out", () => {
		const empty = buildSource(records).filterRows(() => false);
		expect(empty.columns()).toEqual(["Sender", "Subject", "Status"]);
		expect(empty.rows()).toEqual([]);
	});

	it("does not mutate the source while filtering", () => {
		const source = buildSource(records);
		const filtered = source.filterRows((row) => row[0] !== "Zoe");
		expect(filtered).not.toBe(source);
		expect(source.rows()).toHaveLength(3);
	});

	it("retains row references selected by filtering", () => {
		const source = buildSource(records);
		const filtered = source.filterRows((row) => row[2] === "Unread");
		expect(filtered.rowAt(0)).toBe(source.rowAt(1));
	});

	it("allows sorting and filtering to be composed by the caller", () => {
		const sorted = [...records].sort((a, b) => a.subject.localeCompare(b.subject));
		const result = buildSource(sorted).filterRows((row) => row[2] === "Unread");
		expect(result.rows().map((row) => row[1])).toEqual(["Alpha", "Budget"]);
	});
});

const itemProps = (overrides = {}) => ({
	metrics: { top: 80, height: 40 },
	columns,
	item: records[1],
	...overrides,
});

describe("ListTabularItem column resolution", () => {
	it("renders every resolved column", () => {
		render(<ListTabularItem {...itemProps()} />);
		expect(screen.getByText("Ada")).toBeDefined();
		expect(screen.getByText("Alpha")).toBeDefined();
		expect(screen.getByText("Unread")).toBeDefined();
	});

	it("applies stable column-name classes", () => {
		const { container } = render(<ListTabularItem {...itemProps()} />);
		expect(container.querySelector(".list-column-Sender").textContent).toBe("Ada");
	});

	it("passes the item and component instance to a resolver", () => {
		const resolver = vi.fn(() => "value");
		const component = new ListTabularItem(itemProps({
			columns: [{ name: "Only", resolver }],
		}));
		component._columns();
		expect(resolver).toHaveBeenCalledWith(records[1], component);
	});

	it("applies flex and width independently", () => {
		const { container } = render(<ListTabularItem {...itemProps()} />);
		expect(container.querySelector(".list-column-Sender").style.flex).toBe("2 1 0%");
		expect(container.querySelector(".list-column-Subject").style.width).toBe("240px");
	});

	it("positions the swipe wrapper from row metrics", () => {
		render(<ListTabularItem {...itemProps()} />);
		const wrapper = screen.getByTestId("swipe-container");
		expect(wrapper.style.top).toBe("80px");
		expect(wrapper.style.height).toBe("40px");
		expect(wrapper.style.width).toBe("100%");
	});

	it("forwards item props except className to the wrapper", () => {
		render(
			<ListTabularItem
				{...itemProps({
					itemProps: {
						className: "selected",
						title: "row",
						"data-row": "m1",
					},
				})}
			/>,
		);
		const wrapper = screen.getByTestId("swipe-container");
		expect(wrapper.title).toBe("row");
		expect(wrapper.dataset.row).toBe("m1");
		expect(wrapper.className).not.toContain("selected");
	});

	it("adds itemProps className to the inner row", () => {
		const { container } = render(
			<ListTabularItem
				{...itemProps({ itemProps: { className: "selected" } })}
			/>,
		);
		expect(
			container.querySelector(".list-tabular-item").classList.contains("selected"),
		).toBe(true);
	});

	it("warns when column names are duplicated", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const duplicate = { name: "Subject", resolver: (item) => item.subject };
		new ListTabularItem(itemProps({ columns: [duplicate, duplicate] }))._columns();
		expect(warn).toHaveBeenCalledWith(expect.stringContaining("`Subject` twice"));
	});

	it("reuses resolved columns across renders", () => {
		const resolver = vi.fn(() => "cached");
		const component = new ListTabularItem(itemProps({ columns: [{ name: "One", resolver }] }));
		component.render();
		component.render();
		expect(resolver).toHaveBeenCalledTimes(1);
	});

	it("invalidates the column cache when the item changes", () => {
		const component = new ListTabularItem(itemProps());
		component._columnCache = ["cached"];
		expect(component.shouldComponentUpdate(itemProps({ item: records[0] }))).toBe(true);
		expect(component._columnCache).toBeNull();
	});

	it("invalidates the cache when the columns array identity changes", () => {
		const component = new ListTabularItem(itemProps());
		component._columnCache = ["cached"];
		expect(component.shouldComponentUpdate(itemProps({ columns: [...columns] }))).toBe(true);
		expect(component._columnCache).toBeNull();
	});

	it("skips an update for deeply equal props", () => {
		const props = itemProps({ itemProps: { className: "selected" } });
		const component = new ListTabularItem(props);
		expect(component.shouldComponentUpdate({ ...props, item: { ...props.item } })).toBe(false);
	});

	it("updates for changed non-item props without clearing cached columns", () => {
		const component = new ListTabularItem(itemProps());
		component._columnCache = ["cached"];
		expect(
			component.shouldComponentUpdate(
				itemProps({ metrics: { top: 120, height: 40 } }),
			),
		).toBe(true);
		expect(component._columnCache).toEqual(["cached"]);
	});

	it("calls selection before the click callback", () => {
		const calls = [];
		render(<ListTabularItem {...itemProps({
			onSelect: () => calls.push("select"),
			onClick: () => calls.push("click"),
		})} />);
		fireEvent.click(screen.getByTestId("swipe-container"));
		expect(calls).toEqual(["select", "click"]);
	});

	it("passes the item and event to click callbacks", () => {
		const onSelect = vi.fn();
		const onClick = vi.fn();
		render(<ListTabularItem {...itemProps({ onSelect, onClick })} />);
		fireEvent.click(screen.getByTestId("swipe-container"));
		expect(onSelect.mock.calls[0][0]).toBe(records[1]);
		expect(onSelect.mock.calls[0][1].nativeEvent).toBeInstanceOf(MouseEvent);
		expect(onClick.mock.calls[0][0]).toBe(records[1]);
	});

	it("fires double-click behavior for two clicks within 350ms", () => {
		vi.useFakeTimers();
		vi.setSystemTime(1_000);
		const onDoubleClick = vi.fn();
		render(<ListTabularItem {...itemProps({ onDoubleClick })} />);
		fireEvent.click(screen.getByTestId("swipe-container"));
		vi.setSystemTime(1_349);
		fireEvent.click(screen.getByTestId("swipe-container"));
		expect(onDoubleClick).toHaveBeenCalledTimes(1);
		expect(onDoubleClick.mock.calls[0][0]).toBe(records[1]);
	});

	it("does not double-click at the exact 350ms boundary", () => {
		vi.useFakeTimers();
		vi.setSystemTime(2_000);
		const onDoubleClick = vi.fn();
		render(<ListTabularItem {...itemProps({ onDoubleClick })} />);
		fireEvent.click(screen.getByTestId("swipe-container"));
		vi.setSystemTime(2_350);
		fireEvent.click(screen.getByTestId("swipe-container"));
		expect(onDoubleClick).not.toHaveBeenCalled();
	});
});
