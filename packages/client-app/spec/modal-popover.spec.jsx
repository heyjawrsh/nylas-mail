import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	closeModal: vi.fn(),
	closePopover: vi.fn(),
}));

vi.mock("nylas-exports", () => ({
	Actions: {
		closeModal: mocks.closeModal,
		closePopover: mocks.closePopover,
	},
}));
vi.mock("../src/flux/actions.js", () => ({
	default: {
		closeModal: mocks.closeModal,
		closePopover: mocks.closePopover,
	},
}));
vi.mock("nylas-store", () => {
	class NylasStore {
		listenTo() {}
		trigger() {}
	}
	return { default: NylasStore };
});
vi.mock("../src/components/retina-img.jsx", () => ({
	default: Object.assign(
		(props) => <button type="button" aria-label="Close modal" {...props} />,
		{ Mode: { ContentDark: "dark" } },
	),
}));
import Modal from "../src/components/modal.jsx";
import FixedPopover from "../src/components/fixed-popover.jsx";
import PopoverStore from "../src/flux/stores/popover-store.jsx";

afterEach(cleanup);

const originRect = {
	top: 20,
	left: 30,
	right: 70,
	bottom: 60,
	width: 40,
	height: 40,
};

describe("Modal", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("renders its child inside the modal", () => {
		render(<Modal><div>Modal content</div></Modal>);
		expect(screen.getByText("Modal content")).toBeDefined();
		expect(document.querySelector(".modal-container .modal")).toBeDefined();
	});

	it("applies the requested dimensions", () => {
		render(<Modal height={240} width={360}><div>Content</div></Modal>);
		const modal = document.querySelector(".modal");
		expect(modal.style.height).toBe("240px");
		expect(modal.style.width).toBe("360px");
	});

	it("closes when the backdrop is clicked", () => {
		render(<Modal><div>Content</div></Modal>);
		fireEvent.click(document.querySelector(".modal-container"));
		expect(mocks.closeModal).toHaveBeenCalledOnce();
	});

	it("does not close when modal content is clicked", () => {
		render(<Modal><div>Content</div></Modal>);
		fireEvent.click(document.querySelector(".modal"));
		expect(mocks.closeModal).not.toHaveBeenCalled();
	});

	it("closes when its close control is clicked", () => {
		render(<Modal><div>Content</div></Modal>);
		fireEvent.click(screen.getByRole("button", { name: "Close modal" }));
		expect(mocks.closeModal).toHaveBeenCalledOnce();
	});

	it("closes on Escape", () => {
		render(<Modal><div>Content</div></Modal>);
		fireEvent.keyDown(document.querySelector(".modal-container"), { key: "Escape" });
		expect(mocks.closeModal).toHaveBeenCalledOnce();
	});

	it("ignores other keys", () => {
		render(<Modal><div>Content</div></Modal>);
		fireEvent.keyDown(document.querySelector(".modal-container"), { key: "Enter" });
		expect(mocks.closeModal).not.toHaveBeenCalled();
	});

	it("focuses its lowest positive tabIndex element on mount", () => {
		render(
			<Modal>
				<div>
					<input aria-label="name" />
					<button type="button" tabIndex={2}>second</button>
					<button type="button" tabIndex={1}>first</button>
				</div>
			</Modal>,
		);
		expect(document.activeElement).toBe(screen.getByRole("button", { name: "first" }));
	});

	it("focuses an input when nothing has a positive tabIndex", () => {
		render(<Modal><div><input aria-label="name" /></div></Modal>);
		expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "name" }));
	});

	it("mounts and unmounts with no React errors", () => {
		const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
		const view = render(<Modal><div><input aria-label="name" /></div></Modal>);
		view.unmount();
		expect(consoleError).not.toHaveBeenCalled();
		consoleError.mockRestore();
	});
});

