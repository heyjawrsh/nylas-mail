import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	parseContactsInString: vi.fn(),
	searchContacts: vi.fn(),
	isValidContact: vi.fn(),
	isEqualReact: vi.fn((a, b) => a === b),
	emailRegex: vi.fn(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/),
	writeText: vi.fn(),
	menuAppend: vi.fn(),
	menuPopup: vi.fn(),
	getCurrentWindow: vi.fn(() => ({ id: "calendar-window" })),
}));

vi.mock("nylas-exports", () => {
	class Contact {
		constructor(values) {
			Object.assign(this, values);
		}
	}
	return {
		default: {},
		Contact,
		ContactStore: {
			parseContactsInString: mocks.parseContactsInString,
			searchContacts: mocks.searchContacts,
			isValidContact: mocks.isValidContact,
		},
		RegExpUtils: { emailRegex: mocks.emailRegex },
		Utils: { isEqualReact: mocks.isEqualReact },
	};
});

vi.mock("nylas-component-kit", () => ({
	default: {},
	TokenizingTextField: () => null,
	Menu: { NameEmailItem: (props) => React.createElement("span", null, props.name || props.email) },
	InjectedComponentSet: () => null,
}));

vi.mock("electron", () => ({
	default: { clipboard: { writeText: mocks.writeText } },
	clipboard: { writeText: mocks.writeText },
}));

vi.mock("@electron/remote", () => ({
	default: { clipboard: { writeText: vi.fn() }, remote: { getCurrentWindow: mocks.getCurrentWindow } },
	clipboard: { writeText: vi.fn() },
	remote: {
		Menu: class Menu {
			append(item) { mocks.menuAppend(item); }
			popup(window) { mocks.menuPopup(window); }
		},
		MenuItem: class MenuItem {
			constructor(options) { Object.assign(this, options); }
		},
		getCurrentWindow: mocks.getCurrentWindow,
	},
}));

import { Contact } from "nylas-exports";
import EventParticipantsInput from "../src/components/nylas-calendar/event-participants-input.jsx";

const contact = (email, name = null) => new Contact({ email, name });
const subject = (participants = [], change = vi.fn()) =>
	new EventParticipantsInput({ participants, change });
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("EventParticipantsInput token parsing", () => {
	beforeEach(() => vi.clearAllMocks());

	it("returns no tokens for an empty string without consulting the store", async () => {
		expect(await subject()._tokensForString("")).toEqual([]);
		expect(mocks.parseContactsInString).not.toHaveBeenCalled();
	});

	it("returns contacts parsed by ContactStore", async () => {
		const ada = contact("ada@example.com", "Ada");
		mocks.parseContactsInString.mockResolvedValue([ada]);
		expect(await subject()._tokensForString("Ada <ada@example.com>")).toEqual([ada]);
	});

	it("forwards parsing options to ContactStore", async () => {
		mocks.parseContactsInString.mockResolvedValue([]);
		await subject()._tokensForString("ada", { accountId: "account-1" });
		expect(mocks.parseContactsInString).toHaveBeenCalledWith("ada", { accountId: "account-1" });
	});

	it("turns an unparsed nonempty value into a malformed Contact", async () => {
		mocks.parseContactsInString.mockResolvedValue([]);
		const [result] = await subject()._tokensForString("not an address");
		expect(result).toBeInstanceOf(Contact);
		expect(result).toMatchObject({ email: "not an address", name: null });
	});
});

