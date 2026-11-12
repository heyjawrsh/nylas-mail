import fs from "node:fs";
import path from "node:path";
import React from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import TabGroupContext from "../src/components/tab-group-context.js";
import TabGroupRegion from "../src/components/tab-group-region.jsx";
import DatePicker from "../src/components/date-picker.jsx";
import TimePicker from "../src/components/time-picker.jsx";
import { TabGroupContext as KitTabGroupContext } from "nylas-component-kit";

afterEach(cleanup);

let shiftFocus;
beforeEach(() => {
	// The real shiftFocus still walks the DOM through findDOMNode (story 3);
	// these specs only check that the context reaches the region.
	shiftFocus = vi
		.spyOn(TabGroupRegion.prototype, "shiftFocus")
		.mockImplementation(() => {});
});
afterEach(() => {
	shiftFocus.mockRestore();
});

describe("TabGroupContext", () => {
	it("is the same object the component kit exports", () => {
		expect(KitTabGroupContext).toBe(TabGroupContext);
	});

	it("is read through contextType by the src pickers", () => {
		expect(DatePicker.contextType).toBe(TabGroupContext);
		expect(TimePicker.contextType).toBe(TabGroupContext);
		expect(DatePicker.contextTypes).toBeUndefined();
		expect(TimePicker.contextTypes).toBeUndefined();
	});

	it("gives consumers inside a region that region as parentTabGroup", () => {
		let region;
		let picker;
		render(
			<TabGroupRegion
				ref={(value) => {
					region = value;
				}}
			>
				<DatePicker
					ref={(value) => {
						picker = value;
					}}
				/>
			</TabGroupRegion>,
		);
		expect(picker.context.parentTabGroup).toBe(region);
	});

	it("leaves parentTabGroup undefined outside any region", () => {
		let picker;
		render(
			<DatePicker
				ref={(value) => {
					picker = value;
				}}
			/>,
		);
		expect(picker.context.parentTabGroup).toBeUndefined();
	});

	it("keeps the region's own props and children on its div", () => {
		const { container } = render(
			<TabGroupRegion className="composer-inner-wrap">
				<input data-testid="field" />
			</TabGroupRegion>,
		);
		const div = container.firstChild;
		expect(div.className).toBe("composer-inner-wrap");
		expect(div.querySelector("input")).not.toBeNull();
	});
});

describe("Tab in a group", () => {
	const renderPickerInGroup = () =>
		render(
			<TabGroupRegion>
				<input className="before" />
				<DatePicker />
			</TabGroupRegion>,
		);

	it("shifts focus forward when Tab is pressed in the date picker", () => {
		const { container } = renderPickerInGroup();
		fireEvent.keyDown(container.querySelector(".date-picker"), { key: "Tab" });
		expect(shiftFocus).toHaveBeenCalledWith(1);
	});

	it("shifts focus backward on Shift+Tab", () => {
		const { container } = renderPickerInGroup();
		fireEvent.keyDown(container.querySelector(".date-picker"), {
			key: "Tab",
			shiftKey: true,
		});
		expect(shiftFocus).toHaveBeenCalledWith(-1);
	});

	it("moves to the next field when Enter is pressed in the date picker", () => {
		const { container } = renderPickerInGroup();
		fireEvent.keyDown(container.querySelector(".date-picker"), {
			key: "Enter",
		});
		expect(shiftFocus).toHaveBeenCalledWith(1);
	});

	it("moves to the next field when the time picker gets Enter", () => {
		const region = new TabGroupRegion({});
		const picker = new TimePicker({ value: 0, onChange: () => {} });
		picker.context = { parentTabGroup: region };
		picker._onKeyDown({ key: "Enter", preventDefault() {} });
		expect(shiftFocus).toHaveBeenCalledWith(1);
	});
});

describe("internal package consumers", () => {
	// These modules pull in the composer and SimpleMDE, which the spec world
	// can't load, so check their source wiring instead.
	const source = (rel) =>
		fs.readFileSync(path.join(__dirname, "..", rel), "utf8");

	it.each([
		["internal_packages/composer/lib/composer-header.jsx"],
		["internal_packages/composer-markdown/lib/markdown-editor.jsx"],
	])("%s reads TabGroupContext from the kit", (rel) => {
		const text = source(rel);
		expect(text).toMatch(/contextType = TabGroupContext;/);
		expect(text).toMatch(/TabGroupContext,?[\s\S]*?\} from "nylas-component-kit"/);
		expect(text).not.toMatch(/contextTypes/);
	});
});