describe("FixedPopover", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	const renderPopover = (props = {}) => render(
		<FixedPopover
			direction={FixedPopover.Directions.Down}
			originRect={originRect}
			focusElementWithTabIndex={() => {}}
			{...props}
		>
			<div>Popover content</div>
		</FixedPopover>,
	);

	it("renders its child and directional container styles", () => {
		renderPopover();
		expect(screen.getByText("Popover content")).toBeDefined();
		const container = document.querySelector(".fixed-popover-container");
		expect(container.style.top).toBe("60px");
		expect(container.style.left).toBe("30px");
	});

	it("starts hidden until positioning completes", () => {
		renderPopover();
		expect(document.querySelector(".fixed-popover-container").className).not.toContain("popout");
	});

	it("adds the popout class once positioning has run", async () => {
		renderPopover();
		await waitFor(() => {
			expect(document.querySelector(".fixed-popover-container").className).toContain("popout");
		});
	});

	it("focuses the first focusable node inside it on mount (AutoFocuses)", () => {
		render(
			<FixedPopover direction="down" originRect={originRect}>
				<div><input aria-label="search" /></div>
			</FixedPopover>,
		);
		expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "search" }));
	});

	it("hands over its root node through the decorator", () => {
		const ref = React.createRef();
		render(
			<FixedPopover ref={ref} direction="down" originRect={originRect}>
				<div>Popover content</div>
			</FixedPopover>,
		);
		const root = ref.current.getDOMNode();
		expect(root.querySelector(".fixed-popover-container")).not.toBeNull();
		expect(root.querySelector(".fixed-popover-blur-trap")).not.toBeNull();
	});

	it("stays open when focus moves to a node inside it", () => {
		render(
			<FixedPopover direction="down" originRect={originRect}>
				<div><input aria-label="inside" /></div>
			</FixedPopover>,
		);
		fireEvent.blur(document.querySelector(".fixed-popover-container"), {
			relatedTarget: screen.getByRole("textbox", { name: "inside" }),
		});
		expect(mocks.closePopover).not.toHaveBeenCalled();
	});

	it("mounts and unmounts with no React errors", () => {
		const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
		const view = renderPopover();
		view.unmount();
		expect(consoleError).not.toHaveBeenCalled();
		consoleError.mockRestore();
	});

	it("closes on Escape", () => {
		renderPopover();
		fireEvent.keyDown(document.querySelector(".fixed-popover-container"), { key: "Escape" });
		expect(mocks.closePopover).toHaveBeenCalledOnce();
	});

	it("ignores non-Escape keys", () => {
		renderPopover();
		fireEvent.keyDown(document.querySelector(".fixed-popover-container"), { key: "Tab" });
		expect(mocks.closePopover).not.toHaveBeenCalled();
	});

	it("closes when focus leaves the popover", () => {
		renderPopover();
		const outside = document.createElement("button");
		document.body.appendChild(outside);
		fireEvent.blur(document.querySelector(".fixed-popover-container"), {
			relatedTarget: outside,
		});
		expect(mocks.closePopover).toHaveBeenCalledOnce();
		outside.remove();
	});

	it("stays open on app blur when closeOnAppBlur is false", () => {
		renderPopover({ closeOnAppBlur: false });
		fireEvent.blur(document.querySelector(".fixed-popover-container"), {
			relatedTarget: null,
		});
		expect(mocks.closePopover).not.toHaveBeenCalled();
	});

	it("keeps the blur trap aligned with the origin", () => {
		renderPopover();
		const trap = document.querySelector(".fixed-popover-blur-trap");
		expect(trap.style.top).toBe("20px");
		expect(trap.style.left).toBe("30px");
		expect(trap.style.width).toBe("40px");
		expect(trap.style.height).toBe("40px");
	});

	it("inverts a vertical direction when it overflows vertically", () => {
		const instance = new FixedPopover({ direction: "down", originRect });
		expect(instance.computeAdjustedOffsetAndDirection({
			direction: "down",
			currentRect: { top: 10, left: 10, bottom: 120, right: 40 },
			windowDimensions: { width: 100, height: 100 },
			fallback: null,
		})).toEqual({ direction: "up", offset: {} });
	});

	it("offsets a vertical popover away from a horizontal overflow", () => {
		const instance = new FixedPopover({ direction: "down", originRect });
		expect(instance.computeAdjustedOffsetAndDirection({
			direction: "down",
			currentRect: { top: 10, left: -5, bottom: 40, right: 40 },
			windowDimensions: { width: 100, height: 100 },
			fallback: null,
			offsetPadding: 10,
		})).toEqual({ direction: "down", offset: { x: 15 } });
	});

	it("uses the configured fallback before calculating an inversion", () => {
		const instance = new FixedPopover({ direction: "down", originRect, fallbackDirection: "left" });
		expect(instance.computeAdjustedOffsetAndDirection({
			direction: "down",
			currentRect: { top: 10, left: 10, bottom: 120, right: 40 },
			windowDimensions: { width: 100, height: 100 },
		})).toEqual({ direction: "left", offset: {} });
	});
});

describe("PopoverStore", () => {
	const container = () => document.querySelector("nylas-popover-container");
	let consoleError;

	beforeEach(() => {
		vi.clearAllMocks();
		consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
	});
	afterEach(() => {
		PopoverStore.closePopover();
		consoleError.mockRestore();
	});

	it("mounts the popover synchronously on open", () => {
		const callback = vi.fn(() => {
			expect(container().textContent).toBe("Store popover");
		});
		PopoverStore.openPopover(<div>Store popover</div>, {
			originRect,
			direction: "down",
			callback,
		});
		expect(callback).toHaveBeenCalledOnce();
		expect(PopoverStore.isOpen).toBe(true);
		expect(container().querySelector(".fixed-popover-container")).not.toBeNull();
	});

	it("unmounts the popover on close, with no React errors", () => {
		PopoverStore.openPopover(<div>Store popover</div>, { originRect, direction: "down" });
		const callback = vi.fn();
		PopoverStore.closePopover(callback);
		expect(callback).toHaveBeenCalledOnce();
		expect(PopoverStore.isOpen).toBe(false);
		expect(container().querySelector(".fixed-popover-container")).toBeNull();
		expect(consoleError).not.toHaveBeenCalled();
	});

	it("replaces an open popover when another opens", () => {
		PopoverStore.openPopover(<div>First</div>, { originRect, direction: "down" });
		PopoverStore.openPopover(<div>Second</div>, { originRect, direction: "down" });
		expect(container().textContent).toBe("Second");
		expect(container().querySelectorAll(".fixed-popover-container")).toHaveLength(1);
	});
});
