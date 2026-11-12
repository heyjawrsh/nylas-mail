import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const m = vi.hoisted(() => ({
	compose: vi.fn(),
	emailIsEquivalent: vi.fn((left, right) => left.toLowerCase() === right.toLowerCase()),
	menuAppend: vi.fn(),
	menuPopup: vi.fn(),
	menuTemplate: vi.fn(() => [{ label: "Account One" }]),
	openPreferences: vi.fn(),
	shortTimeString: vi.fn(() => "Aug 27"),
	mediumTimeString: vi.fn(() => "Aug 27, 10:30 AM"),
	fullTimeString: vi.fn(() => "Thursday, August 27 at 10:30 AM"),
	switchPreferencesTab: vi.fn(),
	dataSource: vi.fn(),
	ipcSend: vi.fn(),
	buildFromTemplate: vi.fn(),
}));

vi.mock("nylas-exports", () => ({
	default: {
		Actions: { composeNewDraftToRecipient: m.compose, openPreferences: m.openPreferences, switchPreferencesTab: m.switchPreferencesTab },
		Contact: {}, DateUtils: { shortTimeString: m.shortTimeString, mediumTimeString: m.mediumTimeString, fullTimeString: m.fullTimeString },
		Utils: { emailIsEquivalent: m.emailIsEquivalent },
	},
	Actions: { composeNewDraftToRecipient: m.compose, openPreferences: m.openPreferences, switchPreferencesTab: m.switchPreferencesTab },
	Contact: {},
	DateUtils: { shortTimeString: m.shortTimeString, mediumTimeString: m.mediumTimeString, fullTimeString: m.fullTimeString },
	Utils: { emailIsEquivalent: m.emailIsEquivalent },
}));

vi.mock("nylas-component-kit", () => {
	const RetinaImg = (props) => <img alt="Switch accounts" data-name={props.name} />;
	RetinaImg.Mode = { ContentDark: "dark" };
	return { default: { RetinaImg }, RetinaImg };
});

vi.mock("electron", () => {
	class Menu {
		append(item) { m.menuAppend(item); }
		popup(...args) { return m.menuPopup(...args); }
		static buildFromTemplate(template) { return m.buildFromTemplate(template); }
	}
	class MenuItem { constructor(attrs) { Object.assign(this, attrs); } }
	return { default: { ipcRenderer: { send: m.ipcSend }, remote: { Menu, MenuItem } }, ipcRenderer: { send: m.ipcSend }, remote: { Menu, MenuItem } };
});
// The code reads the remote surface from @electron/remote; reuse the electron
// mock's remote so both stay in step.
vi.mock("@electron/remote", async () => {
	const electron = await import("electron");
	const remote = electron.remote ?? electron.default?.remote;
	return { default: remote, ...remote, remote };
});

vi.mock("../internal_packages/account-sidebar/lib/account-commands", () => ({
	default: { menuTemplate: m.menuTemplate }, menuTemplate: m.menuTemplate,
}));

vi.mock("../internal_packages/thread-list/lib/thread-list-store", () => ({
	default: { dataSource: m.dataSource },
}));

import AccountSwitcher from "../internal_packages/account-sidebar/lib/components/account-switcher";
import ThreadListParticipants from "../internal_packages/thread-list/lib/thread-list-participants";
import ThreadListScrollTooltip from "../internal_packages/thread-list/lib/thread-list-scroll-tooltip";
import MessageParticipants from "../internal_packages/message-list/lib/message-participants";
import MessageTimestamp from "../internal_packages/message-list/lib/message-timestamp";

const contact = (name, email, { me = false } = {}) => ({
	name, email,
	isMe: () => me,
	displayName: vi.fn((opts = {}) =>
		opts.compact
			? name.split(" ")[0] || email
			: name || email),
	fullName: vi.fn(() => name),
});

afterEach(cleanup);

beforeEach(() => {
	vi.clearAllMocks();
	globalThis.NylasEnv = { getCurrentWindow: vi.fn(() => "window") };
	m.buildFromTemplate.mockReturnValue({ popup: m.menuPopup });
});

