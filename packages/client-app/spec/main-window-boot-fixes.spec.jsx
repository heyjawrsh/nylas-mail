// Fixes the main window needed before the fixture account's threads could show:
// see the story 13.4 plan (Plan Change Log) for why each one is here.
import fs from "node:fs";
import path from "node:path";
import * as remote from "@electron/remote";
import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import KeyManager from "../src/key-manager.js";
import Thread from "../src/flux/models/thread.js";
import Folder from "../src/flux/models/folder.js";
import EventedIFrame from "../src/components/evented-iframe.jsx";
import FloatingToolbar from "../src/components/contenteditable/floating-toolbar.jsx";

describe("KeyManager without the native keytar", () => {
	afterEach(() => {
		delete remote.dialog.showErrorBox;
		vi.restoreAllMocks();
	});

	it("reads no password, skipping the migration branch and the dialog", () => {
		remote.dialog.showErrorBox = vi.fn();
		const value = KeyManager.getPassword("me@fixture.test.localSync", {
			migrateFromService: "Nylas",
		});
		expect(value).toBeNull();
		expect(remote.dialog.showErrorBox).not.toHaveBeenCalled();
	});

	it("skips a write with a warning instead of pretending it was stored", () => {
		remote.dialog.showErrorBox = vi.fn();
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		KeyManager.replacePassword("me@fixture.test.n1Cloud", "token");
		expect(warn).toHaveBeenCalledWith(expect.stringMatching(/no secure storage backend.*n1Cloud was not stored/));
		expect(KeyManager.getPassword("me@fixture.test.n1Cloud")).toBeNull();
		KeyManager.deletePassword("me@fixture.test.n1Cloud");
		expect(warn).toHaveBeenLastCalledWith(expect.stringMatching(/was not deleted/));
		expect(remote.dialog.showErrorBox).not.toHaveBeenCalled();
	});
});

describe("Model constructor", () => {
	it("copies a thread without assigning its getter-only inAllMail", () => {
		const inbox = new Folder({ id: "f-inbox", accountId: "a1", name: "inbox" });
		const thread = new Thread({ id: "t1", accountId: "a1", categories: [inbox], categoriesType: "folders" });
		expect(thread.inAllMail).toBe(true);
		const copy = new thread.constructor(thread);
		expect(copy.id).toBe("t1");
		expect(copy.categories).toEqual([inbox]);
		expect(copy.inAllMail).toBe(true);
	});
});

describe("EventedIFrame", () => {
	it("constructs and renders an iframe (its constructor called super twice)", () => {
		const ref = { current: null };
		render(<EventedIFrame ref={ref} />);
		expect(ref.current.getDOMNode().tagName).toBe("IFRAME");
	});
});

describe("FloatingToolbar", () => {
	it("compares props with Utils, which it now imports", () => {
		const toolbar = new FloatingToolbar({ extensions: [] });
		expect(() =>
			toolbar.shouldComponentUpdate({ extensions: [] }, toolbar.state),
		).not.toThrow();
	});
});

describe("source wiring", () => {
	const source = (rel) => fs.readFileSync(path.join(__dirname, "..", rel), "utf8");

	it("reads CategoryStore's default export in Account", () => {
		const account = source("src/flux/models/account.js");
		const requires = [...account.matchAll(/nodeRequire\("\.\.\/stores\/category-store\.js"\)(\.default)?/g)];
		expect(requires.length).toBe(3);
		expect(requires.every((m) => m[1] === ".default")).toBe(true);
	});

	it("reads the compat transition group's default export in the activity sidebar", () => {
		const sidebar = source("internal_packages/notifications/lib/sidebar/activity-sidebar.jsx");
		expect(sidebar).toMatch(/css-transition-group-compat\.jsx"\)\.default/);
	});
});
