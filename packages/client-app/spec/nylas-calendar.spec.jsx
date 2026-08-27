import { beforeEach, describe, expect, it, vi } from "vitest";
import moment from "moment-timezone";

const mocks = vi.hoisted(() => ({
	hueForString: vi.fn(() => 214),
	overlapsBounds: vi.fn((a, b) => a.start <= b.end && b.start <= a.end),
}));

vi.mock("nylas-exports", () => ({
	Event: class Event {},
	Utils: {
		hueForString: mocks.hueForString,
		isEqualReact: vi.fn((a, b) => a === b),
		overlapsBounds: mocks.overlapsBounds,
	},
}));
vi.mock("nylas-component-kit", () => ({
	InjectedComponentSet: () => null,
	ScrollRegion: ({ children }) => children,
}));
vi.mock("../src/components/nylas-calendar/top-banner.jsx", () => ({ default: () => null }));
vi.mock("../src/components/nylas-calendar/header-controls.jsx", () => ({ default: () => null }));
vi.mock("../src/components/nylas-calendar/footer-controls.jsx", () => ({ default: () => null }));
vi.mock("../src/components/nylas-calendar/calendar-data-source.js", () => ({
	default: class CalendarDataSource {},
}));
vi.mock("../src/components/nylas-calendar/event-grid-background.jsx", () => ({ default: () => null }));
vi.mock("../src/components/nylas-calendar/week-view-event-column.jsx", () => ({ default: () => null }));
vi.mock("../src/components/nylas-calendar/week-view-all-day-events.jsx", () => ({ default: () => null }));
vi.mock("../src/components/nylas-calendar/current-time-indicator.jsx", () => ({ default: () => null }));

import { calcColor } from "../src/components/nylas-calendar/calendar-helpers.jsx";
import CalendarEvent from "../src/components/nylas-calendar/calendar-event.jsx";
import CalendarEventContainer from "../src/components/nylas-calendar/calendar-event-container.jsx";
import WeekView from "../src/components/nylas-calendar/week-view.jsx";

const calendarEvent = (values = {}) => ({
	id: "event-1",
	start: 100,
	end: 200,
	calendarId: "calendar-1",
	displayTitle: () => "Planning",
	isAllDay: () => false,
	...values,
});

const weekView = (currentMoment = moment("2024-05-15T12:00:00Z")) =>
	new WeekView({
		currentMoment,
		dataSource: {},
		changeCurrentMoment: vi.fn(),
	});

const eventComponent = (overrides = {}) =>
	new CalendarEvent({
		event: calendarEvent(),
		scopeStart: 0,
		scopeEnd: 400,
		order: 1,
		concurrentEvents: 1,
		fixedSize: -1,
		direction: "vertical",
		...overrides,
	});

describe("calendar helpers", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		NylasEnv.config.get.mockReturnValue(undefined);
	});

	it("returns a configured calendar color", () => {
		NylasEnv.config.get.mockReturnValue("#123456");
		expect(calcColor("work")).toBe("#123456");
		expect(mocks.hueForString).not.toHaveBeenCalled();
	});

	it("derives a stable translucent color when none is configured", () => {
		expect(calcColor("work")).toBe("hsla(214, 50%, 45%, 0.35)");
		expect(mocks.hueForString).toHaveBeenCalledWith("work");
	});
});