describe("ThreadListParticipants formatting", () => {
	it("renders participant display names from the thread", () => {
		render(<ThreadListParticipants thread={{ participants: [contact("Ada Lovelace", "ada@example.com")] }} />);
		expect(screen.getByText("Ada Lovelace")).toBeDefined();
	});

	it("filters the current user when other participants remain", () => {
		render(<ThreadListParticipants thread={{ participants: [contact("Me", "me@example.com", { me: true }), contact("Grace", "grace@example.com")] }} />);
		expect(screen.queryByText("Me")).toBeNull();
		expect(screen.getByText("Grace")).toBeDefined();
	});

	it("falls back to the first participant when everyone is filtered", () => {
		render(<ThreadListParticipants thread={{ participants: [contact("Me", "me@example.com", { me: true })] }} />);
		expect(screen.getByText("Me")).toBeDefined();
	});

	it("uses email for a nameless contact", () => {
		render(<ThreadListParticipants thread={{ participants: [contact("", "unknown@example.com")] }} />);
		expect(screen.getByText("unknown@example.com")).toBeDefined();
	});

	it("keeps the first and last two contacts when trimming", () => {
		const participants = ["One", "Two", "Three", "Four", "Five"].map((name) => contact(name, `${name}@example.com`));
		render(<ThreadListParticipants thread={{ participants }} />);
		expect(screen.getByText("One...Four, Five")).toBeDefined();
	});

	it("switches to recipients when every message is from me", () => {
		const recipient = contact("Recipient", "to@example.com");
		const thread = { participants: [], __messages: [{ isFromMe: () => true, draft: false, unread: false, from: [], to: [recipient] }] };
		render(<ThreadListParticipants thread={thread} />);
		expect(screen.getByText("Recipient")).toBeDefined();
	});

	it("skips draft messages", () => {
		const thread = { participants: [], __messages: [{ isFromMe: () => false, draft: true, unread: false, from: [contact("Draft", "draft@example.com")], to: [] }] };
		const { container } = render(<ThreadListParticipants thread={thread} />);
		expect(container.querySelector(".participants").textContent).toBe("");
	});

	it("deduplicates adjacent equivalent senders and preserves unread state", () => {
		const first = contact("Ada", "ADA@example.com");
		const second = contact("Ada", "ada@example.com");
		const thread = { participants: [], __messages: [
			{ isFromMe: () => false, draft: false, unread: false, from: [first], to: [] },
			{ isFromMe: () => false, draft: false, unread: true, from: [second], to: [] },
		] };
		const { container } = render(<ThreadListParticipants thread={thread} />);
		expect(container.querySelectorAll("span")).toHaveLength(1);
		expect(container.querySelector("span").className).toBe("unread-true");
	});

	it("appends the message count", () => {
		const sender = contact("Ada", "ada@example.com");
		const message = (unread) => ({ isFromMe: () => false, draft: false, unread, from: [sender], to: [] });
		render(<ThreadListParticipants thread={{ participants: [], __messages: [message(false), message(false)] }} />);
		expect(screen.getByText("Ada (2)")).toBeDefined();
	});
});

describe("ThreadListScrollTooltip math", () => {
	function instance(props = { viewportCenter: 250, totalHeight: 1000 }) {
		const view = new ThreadListScrollTooltip(props);
		view.setState = vi.fn((state) => { view.state = state; });
		return view;
	}

	it("maps the viewport center proportionally to a data-source index", () => {
		const get = vi.fn(() => ({ id: "row-25" }));
		m.dataSource.mockReturnValue({ count: () => 100, get });
		const view = instance();
		view.setupForProps(view.props);
		expect(get).toHaveBeenCalledWith(25);
		expect(view.state.idx).toBe(25);
	});

	it("floors fractional indexes", () => {
		const get = vi.fn();
		m.dataSource.mockReturnValue({ count: () => 9, get });
		const view = instance({ viewportCenter: 199, totalHeight: 1000 });
		view.setupForProps(view.props);
		expect(get).toHaveBeenCalledWith(1);
	});

	it("only updates when the computed index changes", () => {
		const view = instance();
		view.state = { idx: 4 };
		expect(view.shouldComponentUpdate({}, { idx: 4 })).toBe(false);
		expect(view.shouldComponentUpdate({}, { idx: 5 })).toBe(true);
	});

	it("renders Loading when the indexed item is unavailable", () => {
		const view = instance();
		view.state = { idx: 2, item: null };
		render(view.render());
		expect(screen.getByText("Loading...")).toBeDefined();
	});

	it("formats the indexed item's timestamp", () => {
		const date = new Date("2020-01-01T00:00:00Z");
		const view = instance();
		view.state = { idx: 2, item: { lastMessageReceivedTimestamp: date } };
		globalThis.DateUtils = { shortTimeString: m.shortTimeString };
		render(view.render());
		expect(m.shortTimeString).toHaveBeenCalledWith(date);
		expect(screen.getByText("Aug 27")).toBeDefined();
	});
});

