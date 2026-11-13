import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
	debounces: [],
	isEqualReact: vi.fn((a, b) => a === b),
}));

vi.mock("prop-types", () => {
	const types = new Proxy({}, { get: () => vi.fn(() => null) });
	return { default: types, ...types };
});
vi.mock("underscore", () => {
	const underscore = {
		clone: (value) => ({ ...value }),
		debounce: (fn) => {
			const wrapped = (...args) => fn(...args);
			m.debounces.push(wrapped);
			return wrapped;
		},
	};
	return { default: underscore, ...underscore };
});
vi.mock("react", () => {
	class Component {
		constructor(props) { this.props = props; this.state = {}; }
		setState(update) { Object.assign(this.state, typeof update === "function" ? update(this.state, this.props) : update); }
	}
	const react = {
		Component,
		createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
		createRef: () => ({ current: null }),
	};
	return { default: react, ...react };
});
vi.mock("nylas-exports", () => {
	const Utils = {
		fastOmit: (object, keys) => Object.fromEntries(Object.entries(object).filter(([key]) => !keys.includes(key))),
		isEqualReact: m.isEqualReact,
		rectVisibleInRect: vi.fn(() => false),
	};
	return { default: { Utils }, Utils };
});
vi.mock("classnames", () => {
	const classNames = (values) => Object.keys(values).filter((key) => values[key]).join(" ");
	return { default: classNames, classNames };
});
vi.mock("../src/components/scrollbar-ticks.jsx", () => {
	const ScrollbarTicks = vi.fn(() => null);
	return { default: ScrollbarTicks, ScrollbarTicks };
});

const { default: ScrollRegion } = await import("../src/components/scroll-region.jsx");
const Scrollbar = ScrollRegion.Scrollbar;

const scrollbar = (overrides = {}) => {
	const scrollRegion = { scrollTop: 0, _recomputeDimensions: vi.fn() };
	const instance = new Scrollbar({ getScrollRegion: () => scrollRegion, ...overrides });
	return { instance, scrollRegion };
};

const region = (props = {}) => {
	const instance = Object.create(ScrollRegion.prototype);
	instance.props = props;
	instance.state = { totalHeight: 0, viewportHeight: 0, viewportScrollTop: 0, scrolling: false };
	instance._rootRef = { current: null };
	instance._contentRef = { current: null };
	instance._scrollbarRef = { current: null };
	instance.setState = vi.fn((update) => Object.assign(instance.state, update));
	return instance;
};

const sizedContent = ({ scrollTop = 12, scrollHeight = 600, clientHeight = 150 } = {}) => {
	const node = document.createElement("div");
	Object.defineProperties(node, {
		scrollTop: { value: scrollTop, writable: true },
		scrollHeight: { value: scrollHeight, configurable: true },
		clientHeight: { value: clientHeight, configurable: true },
	});
	return node;
};

