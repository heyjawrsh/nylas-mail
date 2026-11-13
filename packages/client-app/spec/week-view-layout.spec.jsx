import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
	overlapsBounds: vi.fn((bounds, event) => bounds.start <= event.end && event.start <= bounds.end),
}));

vi.mock("underscore", () => {
	const underscore = {
		size: (value) => Object.keys(value || {}).length,
		reject: (values, predicate) => values.filter((value) => !predicate(value)),
		each: (value, iteratee) => Object.entries(value || {}).forEach(([key, item]) => iteratee(item, key)),
		partial: (fn, ...bound) => (...rest) => fn(...bound, ...rest),
	};
	return { default: underscore, ...underscore };
});
vi.mock("react", async (importOriginal) => {
	const actual = await importOriginal();
	return { ...actual, default: actual };
});
vi.mock("prop-types", () => {
	const types = new Proxy({}, { get: (t, prop) => {
		const checker = Object.assign(() => null, {});
		checker.isRequired = checker;
		if (["instanceOf", "oneOf", "oneOfType", "shape", "arrayOf"].includes(prop)) return () => checker;
		return checker;
	} });
	return { default: types, ...types };
});
vi.mock("moment-timezone", async (importOriginal) => {
	const actual = await importOriginal();
	return { ...actual, default: actual.default };
});
vi.mock("classnames", () => {
	const classnames = (values) => Object.keys(values).filter((key) => values[key]).join(" ");
	return { default: classnames, classnames };
});
vi.mock("nylas-exports", () => ({ default: { Utils: { overlapsBounds: m.overlapsBounds } }, Utils: { overlapsBounds: m.overlapsBounds } }));
vi.mock("nylas-component-kit", () => {
	const ScrollRegion = ({ children }) => children;
	ScrollRegion.Scrollbar = () => null;
	return { default: { ScrollRegion }, ScrollRegion };
});
vi.mock("../src/components/nylas-calendar/top-banner.jsx", () => ({ default: () => null }));
vi.mock("../src/components/nylas-calendar/header-controls.jsx", () => ({ default: () => null }));
vi.mock("../src/components/nylas-calendar/footer-controls.jsx", () => ({ default: () => null }));
vi.mock("../src/components/nylas-calendar/calendar-data-source.js", () => ({ default: class CalendarDataSource {} }));
vi.mock("../src/components/nylas-calendar/event-grid-background.jsx", () => ({ default: () => null }));
vi.mock("../src/components/nylas-calendar/week-view-event-column.jsx", () => ({ default: () => null }));
vi.mock("../src/components/nylas-calendar/week-view-all-day-events.jsx", () => ({ default: () => null }));
vi.mock("../src/components/nylas-calendar/calendar-event-container.jsx", () => ({ default: ({ children }) => children }));
vi.mock("../src/components/nylas-calendar/current-time-indicator.jsx", () => ({ default: () => null }));

const { default: moment } = await import("moment-timezone");
const { default: WeekView } = await import("../src/components/nylas-calendar/week-view.jsx");

const subject = () => {
	const view = new WeekView({
		currentMoment: moment.utc("2024-05-15T12:00:00Z"),
		dataSource: {}, changeCurrentMoment: vi.fn(), headerComponents: false,
	});
	view.setState = (updates) => { view.state = { ...view.state, ...updates }; };
	return view;
};

// The grid wrap is a ScrollRegion, which hands over its root node through
// getDOMNode(); the other wraps are plain DOM refs.
const setRefs = (view, { eventGridWrap, eventGridLegendWrap, calendarAreaWrap } = {}) => {
	if (eventGridWrap) view._eventGridWrapRef.current = { getDOMNode: () => eventGridWrap };
	if (eventGridLegendWrap) view._eventGridLegendWrapRef.current = eventGridLegendWrap;
	if (calendarAreaWrap) view._calendarAreaWrapRef.current = calendarAreaWrap;
	return { eventGridWrap, eventGridLegendWrap, calendarAreaWrap };
};

