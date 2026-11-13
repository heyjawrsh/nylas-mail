import React, { createRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render } from "@testing-library/react";

const m = vi.hoisted(() => ({
	closePopover: vi.fn(),
	queueTask: vi.fn(),
	persistModel: vi.fn(() => Promise.resolve()),
	inTransaction: vi.fn((fn) => Promise.resolve(fn({ persistModel: m.persistModel }))),
	tasks: [],
}));

vi.mock("react", async (importOriginal) => {
	const actual = await importOriginal();
	return { ...actual, default: actual };
});
vi.mock("prop-types", () => {
	const checker = Object.assign(() => null, { isRequired: () => null });
	const types = new Proxy({}, { get: () => checker });
	return { default: types, ...types };
});
vi.mock("moment", async () => {
	const actual = await import("moment-timezone");
	return { ...actual, default: actual.default };
});
vi.mock("nylas-exports", () => {
	class SyncbackEventTask {
		constructor(clientId) { this.clientId = clientId; m.tasks.push(this); }
	}
	const Actions = { closePopover: m.closePopover, queueTask: m.queueTask };
	const DatabaseStore = { inTransaction: m.inTransaction };
	const DateUtils = { timeZone: "America/Chicago" };
	return { default: { Actions, DatabaseStore, DateUtils, SyncbackEventTask }, Actions, DatabaseStore, DateUtils, SyncbackEventTask };
});
vi.mock("nylas-component-kit", () => {
	const DatePicker = ({ value, onChange }) => <button data-testid="date" onClick={() => onChange(value + 86400000)}>{value}</button>;
	const TimePicker = ({ value, onChange }) => <button data-testid="time" onClick={() => onChange(value + 3600000)}>{value}</button>;
	const RetinaImg = ({ name, onClick, className }) => <button data-testid={name} className={className} onClick={onClick}>{name}</button>;
	RetinaImg.Mode = { ContentPreserve: "preserve", ContentIsMask: "mask" };
	const ScrollRegion = ({ children }) => <section data-testid="scroll-region">{children}</section>;
	const TabGroupRegion = ({ children }) => <section data-testid="tab-group">{children}</section>;
	return { default: { DatePicker, RetinaImg, ScrollRegion, TabGroupRegion, TimePicker }, DatePicker, RetinaImg, ScrollRegion, TabGroupRegion, TimePicker };
});
vi.mock("../src/components/nylas-calendar/event-participants-input.jsx", () => ({
	default: ({ participants, change }) => <button data-testid="participant-input" onClick={() => change([...participants, { name: "Cara" }])}>{participants.length}</button>,
}));

const { default: CalendarEventPopover } = await import("../src/components/nylas-calendar/calendar-event-popover.jsx");

afterEach(cleanup);

const event = (overrides = {}) => {
	const clone = {
		clientId: "client-1", when: {},
	};
	return {
		description: "<p>Roadmap</p>", start: 1715781600, end: 1715785200,
		location: "Room 1", participants: [{ name: "Ada" }, { name: "Bob" }],
		displayTitle: () => "Planning", clone: vi.fn(() => clone), cloneResult: clone,
		...overrides,
	};
};

function fixture(overrides = {}) {
	const ref = createRef();
	const model = event(overrides);
	const view = render(<CalendarEventPopover ref={ref} event={model} />);
	return { ...view, ref, model };
}

describe("CalendarEventPopover display", () => {
	beforeEach(() => { vi.clearAllMocks(); m.tasks.length = 0; m.persistModel.mockResolvedValue(undefined); });

	it("renders the event title", () => { expect(fixture().getByText("Planning")).toBeDefined(); });
	it("renders the event location", () => { expect(fixture().getByText("Room 1")).toBeDefined(); });
	it("renders every participant name", () => {
		const f = fixture();
		expect([f.getByText("Ada"), f.getByText("Bob")]).toHaveLength(2);
	});
	it("uses an empty participant list when the model omits it", () => {
		const f = fixture({ participants: null });
		expect(f.queryByText("Ada")).toBeNull();
	});
	it("extracts plain notes from description markup", () => {
		expect(fixture().getByText("Roadmap")).toBeDefined();
	});
	it("formats hour-aligned times without minutes", () => {
		const f = fixture();
		expect(f.ref.current.formatTime(f.ref.current.getStartMoment())).toMatch(/^\d{1,2} (AM|PM)$/);
	});
	it("formats partial-hour times with minutes", () => {
		const f = fixture({ start: 1715782500 });
		expect(f.ref.current.formatTime(f.ref.current.getStartMoment())).toMatch(/:15 (AM|PM)$/);
	});
	it("enters editing mode from the edit icon", () => {
		const f = fixture(); fireEvent.click(f.getByTestId("edit-icon.png"));
		expect(f.getByTestId("tab-group")).toBeDefined();
	});
	it("refreshes state when a new event arrives", () => {
		const f = fixture();
		f.rerender(<CalendarEventPopover ref={f.ref} event={event({ location: "Room 9", displayTitle: () => "Review" })} />);
		expect(f.getByText("Review")).toBeDefined();
	});
});