describe("ScrollRegion deep scrollbar and DOM event behavior", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		m.debounces.length = 0;
	});

	it("enforces the forty pixel minimum handle height", () => {
		const { instance } = scrollbar();
		Object.assign(instance.state, { totalHeight: 1000, trackHeight: 100, viewportHeight: 100 });
		expect(instance._getHandleHeight()).toBe(40);
	});

	it("calculates a proportional handle height", () => {
		const { instance } = scrollbar();
		Object.assign(instance.state, { totalHeight: 400, trackHeight: 200 });
		expect(instance._getHandleHeight()).toBe(100);
	});

	it("caps the handle height at the total content height", () => {
		const { instance } = scrollbar();
		Object.assign(instance.state, { totalHeight: 30, trackHeight: 100 });
		expect(instance._getHandleHeight()).toBe(30);
	});

	it("positions the handle from the viewport scroll ratio", () => {
		const { instance } = scrollbar();
		Object.assign(instance.state, { totalHeight: 1000, viewportHeight: 200, viewportScrollTop: 400, trackHeight: 200 });
		expect(instance._scrollbarHandleStyles()).toEqual({ position: "relative", height: 40, top: 80 });
	});

	it("hides the scrollbar when all content fits", () => {
		const { instance } = scrollbar();
		Object.assign(instance.state, { totalHeight: 100, viewportHeight: 100 });
		expect(instance._scrollbarWrapStyles().visibility).toBe("hidden");
	});

	it("renders no tick component for an empty tick list", () => {
		const { instance } = scrollbar();
		expect(instance._renderScrollbarTicks()).toBe(false);
	});

	it("subscribes to a scrollbar tick provider on mount", () => {
		const listen = vi.fn(() => vi.fn());
		const { instance } = scrollbar({ scrollbarTickProvider: { listen } });
		instance.componentDidMount();
		expect(listen).toHaveBeenCalledWith(instance._onTickProviderChange);
	});

	it("loads current ticks when the provider changes", () => {
		const { instance } = scrollbar({ scrollbarTickProvider: { scrollbarTicks: () => [0.2, 0.8] } });
		instance._onTickProviderChange();
		expect(instance.state.scrollbarTicks).toEqual([0.2, 0.8]);
	});

	it("rejects a tick provider without scrollbarTicks", () => {
		const { instance } = scrollbar({ scrollbarTickProvider: {} });
		expect(() => instance._onTickProviderChange()).toThrow("must implement `scrollbarTicks`");
	});

	it("reads a changed track height from the DOM", () => {
		const { instance } = scrollbar();
		instance._trackRef.current = { clientHeight: 240 };
		instance._recomputeDimensions({ useCachedValues: false });
		expect(instance.state.trackHeight).toBe(240);
	});

	it("records mouse offsets when handle dragging begins", () => {
		const { instance } = scrollbar();
		instance._trackRef.current = { getBoundingClientRect: () => ({ top: 25 }) };
		instance._handleRef.current = { getBoundingClientRect: () => ({ top: 40 }) };
		instance._onHandleDown({ pageY: 55, preventDefault: vi.fn() });
		expect([instance._trackOffset, instance._mouseOffsetWithinHandle]).toEqual([25, 15]);
		instance._onHandleUp({ preventDefault: vi.fn() });
	});

	it("updates scrollTop from a real window mousemove", () => {
		const { instance, scrollRegion } = scrollbar();
		Object.assign(instance.state, { totalHeight: 1000, viewportHeight: 200, trackHeight: 200 });
		instance._trackRef.current = { getBoundingClientRect: () => ({ top: 20 }) };
		instance._handleRef.current = { getBoundingClientRect: () => ({ top: 30 }) };
		instance._onHandleDown({ pageY: 40, preventDefault: vi.fn() });
		window.dispatchEvent(new MouseEvent("mousemove", { clientY: 110 }));
		expect(scrollRegion.scrollTop).toBe(400);
		window.dispatchEvent(new MouseEvent("mouseup"));
	});

	it("ends dragging from a real window mouseup", () => {
		const { instance } = scrollbar();
		instance._trackRef.current = { getBoundingClientRect: () => ({ top: 0 }) };
		instance._handleRef.current = { getBoundingClientRect: () => ({ top: 0 }) };
		instance._onHandleDown({ pageY: 0, preventDefault: vi.fn() });
		window.dispatchEvent(new MouseEvent("mouseup"));
		expect(instance.state.dragging).toBe(false);
	});

	it("stops handle clicks from becoming track jumps", () => {
		const { instance } = scrollbar();
		const event = { stopPropagation: vi.fn() };
		instance._onHandleClick(event);
		expect(event.stopPropagation).toHaveBeenCalledOnce();
	});

	it("centers the handle on a clicked track position", () => {
		const { instance, scrollRegion } = scrollbar();
		Object.assign(instance.state, { totalHeight: 1000, viewportHeight: 200, trackHeight: 200 });
		instance._trackRef.current = { getBoundingClientRect: () => ({ top: 10 }) };
		instance._onScrollJump({ pageY: 110, preventDefault: vi.fn() });
		expect(scrollRegion.scrollTop).toBe(400);
	});

	it("forwards recomputation to an external scrollbar", () => {
		const external = { _recomputeDimensions: vi.fn() };
		const instance = region({ getScrollbar: () => external });
		instance._recomputeDimensions = vi.fn();
		instance.recomputeDimensions({ useCachedValues: true });
		expect(external._recomputeDimensions).toHaveBeenCalledWith({ useCachedValues: true });
	});

	it("shares fresh DOM dimensions with the scrollbar", () => {
		const instance = region();
		instance._contentRef.current = sizedContent();
		instance._setSharedState = vi.fn();
		instance._recomputeDimensions({ useCachedValues: false });
		expect(instance._setSharedState).toHaveBeenCalledWith({ totalHeight: 600, viewportScrollTop: 12, viewportHeight: 150 });
	});

	it("retains cached heights while refreshing scrollTop", () => {
		const instance = region();
		instance.state = { totalHeight: 500, viewportHeight: 100, viewportScrollTop: 0 };
		instance._contentRef.current = sizedContent({ scrollTop: 35, scrollHeight: 900, clientHeight: 300 });
		instance._setSharedState = vi.fn();
		instance._recomputeDimensions({ useCachedValues: true });
		expect(instance._setSharedState).toHaveBeenCalledWith({ totalHeight: 500, viewportScrollTop: 35, viewportHeight: 100 });
	});


	it("does not treat a wheel event as a completed native scroll", () => {
		const onScroll = vi.fn();
		const instance = region({ onScroll });
		const node = sizedContent();
		instance._contentRef.current = node;
		node.addEventListener("scroll", instance._onScroll);
		node.dispatchEvent(new WheelEvent("wheel", { deltaY: 40 }));
		expect(onScroll).not.toHaveBeenCalled();
	});
});