describe("WeekView grid layout math", () => {
	beforeEach(() => vi.clearAllMocks());

	it("uses 21 pixels for each of 48 half-hour intervals", () => {
		expect(subject()._gridHeight()).toBe(1008);
	});

	it("places the noon tick halfway down the grid", () => {
		const ticks = [...subject()._tickGenerator({ type: "all" })];
		expect(ticks[24].yPos).toBe(504);
	});

	it("offsets minor ticks by half an hour", () => {
		const first = [...subject()._tickGenerator({ type: "minor" })][0];
		expect(first.yPos).toBe(21);
	});

	it("spaces major ticks by one hour", () => {
		const ticks = [...subject()._tickGenerator({ type: "major" })];
		expect(ticks[1].yPos - ticks[0].yPos).toBe(42);
	});

	it("centers the vertical scroll region", () => {
		const view = subject();
		const refs = setRefs(view, { eventGridWrap: { scrollTop: 0, getBoundingClientRect: () => ({ height: 400 }) } });
		view._centerScrollRegion();
		expect(refs.eventGridWrap.scrollTop).toBe(304);
	});

	it("expands interval height to fill a tall viewport", () => {
		const view = subject();
		view._mounted = true;
		setRefs(view, {
			eventGridWrap: { getBoundingClientRect: () => ({ height: 1440 }) },
			eventGridLegendWrap: { style: {} },
		});
		view._setIntervalHeight();
		expect(view.state.intervalHeight).toBe(30);
	});

	it("keeps the minimum interval height in a short viewport", () => {
		const view = subject();
		view._mounted = true;
		setRefs(view, {
			eventGridWrap: { getBoundingClientRect: () => ({ height: 480 }) },
			eventGridLegendWrap: { style: {} },
		});
		view._setIntervalHeight();
		expect(view.state.intervalHeight).toBe(21);
	});

	it("mirrors vertical grid scrolling to the legend", () => {
		const view = subject(); const refs = setRefs(view, { eventGridLegendWrap: { scrollTop: 0 } });
		view._onScrollGrid({ target: { scrollTop: 275 } });
		expect(refs.eventGridLegendWrap.scrollTop).toBe(275);
	});

	it("positions horizontal scrolling from the buffered timestamp", () => {
		const view = subject();
		view.state.startMoment = moment.unix(0); view.state.endMoment = moment.unix(1000); view._scrollTime = 250;
		const refs = setRefs(view, { calendarAreaWrap: { scrollLeft: 0, scrollWidth: 800 } });
		view._ensureHorizontalScrollPos();
		expect(refs.calendarAreaWrap.scrollLeft).toBe(200);
	});

	it("clamps horizontal scrolling beyond the loaded range", () => {
		const view = subject();
		view.state.startMoment = moment.unix(0); view.state.endMoment = moment.unix(1000); view._scrollTime = 2000;
		const refs = setRefs(view, { calendarAreaWrap: { scrollLeft: 0, scrollWidth: 800 } });
		view._ensureHorizontalScrollPos();
		expect(refs.calendarAreaWrap.scrollLeft).toBe(800);
	});

	it("moves to the previous week near the left buffer edge", () => {
		const view = subject(); view.state.startMoment = moment.unix(0); view.state.endMoment = moment.unix(1000);
		setRefs(view, { calendarAreaWrap: { scrollLeft: 0, scrollWidth: 1000 } });
		view._onClickPrevWeek = vi.fn(); view._ensureHorizontalScrollPos = vi.fn();
		view._onScrollCalendarArea({ target: { scrollLeft: 100, scrollWidth: 1000 } });
		expect(view._onClickPrevWeek).toHaveBeenCalledOnce();
	});

	it("moves to the next week near the right buffer edge", () => {
		const view = subject(); view.state.startMoment = moment.unix(0); view.state.endMoment = moment.unix(1000);
		setRefs(view, { calendarAreaWrap: { scrollLeft: 0, scrollWidth: 1000 } });
		view._onClickNextWeek = vi.fn(); view._ensureHorizontalScrollPos = vi.fn();
		view._onScrollCalendarArea({ target: { scrollLeft: 900, scrollWidth: 1000 } });
		expect(view._onClickNextWeek).toHaveBeenCalledOnce();
	});
});