describe("CalendarEvent geometry", () => {
	beforeEach(() => NylasEnv.config.get.mockReturnValue("rgb(1, 2, 3)"));

	it("positions an event within its time scope", () => {
		expect(eventComponent()._getDimensions()).toEqual({
			left: "0%", width: "100%", top: "25%", height: "25%",
		});
	});

	it("divides width among concurrent events", () => {
		expect(eventComponent({ order: 2, concurrentEvents: 4 })._getDimensions()).toMatchObject({
			left: "25%", width: "25%",
		});
	});

	it("uses fixed pixel-like dimensions without adding units", () => {
		expect(eventComponent({ order: 3, fixedSize: 40 })._getDimensions()).toMatchObject({
			left: 80, width: 40,
		});
	});

	it("clips the portion before the scope", () => {
		const subject = eventComponent({
			event: calendarEvent({ start: -100, end: 100 }),
		});
		expect(subject._overflowBefore()).toBe(100);
		expect(subject._getDimensions()).toMatchObject({ top: "0%", height: "25%" });
	});

	it("caps an event height at the full scope", () => {
		const subject = eventComponent({ event: calendarEvent({ start: 0, end: 1000 }) });
		expect(subject._getDimensions().height).toBe("100%");
	});

	it("does not produce a negative top for an event beginning early", () => {
		const subject = eventComponent({ event: calendarEvent({ start: -20, end: 20 }) });
		expect(subject._getDimensions().top).toBe("0%");
	});

	it("rotates dimensions for horizontal events", () => {
		const styles = eventComponent({ direction: "horizontal", order: 2, concurrentEvents: 2 })._getStyles();
		expect(styles).toMatchObject({ left: "25%", width: "25%", height: "50%", top: "50%" });
	});

	it("adds the calendar background color to vertical styles", () => {
		expect(eventComponent()._getStyles().backgroundColor).toBe("rgb(1, 2, 3)");
	});
});

