import fs from "node:fs";
import { createRequire } from "node:module";
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

// Most specs here only check that the context reaches the region, so they
// stub shiftFocus. "shiftFocus moves focus" runs the real one.
let shiftFocus;
const stubShiftFocus = () => {
	beforeEach(() => {
		shiftFocus = vi
			.spyOn(TabGroupRegion.prototype, "shiftFocus")
			.mockImplementation(() => {});
	});
	afterEach(() => {
		shiftFocus.mockRestore();
	});
};

describe("TabGroupContext", () => {
	stubShiftFocus();
	it("is the context the spec kit stub exports", () => {
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
	stubShiftFocus();
	// Tab is handled by the region's own onKeyDown, so these cover the region.
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
});

describe("Enter in a group reaches the region through context", () => {
	stubShiftFocus();
	const renderInRegion = (child) => {
		let region;
		const result = render(
			<TabGroupRegion
				ref={(value) => {
					region = value;
				}}
			>
				{child}
			</TabGroupRegion>,
		);
		return { ...result, region };
	};

	it("date picker calls shiftFocus(1) on its region", () => {
		const { container, region } = renderInRegion(<DatePicker />);
		fireEvent.keyDown(container.querySelector(".date-picker"), {
			key: "Enter",
		});
		expect(shiftFocus).toHaveBeenCalledOnce();
		expect(shiftFocus).toHaveBeenCalledWith(1);
		expect(shiftFocus.mock.contexts[0]).toBe(region);
	});

	it("time picker calls shiftFocus(1) on its region", () => {
		const { container, region } = renderInRegion(
			<TimePicker value={0} onChange={() => {}} />,
		);
		fireEvent.keyDown(container.querySelector("input"), { key: "Enter" });
		expect(shiftFocus).toHaveBeenCalledOnce();
		expect(shiftFocus).toHaveBeenCalledWith(1);
		expect(shiftFocus.mock.contexts[0]).toBe(region);
	});
});

describe("shiftFocus moves focus through the region's own DOM", () => {
	const renderFields = () =>
		render(
			<TabGroupRegion>
				<input className="first" />
				<input className="skipped" tabIndex={-1} />
				<textarea className="second" />
				<TimePicker value={0} onChange={() => {}} />
			</TabGroupRegion>,
		);

	it("moves focus to the next focusable node on Tab", () => {
		const { container } = renderFields();
		const first = container.querySelector(".first");
		first.focus();
		fireEvent.keyDown(first, { key: "Tab" });
		expect(document.activeElement).toBe(container.querySelector(".second"));
	});

	it("skips nodes with tabIndex -1 and reaches the time picker input", () => {
		const { container } = renderFields();
		const second = container.querySelector(".second");
		second.focus();
		fireEvent.keyDown(second, { key: "Tab" });
		expect(document.activeElement).toBe(
			container.querySelector("input.time-picker"),
		);
	});

	it("wraps to the last node on Shift+Tab from the first", () => {
		const { container } = renderFields();
		const first = container.querySelector(".first");
		first.focus();
		fireEvent.keyDown(first, { key: "Tab", shiftKey: true });
		expect(document.activeElement).toBe(
			container.querySelector("input.time-picker"),
		);
	});

	it("does nothing once the region has unmounted", () => {
		let region;
		const view = render(
			<TabGroupRegion
				ref={(value) => {
					if (value) region = value;
				}}
			>
				<input />
			</TabGroupRegion>,
		);
		view.unmount();
		expect(() => region.shiftFocus(1)).not.toThrow();
	});
});

describe("component kit registration", () => {
	// The real kit's registration pass, which vitest normally skips.
	const KitClass = globalThis.NylasComponentKitClass;

	it("exposes the tab-group context module as TabGroupContext", () => {
		const requireFrom = vi
			.spyOn(KitClass, "requireFrom")
			.mockImplementation(() => {});
		KitClass.initClass();
		requireFrom.mockRestore();
		const kit = new KitClass();
		const fromKit = kit.TabGroupContext;
		expect(fromKit.$$typeof).toBe(Symbol.for("react.context"));
		expect(fromKit.displayName).toBe("TabGroupContext");
		// The kit loads modules with Node's require, a separate graph from
		// vitest's imports, so compare against Node's copy of the module.
		const nodeRequire = createRequire(import.meta.url);
		const nodeModule = nodeRequire("../src/components/tab-group-context.js");
		expect(fromKit).toBe(nodeModule.default ?? nodeModule);
		expect(kit.TabGroupContext).toBe(fromKit);
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
