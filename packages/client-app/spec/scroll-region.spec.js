import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
	debounced: [],
	findDOMNode: vi.fn((value) => value),
	rectVisible: vi.fn(() => false),
}));

vi.mock("prop-types", () => ({ default: new Proxy({}, { get: () => (() => null) }) }));
vi.mock("react", () => {
	const react = { Component: class Component {}, createElement: vi.fn() };
	return { default: react, ...react };
});
vi.mock("react-dom", () => ({ default: { findDOMNode: m.findDOMNode }, findDOMNode: m.findDOMNode }));
vi.mock("nylas-exports", () => ({ Utils: {
	fastOmit: (object, keys) => Object.fromEntries(Object.entries(object).filter(([key]) => !keys.includes(key))),
	isEqualReact: (a, b) => a === b,
	rectVisibleInRect: m.rectVisible,
} }));
vi.mock("classnames", () => ({ default: (values) => Object.keys(values).filter((key) => values[key]).join(" ") }));
vi.mock("../src/components/scrollbar-ticks.jsx", () => ({ default: () => null }));
vi.mock("underscore", () => {
	const underscore = {
		values: (object) => Object.values(object || {}),
		uniq: (items) => [...new Set(items || [])],
		extend: (target, ...sources) => Object.assign(target, ...sources),
		extendOwn: (target, ...sources) => Object.assign(target, ...sources),
		clone: (value) => ({ ...value }),
		debounce: (fn) => { const wrapped = (...args) => fn(...args); m.debounced.push(wrapped); return wrapped; },
	};
	return { default: underscore, ...underscore };
});

import ScrollRegion from "../src/components/scroll-region.jsx";

const region = (props = {}) => {
	const instance = Object.create(ScrollRegion.prototype);
	instance.props = props;
	instance.state = { totalHeight: 500, viewportHeight: 100, viewportScrollTop: 0, scrolling: false };
	instance.refs = {};
	instance._scrollToTaskId = 0;
	instance.setState = vi.fn((state) => Object.assign(instance.state, state));
	Object.defineProperty(instance, "scrollTop", {
		get: () => instance.refs.content.scrollTop,
		set: (value) => { instance.refs.content.scrollTop = value; },
	});
	return instance;
};

const content = (overrides = {}) => ({
	scrollTop: 0, scrollHeight: 500, clientHeight: 100,
	getBoundingClientRect: () => ({ top: 20, bottom: 120, height: 100 }),
	...overrides,
});

describe("ScrollRegion scrolling", () => {
	beforeEach(() => { vi.clearAllMocks(); m.debounced.length = 0; m.rectVisible.mockReturnValue(false); });

	it("rejects a non-DOM scroll target", () => {
		expect(() => region().scrollTo({})).toThrow("requires a DOM node");
	});

	it("rejects a DOM node passed as a rectangle", () => {
		expect(() => region().scrollToRect(document.createElement("div"))).toThrow("requires a rect");
	});

	it("requires top and height in a rectangle", () => {
		expect(() => region().scrollToRect({ top: 1 })).toThrow("`top` and `height`");
	});

	it("scrolls a rectangle to the top", () => {
		const instance = region(); instance.refs.content = content({ scrollTop: 10 });
		instance.scrollToRect({ top: 70, bottom: 90, height: 20 }, { position: ScrollRegion.ScrollPosition.Top });
		expect(instance.scrollTop).toBe(60);
	});

	it("scrolls a rectangle to the bottom", () => {
		const instance = region(); instance.refs.content = content();
		instance.scrollToRect({ top: 170, bottom: 190, height: 20 }, { position: ScrollRegion.ScrollPosition.Bottom });
		expect(instance.scrollTop).toBe(70);
	});

	it("centers a rectangle", () => {
		const instance = region(); instance.refs.content = content();
		instance.scrollToRect({ top: 170, bottom: 190, height: 20 }, { position: ScrollRegion.ScrollPosition.Center });
		expect(instance.scrollTop).toBe(110);
	});

	it("does not center an already visible rectangle", () => {
		m.rectVisible.mockReturnValue(true);
		const instance = region(); instance.refs.content = content({ scrollTop: 12 });
		instance.scrollToRect({ top: 40, bottom: 60, height: 20 }, { position: ScrollRegion.ScrollPosition.CenterIfInvisible });
		expect(instance.scrollTop).toBe(12);
	});

	it("moves the least distance to reveal content below the viewport", () => {
		const instance = region(); instance.refs.content = content();
		instance.scrollToRect({ top: 110, bottom: 150, height: 40 });
		expect(instance.scrollTop).toBe(30);
	});

	it("reports a completed scroll", () => {
		const done = vi.fn(); const instance = region(); instance.refs.content = content();
		instance.scrollToRect({ top: 30, bottom: 50, height: 20 }, { done });
		expect(done).toHaveBeenCalledWith(true);
	});

	it("ignores bubbled scroll events from descendants", () => {
		const onScroll = vi.fn(); const instance = region({ onScroll }); instance.refs.content = content();
		instance._onScroll({ target: document.createElement("textarea") });
		expect(onScroll).not.toHaveBeenCalled();
	});

	it("marks the first native scroll as active", () => {
		const instance = region(); instance.refs.content = content(); instance.recomputeDimensions = vi.fn(); instance._setSharedState = vi.fn();
		instance._onScroll({ target: instance.refs.content });
		expect(instance._setSharedState).toHaveBeenCalledWith({ scrolling: true });
	});

	it("uses cached dimensions during an active scroll", () => {
		const instance = region(); instance.state.scrolling = true; instance.refs.content = content(); instance.recomputeDimensions = vi.fn(); instance._setSharedState = vi.fn();
		instance._onScroll({ target: instance.refs.content });
		expect(instance.recomputeDimensions).toHaveBeenCalledWith({ useCachedValues: true });
	});

	it("forwards native scroll events", () => {
		const onScroll = vi.fn(); const instance = region({ onScroll }); instance.refs.content = content(); instance.recomputeDimensions = vi.fn(); instance._setSharedState = vi.fn(); const event = { target: instance.refs.content };
		instance._onScroll(event);
		expect(onScroll).toHaveBeenCalledWith(event);
	});

	it("ends scrolling and notifies after the debounced callback", () => {
		const onScrollEnd = vi.fn(); const instance = region({ onScrollEnd }); instance.refs.content = content(); instance.recomputeDimensions = vi.fn(); instance._setSharedState = vi.fn(); const event = { target: instance.refs.content };
		instance._onScroll(event);
		expect(onScrollEnd).toHaveBeenCalledWith(event);
		expect(instance._setSharedState).toHaveBeenLastCalledWith({ scrolling: false });
	});
});
