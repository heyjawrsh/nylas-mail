// Covers the object refs that replaced string refs and the removed DOM-node
// lookup in the calendar's grid background, time indicator, event and event
// container.
import React from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("nylas-exports", () => ({
	Event: class Event {},
	Utils: { isEqualReact: (a, b) => a === b },
}));
vi.mock("nylas-component-kit", () => ({
	InjectedComponentSet: () => null,
}));
vi.mock("../src/components/nylas-calendar/calendar-helpers.jsx", () => ({
	calcColor: () => "red",
}));

const { default: EventGridBackground } = await import(
	"../src/components/nylas-calendar/event-grid-background.jsx"
);
const { default: CurrentTimeIndicator } = await import(
	"../src/components/nylas-calendar/current-time-indicator.jsx"
);
const { default: CalendarEvent } = await import(
	"../src/components/nylas-calendar/calendar-event.jsx"
);
const { default: CalendarEventContainer } = await import(
	"../src/components/nylas-calendar/calendar-event-container.jsx"
);

// jsdom has neither a canvas context nor scrollIntoViewIfNeeded.
let scrolled;
beforeEach(() => {
	scrolled = [];
	Element.prototype.scrollIntoViewIfNeeded = function scrollIntoViewIfNeeded() {
		scrolled.push(this);
	};
});
afterEach(() => {
	cleanup();
	delete Element.prototype.scrollIntoViewIfNeeded;
});

describe("EventGridBackground refs", () => {
	const ctx = {
		clearRect: vi.fn(),
		beginPath: vi.fn(),
		moveTo: vi.fn(),
		lineTo: vi.fn(),
		stroke: vi.fn(),
	};
	let getContext;
	beforeEach(() => {
		getContext = vi
			.spyOn(HTMLCanvasElement.prototype, "getContext")
			.mockImplementation(() => ctx);
	});
	afterEach(() => getContext.mockRestore());

	const renderGrid = (ref) =>
		render(
			<EventGridBackground
				ref={ref}
				height={480}
				numColumns={7}
				intervalHeight={20}
				tickGenerator={() => [{ yPos: 10 }]}
			/>,
		);

	it("draws on its own canvas and sizes it to the grid height", () => {
		const { container } = renderGrid();
		const canvas = container.querySelector("canvas.event-grid-bg");
		expect(getContext.mock.contexts).toContain(canvas);
		expect(canvas.height).toBe(480);
		expect(ctx.stroke).toHaveBeenCalled();
	});

	it("moves its own cursor node on mouse move", () => {
		const ref = React.createRef();
		const { container } = renderGrid(ref);
		ref.current.mouseMove({ x: 150, y: 45, width: 700 });
		const cursor = container.querySelector(".cursor");
		expect(cursor.style.left).toBe("101px");
		expect(cursor.style.top).toBe("41px");
		expect(cursor.style.width).toBe("98px");
		expect(cursor.style.height).toBe("18px");
	});
});

describe("CurrentTimeIndicator refs", () => {
	it("scrolls its own root node into view on mount", () => {
		const { container } = render(
			<CurrentTimeIndicator gridHeight={1000} numColumns={7} todayColumnIdx={2} visible />,
		);
		expect(scrolled).toEqual([container.querySelector(".current-time-indicator")]);
	});
});

describe("CalendarEvent refs", () => {
	const event = {
		id: "e1",
		start: 100,
		end: 200,
		calendarId: "cal",
		displayTitle: () => "Standup",
	};
	const renderEvent = (props = {}) =>
		render(<CalendarEvent event={event} scopeStart={0} scopeEnd={1000} {...props} />);

	it("scrolls its own node into view and reports focus when focused", () => {
		const onFocused = vi.fn();
		const { container } = renderEvent({ focused: true, onFocused });
		expect(scrolled).toEqual([container.querySelector(".calendar-event")]);
		expect(onFocused).toHaveBeenCalledWith(event);
	});

	it("does not scroll when not focused", () => {
		renderEvent();
		expect(scrolled).toEqual([]);
	});
});

describe("CalendarEventContainer refs", () => {
	const renderContainer = (onCalendarMouseUp) => {
		const ref = React.createRef();
		const view = render(
			<CalendarEventContainer ref={ref} onCalendarMouseUp={onCalendarMouseUp}>
				<div className="inside">inside</div>
			</CalendarEventContainer>,
		);
		return { ...view, ref, inside: view.container.querySelector(".inside") };
	};

	it("handles a mouseup that lands outside its own node", () => {
		const onCalendarMouseUp = vi.fn();
		const { inside } = renderContainer(onCalendarMouseUp);
		fireEvent.mouseDown(inside);
		const outside = document.createElement("div");
		document.body.appendChild(outside);
		fireEvent.mouseUp(outside);
		expect(onCalendarMouseUp).toHaveBeenCalledOnce();
		outside.remove();
	});

	it("leaves a mouseup inside its own node to its React handler", () => {
		const onCalendarMouseUp = vi.fn();
		const { ref, inside } = renderContainer(onCalendarMouseUp);
		ref.current._mouseIsDown = true;
		ref.current._onWindowMouseUp({ target: inside });
		expect(onCalendarMouseUp).not.toHaveBeenCalled();
	});
});