describe("WeekView date and event computations", () => {
	it("starts one buffer week before the selected week", () => {
		const subject = weekView();
		const start = subject._calculateStartMoment(subject.props);
		expect(start.format("YYYY-MM-DD HH:mm:ss")).toBe("2024-05-05 00:00:00");
	});

	it("preserves the selected timezone while calculating the start", () => {
		const selected = moment.tz("2024-05-15 12:00", "America/Los_Angeles");
		expect(weekView(selected)._calculateStartMoment({ currentMoment: selected }).tz()).toBe("America/Los_Angeles");
	});

	it("ends after three weeks minus one millisecond", () => {
		const subject = weekView();
		const start = subject._calculateStartMoment(subject.props);
		const end = subject._calculateEndMoment(subject.props);
		expect(end.diff(start)).toBe(moment.duration(21, "days").asMilliseconds() - 1);
	});

	it("recognizes today only when year and day-of-year both match", () => {
		const subject = weekView();
		subject.todayYear = 2024;
		subject.todayDayOfYear = 136;
		expect(subject._isToday(moment("2024-05-15"))).toBe(true);
		expect(subject._isToday(moment("2023-05-16"))).toBe(false);
	});

	it("assigns one lane to a lone event", () => {
		expect(weekView()._eventOverlap([calendarEvent()])).toEqual({
			"event-1": { concurrentEvents: 1, order: 1 },
		});
	});

	it("assigns separate lanes to simultaneous events", () => {
		const overlap = weekView()._eventOverlap([
			calendarEvent({ id: "a" }),
			calendarEvent({ id: "b" }),
		]);
		expect(overlap).toEqual({
			a: { concurrentEvents: 2, order: 1 },
			b: { concurrentEvents: 2, order: 2 },
		});
	});

	it("propagates peak concurrency across a connected overlap group", () => {
		const overlap = weekView()._eventOverlap([
			calendarEvent({ id: "a", start: 0, end: 30 }),
			calendarEvent({ id: "b", start: 10, end: 40 }),
			calendarEvent({ id: "c", start: 20, end: 50 }),
		]);
		expect(Object.values(overlap).map((value) => value.concurrentEvents)).toEqual([3, 3, 3]);
	});

	it("reuses a lane after an earlier event ends", () => {
		const overlap = weekView()._eventOverlap([
			calendarEvent({ id: "a", start: 0, end: 20 }),
			calendarEvent({ id: "b", start: 10, end: 30 }),
			calendarEvent({ id: "c", start: 21, end: 40 }),
		]);
		expect(overlap.c.order).toBe(1);
	});

	it("finds the first lane not occupied by active events", () => {
		const events = [{ id: "a" }, { id: "b" }];
		expect(weekView()._findAvailableOrder(events, { a: { order: 1 }, b: { order: 3 } })).toBe(2);
	});

	it("returns the largest concurrency count", () => {
		expect(weekView()._maxConcurrentEvents({ a: { concurrentEvents: 2 }, b: { concurrentEvents: 4 } })).toBe(4);
	});

	it("uses zero height when there are no all-day events", () => {
		expect(weekView()._allDayEventHeight({})).toBe(0);
	});

	it("sizes all-day rows from their maximum concurrency", () => {
		expect(weekView()._allDayEventHeight({ a: { concurrentEvents: 3 } })).toBe(64);
	});

	it("generates 21 consecutive days", () => {
		const subject = weekView();
		subject.state.startMoment = moment("2024-05-05");
		const days = subject._daysInView();
		expect(days).toHaveLength(21);
		expect(days[0].format("YYYY-MM-DD")).toBe("2024-05-05");
		expect(days[20].format("YYYY-MM-DD")).toBe("2024-05-25");
	});

	it("groups all-day events separately from timed events", () => {
		const subject = weekView();
		const day = moment.unix(1000).startOf("day");
		const allDay = calendarEvent({ id: "all", isAllDay: () => true });
		const timed = calendarEvent({ id: "timed", start: day.unix() + 10, end: day.unix() + 20 });
		subject.state.events = [allDay, timed];
		const grouped = subject._eventsByDay([day]);
		expect(grouped.allDay).toEqual([allDay]);
		expect(grouped[day.unix()]).toEqual([timed]);
	});

	it("includes a timed event in every day whose bounds it overlaps", () => {
		const subject = weekView();
		const first = moment("2024-05-05").startOf("day");
		const second = moment(first).add(1, "day");
		const event = calendarEvent({ start: first.unix() + 100, end: second.unix() + 100 });
		subject.state.events = [event];
		const grouped = subject._eventsByDay([first, second]);
		expect(grouped[first.unix()]).toEqual([event]);
		expect(grouped[second.unix()]).toEqual([event]);
	});

	it("generates 49 half-hour ticks for the full day", () => {
		const subject = weekView();
		const ticks = [...subject._tickGenerator({ type: "all" })];
		expect(ticks).toHaveLength(49);
		expect(ticks.at(-1).yPos).toBe(subject._gridHeight());
	});

	it("generates hourly major ticks", () => {
		expect([...weekView()._tickGenerator({ type: "major" })]).toHaveLength(25);
	});

	it("reports the three-week-to-one-week buffer ratio", () => {
		expect(weekView()._bufferRatio()).toBe(3);
	});
});

describe("CalendarEventContainer mouse data", () => {
	it("returns null measurements outside an event column", () => {
		const subject = new CalendarEventContainer({});
		expect(subject._dataFromMouseEvent({ target: {} })).toEqual({
			x: null, y: null, width: null, height: null, time: null,
		});
	});

	it("maps mouse coordinates and scroll offsets to a calendar time", () => {
		const subject = new CalendarEventContainer({});
		const eventColumn = { dataset: { start: "1000", end: "2000" } };
		const gridWrap = {
			scrollTop: 50, scrollWidth: 700, scrollHeight: 1000,
			getBoundingClientRect: () => ({ top: 100 }),
		};
		const calWrap = {
			scrollLeft: 25,
			getBoundingClientRect: () => ({ left: 10 }),
		};
		const target = { closest: vi.fn((selector) => ({
			".event-column": eventColumn,
			".event-grid-wrap .scroll-region-content-inner": gridWrap,
			".calendar-area-wrap": calWrap,
		}[selector])) };
		const data = subject._dataFromMouseEvent({ target, clientX: 110, clientY: 550 });
		expect(data).toMatchObject({ x: 125, y: 500, width: 700, height: 1000 });
		expect(data.time.valueOf()).toBe(1500);
	});
});
