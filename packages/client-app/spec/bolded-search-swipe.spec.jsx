import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
	fastOmit: vi.fn((object, keys) =>
		Object.fromEntries(Object.entries(object).filter(([key]) => !keys.includes(key))),
	),
}));

vi.mock("node:child_process", () => ({ default: { exec: vi.fn() }, exec: vi.fn() }));
vi.mock("../src/flux/models/utils.js", () => ({
	default: {
		wordSearchRegExp: (value) =>
			new RegExp(`((?:^|\\W|$)${value.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "ig"),
	},
}));
vi.mock("nylas-exports", () => ({
	default: { Utils: { fastOmit: mocks.fastOmit } },
	Utils: { fastOmit: mocks.fastOmit },
}));

import BoldedSearchResult from "../src/components/bolded-search-result.jsx";
import SwipeContainer from "../src/components/swipe-container.jsx";

afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());

describe("BoldedSearchResult deeper cases", () => {
	it("treats whitespace-only queries as empty", () => {
		const { container } = render(<BoldedSearchResult query={" \n\t "} value="Inbox" />);
		expect(container.querySelector(".search-result")).toBeNull();
		expect(container.textContent).toBe("Inbox");
	});

	it("matches without regard to case", () => {
		const { container } = render(<BoldedSearchResult query="REPORT" value="Quarterly report" />);
		expect(container.querySelector("strong").textContent).toBe("report");
	});

	it("preserves punctuation outside the strong element", () => {
		const { container } = render(<BoldedSearchResult query="beta" value="Alpha, beta release" />);
		expect(container.querySelector(".search-result").textContent).toBe("Alpha, beta release");
		expect(container.querySelector("strong").textContent).toBe("beta");
		expect(container.querySelector("strong").previousSibling.textContent).toBe(" ");
	});

	it("does not match a query in the middle of a word", () => {
		const { container } = render(<BoldedSearchResult query="port" value="report portal" />);
		expect(container.querySelectorAll("strong")).toHaveLength(1);
		expect(container.querySelector("strong").textContent).toBe("port");
	});

	it("bolds repeated word-boundary matches", () => {
		const { container } = render(<BoldedSearchResult query="go" value="Go, go! ongoing" />);
		expect([...container.querySelectorAll("strong")].map((node) => node.textContent)).toEqual(["Go", "go"]);
	});

	it("uses empty defaults when called without props", () => {
		const { container } = render(<BoldedSearchResult />);
		expect(container.firstChild.tagName).toBe("SPAN");
		expect(container.textContent).toBe("");
	});
});

describe("SwipeContainer", () => {
	it("renders children at the centered transform", () => {
		const { container } = render(<SwipeContainer><span>Row</span></SwipeContainer>);
		expect(container.firstChild.lastChild.style.transform).toBe("translate3d(0px, 0, 0)");
	});

	it("forwards non-swipe props to its root", () => {
		const { container } = render(<SwipeContainer data-testid="row" aria-label="mail row"><span>Row</span></SwipeContainer>);
		expect(container.firstChild.getAttribute("data-testid")).toBe("row");
		expect(container.firstChild.getAttribute("aria-label")).toBe("mail row");
	});

	it("uses the left class callback and confirmed styling", () => {
		const className = vi.fn(() => "archive");
		const ref = React.createRef();
		const { container } = render(<SwipeContainer ref={ref} onSwipeLeft={() => {}} onSwipeLeftClass={className}><span>Row</span></SwipeContainer>);
		act(() => ref.current.setState({ currentX: -40, targetX: -100 }));
		const backing = container.querySelector(".swipe-backing");
		expect(backing.classList.contains("archive")).toBe(true);
		expect(backing.classList.contains("confirmed")).toBe(true);
		expect(backing.style.right).toBe("0px");
		expect(backing.style.width).toBe("41px");
	});

	it("uses a right string class and width", () => {
		const ref = React.createRef();
		const { container } = render(<SwipeContainer ref={ref} onSwipeRight={() => {}} onSwipeRightClass="snooze"><span>Row</span></SwipeContainer>);
		act(() => ref.current.setState({ currentX: 24, targetX: 0 }));
		const backing = container.querySelector(".swipe-backing");
		expect(backing.classList.contains("snooze")).toBe(true);
		expect(backing.classList.contains("confirmed")).toBe(false);
		expect(backing.style.left).toBe("0px");
		expect(backing.style.width).toBe("25px");
	});

	it("ignores wheel movement until tracking begins", () => {
		const ref = React.createRef();
		const { container } = render(<SwipeContainer ref={ref} onSwipeLeft={() => {}}><span>Row</span></SwipeContainer>);
		fireEvent.wheel(container.firstChild, { deltaX: -90 });
		expect(ref.current.state.currentX).toBe(0);
	});

	it("caches shouldEnableSwipe for a gesture", () => {
		const shouldEnableSwipe = vi.fn(() => true);
		const ref = React.createRef();
		render(<SwipeContainer ref={ref} onSwipeLeft={() => {}} shouldEnableSwipe={shouldEnableSwipe}><span>Row</span></SwipeContainer>);
		expect(ref.current._isEnabled()).toBe(true);
		expect(ref.current._isEnabled()).toBe(true);
		expect(shouldEnableSwipe).toHaveBeenCalledOnce();
	});

	it("invalidates the enabled cache when props arrive", () => {
		const ref = React.createRef();
		const view = render(<SwipeContainer ref={ref} onSwipeLeft={() => {}}><span>Row</span></SwipeContainer>);
		ref.current._isEnabled();
		expect(ref.current.isEnabled).toBe(true);
		view.rerender(<SwipeContainer ref={ref} onSwipeRight={() => {}}><span>Row</span></SwipeContainer>);
		expect(ref.current.isEnabled).toBeNull();
	});

	it("transitions to settling when tracking ends", () => {
		const ref = React.createRef();
		render(<SwipeContainer ref={ref} onSwipeLeft={() => {}}><span>Row</span></SwipeContainer>);
		act(() => {
			ref.current._onScrollTouchBegin();
			ref.current.phase = "gesture-confirmed";
			ref.current._onScrollTouchEnd();
		});
		expect(ref.current.tracking).toBe(false);
		expect(ref.current.phase).toBe("settling");
		expect(ref.current.state.settleStartTime).toEqual(expect.any(Number));
	});

	it("fires a completed left swipe once", () => {
		const onSwipeLeft = vi.fn();
		const ref = React.createRef();
		render(<SwipeContainer ref={ref} onSwipeLeft={onSwipeLeft}><span>Row</span></SwipeContainer>);
		ref.current.trackingInitialTargetX = 0;
		ref.current.state = { ...ref.current.state, targetX: -100, currentX: -90, lastDragX: -90, settleStartTime: Date.now() - 1300 };
		act(() => ref.current._settle());
		expect(onSwipeLeft).toHaveBeenCalledOnce();
		expect(onSwipeLeft).toHaveBeenCalledWith(expect.any(Function));
	});
});
