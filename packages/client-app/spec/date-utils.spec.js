import { describe, it, expect } from "vitest";
import moment from "moment-timezone";
import DateUtils from "../src/date-utils.js";

describe("DateUtils", () => {
	it("exposes the public helper surface", () => {
		for (const name of [
			"format",
			"utc",
			"minutesFromNow",
			"hoursFromNow",
			"laterToday",
			"tonight",
			"tomorrow",
			"thisWeekend",
			"nextWeek",
			"nextMonth",
			"mediumTimeString",
			"getTimeFormat",
		]) {
			expect(typeof DateUtils[name], name).toBe("function");
		}
	});

	it("relative helpers produce future moment objects (mutating style)", () => {
		const now = moment("2026-08-27 12:00:00");
		const snapshot = now.clone();
		const inTen = DateUtils.minutesFromNow(10, now);
		expect(inTen.diff(snapshot, "minutes")).toBe(10);
		const later = moment("2026-08-27 12:00:00");
		DateUtils.hoursFromNow(2, later);
		expect(later.diff(snapshot, "hours")).toBe(2);
	});

	it("tonight resolves to the evening of the same day", () => {
		const now = moment("2026-08-27 10:00:00");
		const snapshot = now.clone();
		const tonight = DateUtils.tonight(now);
		expect(tonight.diff(snapshot, "hours")).toBe(10); // 10:00 -> 20:00
		expect(tonight.hour()).toBe(20);
		expect(tonight.minute()).toBe(0);
	});

	it("tomorrow is one day ahead at the canonical hour", () => {
		const now = moment("2026-08-27 10:00:00");
		const tomorrow = DateUtils.tomorrow(now.clone());
		expect(tomorrow.date()).toBe(28); // 27th -> 28th at 9am
		expect(tomorrow.hour()).toBe(9);
	});

	it("mediumTimeString renders a human medium date", () => {
		const out = DateUtils.mediumTimeString(new Date("2026-08-27T15:00:00Z"));
		expect(out).toContain("2026");
	});
});