describe("EventParticipantsInput participant updates", () => {
	beforeEach(() => vi.clearAllMocks());

	it("removes a participant supplied as a Contact", () => {
		const ada = contact("ada@example.com");
		const grace = contact("grace@example.com");
		const change = vi.fn();
		subject([ada, grace], change)._remove([ada]);
		expect(change).toHaveBeenCalledWith([grace]);
	});

	it("removes a participant supplied as an email string", () => {
		const grace = contact("grace@example.com");
		const change = vi.fn();
		subject([contact("ada@example.com"), grace], change)._remove(["ada@example.com"]);
		expect(change).toHaveBeenCalledWith([grace]);
	});

	it("adds Contact values and ignores values of other types", async () => {
		const ada = contact("ada@example.com");
		const grace = contact("grace@example.com");
		const change = vi.fn();
		subject([ada], change)._add([grace, { email: "plain@example.com" }, null]);
		await settle();
		expect(change).toHaveBeenCalledWith([ada, grace]);
	});

	it("does not add the same Contact instance twice", async () => {
		const ada = contact("ada@example.com");
		const change = vi.fn();
		subject([ada], change)._add([ada]);
		await settle();
		expect(change).toHaveBeenCalledWith([ada]);
	});

	it("allows distinct Contact instances that share an email", async () => {
		// Actual behavior: underscore union deduplicates by object identity, not tokenKey/email.
		const first = contact("ada@example.com");
		const second = contact("ada@example.com");
		const change = vi.fn();
		subject([first], change)._add([second]);
		await settle();
		expect(change).toHaveBeenCalledWith([first, second]);
	});

	it("parses string additions before updating participants", async () => {
		const grace = contact("grace@example.com");
		mocks.parseContactsInString.mockResolvedValue([grace]);
		const change = vi.fn();
		subject([], change)._add("Grace <grace@example.com>", { accountId: "a1" });
		await settle();
		expect(mocks.parseContactsInString).toHaveBeenCalledWith(
			"Grace <grace@example.com>", { accountId: "a1" },
		);
		expect(change).toHaveBeenCalledWith([grace]);
	});

	it("replaces an edited token in place", async () => {
		const ada = contact("ada@example.com");
		const old = contact("old@example.com");
		const grace = contact("grace@example.com");
		mocks.parseContactsInString.mockResolvedValue([grace]);
		const change = vi.fn();
		subject([ada, old], change)._edit(old, "grace@example.com");
		await settle();
		expect(change).toHaveBeenCalledWith([ada, grace]);
	});
});

describe("EventParticipantsInput keyboard and menu behavior", () => {
	beforeEach(() => vi.clearAllMocks());

	it("submits a syntactically valid email as the raw input", () => {
		expect(subject()._onInputTrySubmit("ada@example.com", [{ id: 1 }], { id: 2 }))
			.toBe("ada@example.com");
	});

	it("prefers an explicitly selected completion for non-email input", () => {
		const selected = { email: "selected@example.com" };
		expect(subject()._onInputTrySubmit("ada", [{ email: "first@example.com" }], selected))
			.toBe(selected);
	});

	it("falls back to the first completion and then undefined", () => {
		const first = { email: "first@example.com" };
		expect(subject()._onInputTrySubmit("ada", [first])).toBe(first);
		expect(subject()._onInputTrySubmit("ada", [])).toBeUndefined();
	});

	it("breaks on comma and semicolon regardless of input validity", () => {
		const component = subject();
		expect(component._shouldBreakOnKeydown({ key: ",", target: { value: "ada" } })).toBe(true);
		expect(component._shouldBreakOnKeydown({ key: ";", target: { value: "ada" } })).toBe(true);
	});

	it("breaks on space only after a valid trimmed email", () => {
		const component = subject();
		expect(component._shouldBreakOnKeydown({ key: " ", target: { value: " ada@example.com " } })).toBe(true);
		expect(component._shouldBreakOnKeydown({ key: " ", target: { value: "Ada" } })).toBe(false);
	});


	it("updates only when props or state differ by Utils comparison", () => {
		const props = { participants: [], change: vi.fn() };
		const component = new EventParticipantsInput(props);
		component.state = { open: false };
		expect(component.shouldComponentUpdate(props, component.state)).toBe(false);
		expect(component.shouldComponentUpdate({ ...props }, component.state)).toBe(true);
	});
});
