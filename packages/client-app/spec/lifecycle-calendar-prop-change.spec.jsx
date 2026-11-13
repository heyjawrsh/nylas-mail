// WeekView and CalendarEventPopover on prop change: WeekView's range follows
// currentMoment before render and it re-subscribes only when its inputs
// change; the popover keeps edits through an unrelated re-render.
import React from "react";
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("nylas-exports", () => ({
	default: { Utils: { overlapsBounds: () => true } },
	Utils: { overlapsBounds: () => true },
}));
vi.mock("nylas-component-kit", () => {
	class ScrollRegion extends React.Component {
		static Scrollbar = () => null;
		root = React.createRef();
		getDOMNode() {
			return this.root.current;
		}
		render() {
			return <div ref={this.root}>{this.props.children}</div>;
		}
	}
	return { default: { ScrollRegion }, ScrollRegion };
});
vi.mock("../src/components/nylas-calendar/top-banner.jsx", () => ({ default: () => null }));
vi.mock("../src/components/nylas-calendar/header-controls.jsx", () => ({ default: () => null }));
vi.mock("../src/components/nylas-calendar/footer-controls.jsx", () => ({ default: () => null }));
vi.mock("../src/components/nylas-calendar/calendar-data-source.js", () => ({ default: class CalendarDataSource {} }));
vi.mock("../src/components/nylas-calendar/event-grid-background.jsx", () => ({ default: () => null }));
vi.mock("../src/components/nylas-calendar/week-view-event-column.jsx", () => ({ default: () => null }));
vi.mock("../src/components/nylas-calendar/week-view-all-day-events.jsx", () => ({ default: () => null }));
vi.mock("../src/components/nylas-calendar/calendar-event-container.jsx", () => ({ default: ({ children }) => <div>{children}</div> }));
vi.mock("../src/components/nylas-calendar/current-time-indicator.jsx", () => ({ default: () => null }));

const { default: moment } = await import("moment-timezone");
const { default: WeekView } = await import("../src/components/nylas-calendar/week-view.jsx");

afterEach(cleanup);

function dataSource() {
	const subs = [];
	return {
		subs,
		buildObservable: vi.fn((range) => ({
			subscribe: () => {
				const sub = { range, dispose: vi.fn() };
				subs.push(sub);
				return sub;
			},
		})),
	};
}

const day = (iso) => moment.utc(iso);
const week = (props) => <WeekView changeCurrentMoment={() => {}} {...props} />;

describe("WeekView on prop change", () => {
	let rendered;
	beforeEach(() => {
		rendered = [];
		const original = WeekView.prototype.render;
		vi.spyOn(WeekView.prototype, "render").mockImplementation(function () {
			rendered.push(this.state.startMoment.format("YYYY-MM-DD"));
			return original.call(this);
		});
	});
	afterEach(() => vi.restoreAllMocks());

	it("renders the new week's range on the first render after currentMoment changes", () => {
		const ds = dataSource();
		const view = render(week({ dataSource: ds, currentMoment: day("2024-05-15T12:00:00Z") }));
		rendered.length = 0;
		view.rerender(week({ dataSource: ds, currentMoment: day("2024-06-12T12:00:00Z") }));
		expect(rendered[0]).toBe(rendered.at(-1));
		expect(rendered[0]).not.toBe("2024-05-05");
	});

	it("disposes the old subscription and subscribes for the new range", () => {
		const ds = dataSource();
		const view = render(week({ dataSource: ds, currentMoment: day("2024-05-15T12:00:00Z") }));
		view.rerender(week({ dataSource: ds, currentMoment: day("2024-06-12T12:00:00Z") }));
		expect(ds.subs).toHaveLength(2);
		expect(ds.subs[0].dispose).toHaveBeenCalledOnce();
		expect(ds.subs[1].range.startTime).toBeGreaterThan(ds.subs[0].range.startTime);
		view.unmount();
		expect(ds.subs[1].dispose).toHaveBeenCalledOnce();
	});

	it("keeps its subscription on an unrelated re-render", () => {
		const ds = dataSource();
		const current = day("2024-05-15T12:00:00Z");
		const view = render(week({ dataSource: ds, currentMoment: current }));
		view.rerender(week({ dataSource: ds, currentMoment: current, onEventClick: () => {} }));
		expect(ds.subs).toHaveLength(1);
		expect(ds.subs[0].dispose).not.toHaveBeenCalled();
	});

	it("subscribes to a new dataSource, not the old one", () => {
		const a = dataSource();
		const b = dataSource();
		const current = day("2024-05-15T12:00:00Z");
		const view = render(week({ dataSource: a, currentMoment: current }));
		view.rerender(week({ dataSource: b, currentMoment: current }));
		expect(a.buildObservable).toHaveBeenCalledOnce();
		expect(b.buildObservable).toHaveBeenCalledOnce();
		expect(a.subs[0].dispose).toHaveBeenCalledOnce();
	});
});
