// Covers the object refs that replaced string refs and the removed DOM-node
// lookup in OverlaidComponents and LinkEditor.
import React from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/components/contenteditable/contenteditable.jsx", () => ({
	IgnoreMutationClassName: "ignore-mutations",
}));

const { default: OverlaidComponents } = await import(
	"../src/components/overlaid-components/overlaid-components.jsx"
);
const { default: CustomContenteditableComponents } = await import(
	"../src/components/overlaid-components/custom-contenteditable-components.js"
);
const { ANCHOR_CLASS } = await import(
	"../src/components/overlaid-components/anchor-constants.js"
);
const { default: LinkEditor } = await import(
	"../src/components/contenteditable/link-editor.jsx"
);

afterEach(cleanup);

describe("OverlaidComponents refs", () => {
	const Widget = () => <span className="widget">widget</span>;
	let rects;

	beforeEach(() => {
		CustomContenteditableComponents.register("widget", Widget);
		// jsdom has no layout: the anchor <img> and the overlay wrap get fixed
		// rects, everything else (the roots) sits at the origin.
		rects = vi
			.spyOn(Element.prototype, "getBoundingClientRect")
			.mockImplementation(function rect() {
				if (this.classList.contains(ANCHOR_CLASS)) {
					return { left: 10, top: 20, width: 30, height: 40 };
				}
				if (this.classList.contains(OverlaidComponents.WRAP_CLASS)) {
					return { left: 0, top: 0, width: 55, height: 65 };
				}
				return { left: 0, top: 0, width: 0, height: 0 };
			});
	});

	afterEach(() => {
		rects.mockRestore();
		CustomContenteditableComponents.unregister("widget");
	});

	const anchorHTML = () =>
		OverlaidComponents.buildAnchorTag("widget", {}, "overlay-1").anchorTag;

	const renderWithAnchor = () =>
		render(
			<OverlaidComponents>
				{/* biome-ignore lint/security/noDangerouslySetInnerHtml: fixture anchor */}
				<div dangerouslySetInnerHTML={{ __html: anchorHTML() }} />
			</OverlaidComponents>,
		);

	it("observes the real overlay and anchor containers", () => {
		const observe = vi.spyOn(MutationObserver.prototype, "observe");
		const { container } = renderWithAnchor();
		const observed = observe.mock.calls.map(([node]) => node);
		expect(observed).toContain(container.querySelector(".overlaid-components"));
		expect(observed).toContain(container.querySelector(".anchor-container"));
		observe.mockRestore();
	});

	it("reads anchors from the anchor container and places the overlay over them", () => {
		const { container } = renderWithAnchor();
		const overlay = container.querySelector(
			`.overlaid-components [data-overlay-id="overlay-1"]`,
		);
		expect(overlay.querySelector(".widget")).not.toBeNull();
		expect(overlay.style.top).toBe("20px");
		expect(overlay.style.left).toBe("10px");
	});

	it("sizes the anchor in the anchor container to the overlay it carries", () => {
		const { container } = renderWithAnchor();
		const anchor = container.querySelector(
			`.anchor-container [data-overlay-id="overlay-1"]`,
		);
		expect(anchor.style.width).toBe("55px");
		expect(anchor.style.height).toBe("65px");
	});

	it("disconnects its observers on unmount", () => {
		const disconnect = vi.spyOn(MutationObserver.prototype, "disconnect");
		const view = renderWithAnchor();
		disconnect.mockClear();
		view.unmount();
		expect(disconnect).toHaveBeenCalled();
		disconnect.mockRestore();
	});
});

describe("LinkEditor refs", () => {
	const props = (overrides = {}) => ({
		onSaveUrl: vi.fn(),
		onDoneWithLink: vi.fn(),
		linkToModify: null,
		...overrides,
	});
	const linkTo = (href) => {
		const a = document.createElement("a");
		a.setAttribute("href", href);
		return a;
	};

	it("focuses the url input on mount when asked", () => {
		const { container } = render(<LinkEditor {...props({ focusOnMount: true })} />);
		expect(document.activeElement).toBe(container.querySelector("input"));
	});

	it("leaves focus alone on mount otherwise", () => {
		const { container } = render(<LinkEditor {...props()} />);
		expect(document.activeElement).not.toBe(container.querySelector("input"));
	});

	it("does not save on blur toward the remove button", () => {
		const p = props({ linkToModify: linkTo("https://example.com") });
		const { container } = render(<LinkEditor {...p} />);
		const removeBtn = container.querySelector(".fa-times").parentNode;
		fireEvent.blur(container.querySelector("input"), { relatedTarget: removeBtn });
		expect(p.onDoneWithLink).not.toHaveBeenCalled();
	});

	it("saves on blur toward anything else", () => {
		const p = props({ linkToModify: linkTo("https://example.com") });
		const { container } = render(<LinkEditor {...p} />);
		fireEvent.blur(container.querySelector("input"), { relatedTarget: document.body });
		expect(p.onSaveUrl).toHaveBeenCalledWith("https://example.com", p.linkToModify);
		expect(p.onDoneWithLink).toHaveBeenCalledOnce();
	});
});