describe("CalendarEventPopover editing", () => {
	beforeEach(() => { vi.clearAllMocks(); m.tasks.length = 0; m.persistModel.mockResolvedValue(undefined); });

	function editingFixture(overrides) {
		const f = fixture(overrides); fireEvent.click(f.getByTestId("edit-icon.png")); return f;
	}

	it("updates the title field", () => {
		const f = editingFixture(); fireEvent.change(f.container.querySelector("input.title"), { target: { value: "Launch" } });
		expect(f.ref.current.state.title).toBe("Launch");
	});
	it("updates the location field", () => {
		const f = editingFixture(); fireEvent.change(f.container.querySelector("input.location"), { target: { value: "Room 2" } });
		expect(f.ref.current.state.location).toBe("Room 2");
	});
	it("updates participants through the participant input", () => {
		const f = editingFixture(); fireEvent.click(f.getByTestId("participant-input"));
		expect(f.ref.current.state.participants.at(-1).name).toBe("Cara");
	});
	it("updates notes through the description input", () => {
		const f = editingFixture(); const notes = [...f.container.querySelectorAll('input[type="text"]')].at(-1);
		fireEvent.change(notes, { target: { value: "New notes" } });
		expect(f.ref.current.state.description).toBe("New notes");
	});
	it("moves both timestamps to a newly selected day", () => {
		const f = editingFixture(); const duration = f.ref.current.state.end - f.ref.current.state.start;
		fireEvent.click(f.getByTestId("date"));
		expect(f.ref.current.state.end - f.ref.current.state.start).toBe(duration);
	});
	it("moves the end forward when a new start passes it", () => {
		const f = editingFixture({ start: 1715781600, end: 1715783400 });
		fireEvent.click(f.getAllByTestId("time")[0]);
		expect(f.ref.current.state.end).toBeGreaterThan(f.ref.current.state.start);
	});
	it("moves the start backward when a new end precedes it", () => {
		const f = editingFixture();
		act(() => f.ref.current._onChangeEndTime((f.ref.current.state.start - 1800) * 1000));
		expect(f.ref.current.state.start).toBeLessThan(f.ref.current.state.end);
	});
	it("cancel closes the popover", () => {
		const f = editingFixture(); fireEvent.click(f.getByText("Cancel"));
		expect(m.closePopover).toHaveBeenCalledOnce();
	});
	it("persists a cloned event with edited values", async () => {
		const f = editingFixture(); fireEvent.change(f.container.querySelector("input.title"), { target: { value: "Launch" } }); fireEvent.click(f.getByText("Save"));
		await vi.waitFor(() => expect(m.persistModel).toHaveBeenCalledOnce());
		expect(f.model.cloneResult).toMatchObject({ title: "Launch", location: "Room 1", when: { start_time: 1715781600, end_time: 1715785200 } });
	});
	it("queues syncback after persistence", async () => {
		const f = editingFixture(); fireEvent.click(f.getByText("Save"));
		await vi.waitFor(() => expect(m.queueTask).toHaveBeenCalledOnce());
		expect(m.queueTask.mock.calls[0][0].clientId).toBe("client-1");
	});
});

describe("CalendarEventPopover on re-render", () => {
	const edit = (f) => {
		act(() => f.ref.current.onEdit());
		fireEvent.change(f.container.querySelector("input.title"), { target: { value: "Launch" } });
	};

	it("keeps an edit in progress through an unrelated re-render", () => {
		const f = fixture();
		edit(f);
		f.rerender(<CalendarEventPopover ref={f.ref} event={f.model} />);
		expect(f.ref.current.state.title).toBe("Launch");
	});

	it("takes the fields from a new event", () => {
		const f = fixture();
		edit(f);
		f.rerender(<CalendarEventPopover ref={f.ref} event={event({ displayTitle: () => "Retro", location: "Room 9" })} />);
		expect(f.ref.current.state).toMatchObject({ title: "Retro", location: "Room 9" });
	});
});
