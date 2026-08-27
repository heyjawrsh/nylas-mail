import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

afterEach(cleanup);

vi.mock("../src/components/menu.jsx", () => {
	function Item({ divider }) {
		return <div data-testid="divider">{divider}</div>;
	}
	function Menu({ className, headerComponents, items = [], itemContent, onSelect }) {
		return (
			<div className={className}>
				{headerComponents}
				{items.map((item, index) => (
					<button key={index} type="button" onClick={() => onSelect?.(item)}>
						{itemContent(item)}
					</button>
				))}
			</div>
		);
	}
	Menu.Item = Item;
	return { default: Menu };
});

vi.mock("../src/components/retina-img.jsx", () => {
	function RetinaImg({ name, mode: _mode, ...props }) {
		return <button type="button" data-image-name={name} {...props} />;
	}
	RetinaImg.Mode = { ContentDark: "dark", ContentPreserve: "preserve" };
	return { default: RetinaImg };
});

vi.mock("../src/components/key-commands-region.jsx", () => ({
	default: ({ children, globalHandlers: _globalHandlers, ...props }) => (
		<section {...props}>{children}</section>
	),
}));

import SearchBar from "../src/components/search-bar.jsx";

const requiredCallbacks = () => ({
	onClearSearchQuery: vi.fn(),
	onClearSearchSuggestions: vi.fn(),
	onSearchQueryChanged: vi.fn(),
	onSelectSuggestion: vi.fn(),
});

describe("SearchBar", () => {
	it("renders its default placeholder and empty input class", () => {
		render(<SearchBar {...requiredCallbacks()} />);
		const input = screen.getByPlaceholderText("Search");
		expect(input.className).toContain("empty");
		expect(input.value).toBe("");
	});

	it("renders a query and showing-query class", () => {
		const { container } = render(<SearchBar {...requiredCallbacks()} query="invoice" />);
		expect(screen.getByDisplayValue("invoice").className).not.toContain("empty");
		expect(container.querySelector(".search-container").className).toContain("showing-query");
	});

	it("forwards input changes", () => {
		const callbacks = requiredCallbacks();
		render(<SearchBar {...callbacks} />);
		fireEvent.change(screen.getByPlaceholderText("Search"), { target: { value: "Ada" } });
		expect(callbacks.onSearchQueryChanged).toHaveBeenCalledWith("Ada");
	});

	it("submits the current query from the loupe", () => {
		const callbacks = requiredCallbacks();
		const onSubmitSearchQuery = vi.fn();
		render(<SearchBar {...callbacks} query="Ada" onSubmitSearchQuery={onSubmitSearchQuery} />);
		fireEvent.click(document.querySelector('[data-image-name="searchloupe.png"]'));
		expect(onSubmitSearchQuery).toHaveBeenCalledWith("Ada");
	});

	it("clears the query from the clear accessory", () => {
		const callbacks = requiredCallbacks();
		render(<SearchBar {...callbacks} />);
		fireEvent.click(document.querySelector('[data-image-name="searchclear.png"]'));
		expect(callbacks.onClearSearchQuery).toHaveBeenCalledOnce();
	});

	it("shows a loading accessory while searching", () => {
		render(<SearchBar {...requiredCallbacks()} isSearching />);
		expect(document.querySelector('[data-image-name="inline-loading-spinner.gif"]')).not.toBeNull();
		expect(document.querySelector('[data-image-name="searchloupe.png"]')).toBeNull();
	});

	it("renders labels and selects suggestions", () => {
		const callbacks = requiredCallbacks();
		const suggestion = { id: "one", label: "Search all mail" };
		render(<SearchBar {...callbacks} suggestions={[suggestion]} />);
		fireEvent.click(screen.getByText("Search all mail"));
		expect(callbacks.onSelectSuggestion).toHaveBeenCalledWith(suggestion);
	});

	it("uses a custom suggestion renderer", () => {
		render(
			<SearchBar
				{...requiredCallbacks()}
				suggestions={[{ label: "Ada" }]}
				suggestionRenderer={(item) => <strong>{item.label.toUpperCase()}</strong>}
			/>,
		);
		expect(screen.getByText("ADA").tagName).toBe("STRONG");
	});

	it("renders divider suggestions through Menu.Item", () => {
		render(<SearchBar {...requiredCallbacks()} suggestions={[{ divider: "Recent" }]} />);
		expect(screen.getByTestId("divider").textContent).toBe("Recent");
	});

	it("adds custom and suggestions-visible classes", () => {
		const { container } = render(
			<SearchBar {...requiredCallbacks()} className="compact" suggestions={[{ label: "Ada" }]} />,
		);
		expect(container.querySelector(".nylas-search-bar").className).toContain("compact");
		expect(container.querySelector(".search-container").className).toContain("showing-suggestions");
	});
});