describe("AccountSwitcher", () => {
	const props = { accounts: [{ id: "a1" }], sidebarAccountIds: ["a1"] };

	it("renders an accessible account-switcher image", () => {
		render(<AccountSwitcher {...props} />);
		expect(screen.getByRole("img", { name: "Switch accounts" }).getAttribute("data-name")).toBe("account-switcher-dropdown.png");
	});

	it("builds a menu with add and manage commands", () => {
		const view = new AccountSwitcher(props);
		const template = view._makeMenuTemplate();
		expect(m.menuTemplate).toHaveBeenCalledWith(props.accounts, props.sidebarAccountIds, { clickHandlers: true });
		expect(template.map((item) => item.label).filter(Boolean)).toEqual(["Account One", "Add Account...", "Manage Accounts..."]);
	});

	it("sends the sidebar source when adding an account", () => {
		new AccountSwitcher(props)._onAddAccount();
		expect(m.ipcSend).toHaveBeenCalledWith("command", "application:add-account", { source: "Sidebar" });
	});

	it("opens the Accounts preferences tab", () => {
		new AccountSwitcher(props)._onManageAccounts();
		expect(m.switchPreferencesTab).toHaveBeenCalledWith("Accounts");
		expect(m.openPreferences).toHaveBeenCalledOnce();
	});

	it("shows the native menu on mouse down", () => {
		render(<AccountSwitcher {...props} />);
		fireEvent.mouseDown(screen.getByRole("img", { name: "Switch accounts" }).parentElement);
		expect(m.buildFromTemplate).toHaveBeenCalledOnce();
		expect(m.menuPopup).toHaveBeenCalledOnce();
	});
});

describe("message header components", () => {
	it("renders a collapsed sender and combined recipients", () => {
		render(<MessageParticipants from={[contact("Ada", "ada@example.com")]} to={[contact("Grace", "grace@example.com")]} cc={[contact("Linus", "linus@example.com")]} />);
		expect(screen.getByText("Ada")).toBeDefined();
		expect(screen.getByText("Grace, Linus")).toBeDefined();
	});

	it("collapses excess recipients into an and-more label", () => {
		const to = ["A", "B", "C", "D", "E", "F", "G"].map((name) => contact(name, `${name}@example.com`));
		render(<MessageParticipants to={to} />);
		expect(screen.getByText("A, B, C, D, E, and 2 more")).toBeDefined();
	});

	it("renders labeled expanded recipient fields", () => {
		render(<MessageParticipants isDetailed to={[contact("Grace", "grace@example.com")]} bcc={[contact("Linus", "linus@example.com")]} />);
		expect(screen.getByText(/to:/)).toBeDefined();
		expect(screen.getByText(/bcc:/)).toBeDefined();
		expect(screen.getByText("Grace")).toBeDefined();
	});

	it("uses short timestamp text and a full timestamp title", () => {
		const date = new Date("2020-01-01T00:00:00Z");
		render(<MessageTimestamp date={date} />);
		expect(screen.getByText("Aug 27").title).toBe("Thursday, August 27 at 10:30 AM");
		expect(m.shortTimeString).toHaveBeenCalledWith(date);
	});

	it("uses medium timestamp text in detailed mode", () => {
		render(<MessageTimestamp date={new Date()} isDetailed />);
		expect(screen.getByText("Aug 27, 10:30 AM")).toBeDefined();
		expect(m.mediumTimeString).toHaveBeenCalledOnce();
	});
});
