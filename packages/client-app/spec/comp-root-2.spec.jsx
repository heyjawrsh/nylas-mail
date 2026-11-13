import React from "react";
import { describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(cleanup);

import InjectedComponentLabel from "../src/components/injected-component-label.jsx";
import Menu from "../src/components/menu.jsx";


const fixtures = [
	{ id: "alpha", name: "Alpha", count: 2 },
	{ id: "beta", name: "Beta", count: 5 },
];



describe("Menu", () => {
	const items = [{ id: "a", label: "Alpha" }, { id: "b", label: "Beta" }];
	const menuProps = (overrides = {}) => ({
		items,
		itemKey: (item) => item.id,
		itemContent: (item) => item.label,
		onSelect: vi.fn(),
		...overrides,
	});

	it("renders header, items, and footer", () => {
		render(<Menu {...menuProps({ headerComponents: "Header", footerComponents: "Footer" })} />);
		expect(screen.getByText("Header")).toBeDefined();
		expect(screen.getByText("Alpha")).toBeDefined();
		expect(screen.getByText("Footer")).toBeDefined();
	});

	it("selects the configured default item", () => {
		const { container } = render(<Menu {...menuProps({ defaultSelectedIndex: 1 })} />);
		expect(container.querySelector(".selected").textContent).toBe("Beta");
	});

	it("marks checked items", () => {
		const { container } = render(
			<Menu {...menuProps({ itemChecked: (item) => item.id === "b" })} />,
		);
		expect(container.querySelector(".checked").textContent).toBe("Beta");
	});



	it("selects the current item with Enter", () => {
		const onSelect = vi.fn();
		const { container } = render(<Menu {...menuProps({ onSelect })} />);
		fireEvent.keyDown(container.firstChild, { key: "Enter" });
		expect(onSelect).toHaveBeenCalledWith(items[0]);
	});

	it("calls onEscape for Escape", () => {
		const onEscape = vi.fn();
		const { container } = render(<Menu {...menuProps({ onEscape })} />);
		fireEvent.keyDown(container.firstChild, { key: "Escape" });
		expect(onEscape).toHaveBeenCalledTimes(1);
	});

	it("renders labeled dividers", () => {
		render(<Menu.Item divider="Recent" />);
		expect(screen.getByText("Recent").className).toContain("divider");
	});

	it("renders names and email addresses", () => {
		render(<Menu.NameEmailItem name="Ada" email="ada@example.com" />);
		expect(screen.getByText("Ada")).toBeDefined();
		expect(screen.getByText("(ada@example.com)")).toBeDefined();
	});
});

describe("InjectedComponentLabel", () => {
	it("describes matching locations by id", () => {
		render(<InjectedComponentLabel matching={{ location: { id: "composer" } }} />);
		expect(screen.getByText(/location: composer/)).toBeDefined();
	});

	it("describes multiple matching locations", () => {
		render(
			<InjectedComponentLabel matching={{ locations: [{ id: "one" }, { id: "two" }] }} />,
		);
		expect(screen.getByText(/locations: one,two/)).toBeDefined();
	});

	it("includes the constructor names of additional props", () => {
		render(<InjectedComponentLabel matching={{ role: "toolbar" }} enabled count={3} />);
		expect(screen.getByText(/enabled:<Boolean>/)).toBeDefined();
		expect(screen.getByText(/count:<Number>/)).toBeDefined();
	});
});

