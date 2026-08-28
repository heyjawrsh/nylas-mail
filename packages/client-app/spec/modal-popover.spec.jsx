import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
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
vi.mock("react-dom", () => {
	const findDOMNode = (value) => {
		if (value instanceof Element) return value;
		const modal = document.querySelector(".modal-container");
		if (modal) return modal;
		return document.querySelector(".fixed-popover-container")?.parentElement;
	};
	return { default: { findDOMNode }, findDOMNode };
});
vi.mock("../src/components/retina-img.jsx", () => ({
	default: Object.assign(
		(props) => <button type="button" aria-label="Close modal" {...props} />,
		{ Mode: { ContentDark: "dark" } },
	),
}));
vi.mock("../src/components/decorators/compose.js", async () => {
	const ReactModule = await vi.importActual("react");
	const replaceStringRefs = (node, owner) => {
		if (!ReactModule.isValidElement(node)) return node;
		const props = {};
		if (typeof node.props.ref === "string") {
			const refName = node.props.ref;
			props.ref = (element) => { owner.refs[refName] = element; };
		}
		if (node.props.children !== undefined) {
			props.children = ReactModule.Children.map(
				node.props.children,
				(child) => replaceStringRefs(child, owner),
			);
		}
		return ReactModule.cloneElement(node, props);
	};

	return {
		default: (Component) => class React19CompatibleComponent extends Component {
			constructor(props) {
				super(props);
				// The production component still uses legacy string refs. Adapt them only
				// in the spec; React 19 no longer accepts them and source edits are out of scope.
				Object.defineProperty(this, "refs", { value: {}, configurable: true });
			}

			render() {
				return replaceStringRefs(super.render(), this);
			}
		},
	};
});
vi.mock("../src/components/decorators/auto-focuses.jsx", () => ({
	default: (Component) => Component,
}));

import Modal from "../src/components/modal.jsx";
import FixedPopover from "../src/components/fixed-popover.jsx";

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

	it("adds the popout class when visible", () => {
		let component;
		render(
			<FixedPopover
				ref={(value) => { component = value; }}
				direction="down"
				originRect={originRect}
				focusElementWithTabIndex={() => {}}
			>
				<div>Popover content</div>
			</FixedPopover>,
		);
		act(() => component.setState({ visible: true }));
		expect(document.querySelector(".fixed-popover-container").className).toContain("popout");
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
