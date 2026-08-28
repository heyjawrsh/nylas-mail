import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import moment from "moment";

vi.mock("nylas-exports", () => ({
	default: {},
	Utils: { hueForString: vi.fn(() => 42) },
}));

import MiniMonthView from "../src/components/nylas-calendar/mini-month-view.jsx";
import MonthView from "../src/components/nylas-calendar/month-view.jsx";

afterEach(cleanup);

const timestamp = (year, month, day) => moment([year, month, day]).valueOf();

describe("MiniMonthView month-grid computations", () => {
	it("derives its displayed year and month from a timestamp", () => {
		expect(new MiniMonthView({ value: timestamp(2024, 6, 4) }).state).toEqual({
			shownYear: 2024, shownMonth: 6,
		});
	});

	it("falls back to the current month for a falsy value", () => {
		// Actual behavior: epoch zero is treated as "no value" by _stateFromProps.
		const now = moment();
		expect(new MiniMonthView({ value: 0 }).state).toEqual({
			shownYear: now.year(), shownMonth: now.month(),
		});
	});

	it("compares both day-of-year and year", () => {
		const component = new MiniMonthView({ value: timestamp(2024, 0, 1) });
		expect(component._isSameDay(moment("2024-01-01"), moment("2024-01-01T23:59"))).toBe(true);
		expect(component._isSameDay(moment("2024-01-01"), moment("2025-01-01"))).toBe(false);
	});

	it("renders seven locale-aware weekday headings", () => {
		const { container } = render(<MiniMonthView value={timestamp(2024, 0, 15)} />);
		expect([...container.querySelectorAll(".weekday")].map((node) => node.textContent))
			.toEqual(["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]);
	});

	it("renders complete week rows around a five-week month", () => {
		const { container } = render(<MiniMonthView value={timestamp(2024, 1, 15)} />);
		expect(container.querySelectorAll(".week")).toHaveLength(5);
		expect(container.querySelectorAll(".day")).toHaveLength(35);
	});

	it("includes adjacent-month cells to fill the grid", () => {
		const { container } = render(<MiniMonthView value={timestamp(2024, 1, 15)} />);
		const days = [...container.querySelectorAll(".day")];
		expect(days[0].textContent).toBe("28");
		expect(days[0].classList.contains("cur-month")).toBe(false);
		expect(days.at(-1).textContent).toBe("2");
	});

	it("marks exactly one selected day even when its number appears in padding", () => {
		const { container } = render(<MiniMonthView value={timestamp(2024, 1, 15)} />);
		const selected = container.querySelectorAll(".cur-day");
		expect(selected).toHaveLength(1);
		expect(selected[0].textContent).toBe("15");
	});

	it("rolls backward across a year boundary", () => {
		render(<MiniMonthView value={timestamp(2024, 0, 15)} />);
		fireEvent.click(screen.getByText("‹"));
		expect(screen.getByText("December 2023")).toBeDefined();
	});

	it("rolls forward across a year boundary", () => {
		render(<MiniMonthView value={timestamp(2024, 11, 15)} />);
		fireEvent.click(screen.getByText("›"));
		expect(screen.getByText("January 2025")).toBeDefined();
	});

	it("reports the exact timestamp stored on a clicked padding day", () => {
		const onChange = vi.fn();
		const { container } = render(
			<MiniMonthView value={timestamp(2024, 1, 15)} onChange={onChange} />,
		);
		const paddingDay = container.querySelector(".day:not(.cur-month)");
		fireEvent.click(paddingDay);
		expect(onChange).toHaveBeenCalledWith(Number(paddingDay.dataset.timestamp));
	});

	it("ignores clicks on the grid wrapper rather than a day", () => {
		const onChange = vi.fn();
		const { container } = render(
			<MiniMonthView value={timestamp(2024, 1, 15)} onChange={onChange} />,
		);
		fireEvent.click(container.querySelector(".day-grid"));
		expect(onChange).not.toHaveBeenCalled();
	});
});

describe("MonthView navigation", () => {
	it("requests WeekView when its button is pressed", () => {
		const changeView = vi.fn();
		render(<MonthView changeView={changeView} />);
		fireEvent.click(screen.getByRole("button", { name: "Change to week" }));
		expect(changeView).toHaveBeenCalledWith("WeekView");
	});
});
