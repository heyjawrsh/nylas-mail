import { describe, it, expect, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(cleanup);
import BoldedSearchResult from "../src/components/bolded-search-result.jsx";
import CodeSnippet from "../src/components/code-snippet.jsx";
import DisclosureTriangle from "../src/components/disclosure-triangle.jsx";
import DropZone from "../src/components/drop-zone.jsx";
import Flexbox from "../src/components/flexbox.jsx";
import InjectedComponentLabel from "../src/components/injected-component-label.jsx";
import Spinner from "../src/components/spinner.jsx";
import Switch from "../src/components/switch.jsx";

describe("Spinner", () => {
	it("renders four animation dots", () => {
		const { container } = render(<Spinner visible={false} />);
		expect(container.querySelectorAll(".spinner > div")).toHaveLength(4);
	});

	it("starts hidden and paused", () => {
		const { container } = render(<Spinner visible={false} />);
		expect(container.querySelector(".spinner").className).toContain("hidden");
		expect(container.querySelector(".spinner").className).toContain("paused");
	});

	it("renders a cover and applies custom styles", () => {
		const { container } = render(
			<Spinner visible={false} withCover style={{ color: "red" }} />,
		);
		const cover = container.querySelector(".spinner-cover");
		expect(cover).toBeDefined();
		expect(cover.style.color).toBe("red");
	});
});

describe("DisclosureTriangle", () => {
	it("renders its base class", () => {
		const { container } = render(<DisclosureTriangle />);
		expect(container.firstChild.className).toBe("disclosure-triangle");
	});

	it("reflects visible and collapsed state in its classes", () => {
		const { container } = render(<DisclosureTriangle visible collapsed />);
		expect(container.firstChild.className).toContain("visible");
		expect(container.firstChild.className).toContain("collapsed");
	});

	it("calls onCollapseToggled when clicked", () => {
		const onCollapseToggled = vi.fn();
		const { container } = render(
			<DisclosureTriangle onCollapseToggled={onCollapseToggled} />,
		);
		fireEvent.click(container.firstChild);
		expect(onCollapseToggled).toHaveBeenCalledTimes(1);
	});
});

describe("DropZone", () => {
	it("renders children and passes DOM props through", () => {
		render(
			<DropZone shouldAcceptDrop={() => true} onDrop={() => {}} data-testid="zone">
				Drop files here
			</DropZone>,
		);
		expect(screen.getByText("Drop files here")).toBeDefined();
		expect(screen.getByTestId("zone")).toBeDefined();
	});

	it("reports drag state transitions for accepted drags", () => {
		const onDragStateChange = vi.fn();
		render(
			<DropZone
				shouldAcceptDrop={() => true}
				onDrop={() => {}}
				onDragStateChange={onDragStateChange}
				data-testid="zone"
			/>,
		);
		fireEvent.dragEnter(screen.getByTestId("zone"));
		fireEvent.dragLeave(screen.getByTestId("zone"));
		expect(onDragStateChange).toHaveBeenNthCalledWith(1, { isDropping: true });
		expect(onDragStateChange).toHaveBeenNthCalledWith(2, { isDropping: false });
	});

	it("calls onDrop only for accepted drops", () => {
		const onDrop = vi.fn();
		const { rerender } = render(
			<DropZone shouldAcceptDrop={() => false} onDrop={onDrop} data-testid="zone" />,
		);
		fireEvent.drop(screen.getByTestId("zone"));
		expect(onDrop).not.toHaveBeenCalled();
		rerender(
			<DropZone shouldAcceptDrop={() => true} onDrop={onDrop} data-testid="zone" />,
		);
		fireEvent.drop(screen.getByTestId("zone"));
		expect(onDrop).toHaveBeenCalledTimes(1);
	});
});

describe("Flexbox", () => {
	it("renders children in a flex container", () => {
		render(<Flexbox data-testid="flex">Content</Flexbox>);
		expect(screen.getByText("Content")).toBeDefined();
		expect(document.querySelector('[data-testid="flex"]').style.display).toBe("flex");
	});

	it("supports direction, height, and custom styles", () => {
		render(
			<Flexbox
				data-testid="flex"
				direction="column"
				height="12rem"
				style={{ gap: "8px" }}
			/>,
		);
		const flex = document.querySelector('[data-testid="flex"]');
		expect(flex.style.flexDirection).toBe("column");
		expect(flex.style.height).toBe("12rem");
		expect(flex.style.gap).toBe("8px");
	});

	it("renders inline flex when requested", () => {
		render(<Flexbox inline data-testid="flex" />);
		expect(document.querySelector('[data-testid="flex"]').style.display).toBe("inline-flex");
	});
});

describe("Switch", () => {
	it("renders the switch and its handle", () => {
		const { container } = render(<Switch onChange={() => {}} />);
		expect(container.querySelector(".slide-switch")).toBeDefined();
		expect(container.querySelector(".handle")).toBeDefined();
	});

	it("adds active and custom classes when checked", () => {
		const { container } = render(
			<Switch checked className="compact" onChange={() => {}} />,
		);
		expect(container.firstChild.className).toContain("compact");
		expect(container.firstChild.className).toContain("active");
	});

	it("calls onChange when clicked", () => {
		const onChange = vi.fn();
		const { container } = render(<Switch onChange={onChange} />);
		fireEvent.click(container.firstChild);
		expect(onChange).toHaveBeenCalledTimes(1);
	});
});

describe("InjectedComponentLabel", () => {
	it("describes simple matching values", () => {
		render(<InjectedComponentLabel matching={{ role: "toolbar" }} />);
		expect(screen.getByText(/role: toolbar/)).toBeDefined();
	});

	it("uses ids to describe location matching values", () => {
		render(
			<InjectedComponentLabel
				matching={{ location: { id: "message-list" }, locations: [{ id: "composer" }] }}
			/>,
		);
		expect(screen.getByText(/location: message-list/)).toBeDefined();
		expect(screen.getByText(/locations: composer/)).toBeDefined();
	});

	it("describes the types of additional props", () => {
		render(<InjectedComponentLabel matching={{}} count={2} enabled />);
		expect(screen.getByText(/count:<Number>/)).toBeDefined();
		expect(screen.getByText(/enabled:<Boolean>/)).toBeDefined();
	});
});

describe("BoldedSearchResult", () => {
	it("renders the full value when the query is empty", () => {
		render(<BoldedSearchResult value="Quarterly report" />);
		expect(screen.getByText("Quarterly report")).toBeDefined();
	});

	it("bolds matching text", () => {
		const { container } = render(
			<BoldedSearchResult query="report" value="Quarterly report" />,
		);
		expect(container.querySelector("strong").textContent).toBe("report");
	});

	it("adds the search-result class for a non-empty query", () => {
		const { container } = render(
			<BoldedSearchResult query="quarterly" value="Quarterly report" />,
		);
		expect(container.querySelector(".search-result")).toBeDefined();
	});
});

describe("CodeSnippet", () => {
	it("renders its introduction", () => {
		render(<CodeSnippet intro="Paste this command" code="npm start" />);
		expect(screen.getByText("Paste this command")).toBeDefined();
	});

	it("renders code in a disabled textarea", () => {
		render(<CodeSnippet intro="Command" code="npm start" />);
		const textarea = screen.getByDisplayValue("npm start");
		expect(textarea.disabled).toBe(true);
	});

	it("applies the provided class name", () => {
		const { container } = render(
			<CodeSnippet className="setup-code" intro="Command" code="npm start" />,
		);
		expect(container.firstChild.className).toBe("setup-code");
	});
});
