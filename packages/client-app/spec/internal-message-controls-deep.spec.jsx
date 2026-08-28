import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const m = vi.hoisted(() => ({
	accountForId: vi.fn((id) => ({ id })),
	composeForward: vi.fn((args) => args),
	composeReply: vi.fn((args) => args),
	menuAppend: vi.fn(),
	menuPopup: vi.fn(),
	requestRun: vi.fn(() => Promise.resolve("raw message")),
	stopPropagation: vi.fn(),
	toggleStarredThreads: vi.fn(),
	writeFile: vi.fn((_path, _body, callback) => callback()),
	writeText: vi.fn(),
	windowLoadURL: vi.fn(),
}));

vi.mock("nylas-exports", () => {
	class NylasAPIRequest {
		constructor(args) { this.args = args; NylasAPIRequest.instances.push(this); }
		run() { return m.requestRun(); }
		static instances = [];
	}
	const Actions = {
		composeForward: m.composeForward,
		composeReply: m.composeReply,
		toggleStarredThreads: m.toggleStarredThreads,
	};
	const value = {
		Actions,
		AccountStore: { accountForId: m.accountForId },
		NylasAPI: { name: "api" },
		NylasAPIRequest,
	};
	return { default: value, ...value };
});

vi.mock("nylas-component-kit", () => {
	const RetinaImg = ({ name, selected }) => <span data-image={name} data-selected={String(Boolean(selected))} />;
	RetinaImg.Mode = { ContentIsMask: "mask" };
	const ButtonDropdown = ({ primaryItem, primaryTitle, primaryClick, menu }) => (
		<div>
			<button title={primaryTitle} onClick={primaryClick}>{primaryItem}</button>
			{menu}
		</div>
	);
	const Menu = ({ items, itemKey, itemContent, onSelect }) => (
		<div data-testid="dropdown-menu">
			{items.map((item) => <button key={itemKey(item)} onClick={() => onSelect(item)}>{itemContent(item)}</button>)}
		</div>
	);
	const value = { RetinaImg, ButtonDropdown, Menu };
	return { default: value, ...value };
});

vi.mock("electron", () => {
	class Menu {
		constructor() { this.items = []; Menu.instances.push(this); }
		append(item) { this.items.push(item); m.menuAppend(item); }
		popup(window) { return m.menuPopup(window); }
		static instances = [];
	}
	class MenuItem { constructor(attrs) { Object.assign(this, attrs); } }
	class BrowserWindow {
		constructor(options) { this.options = options; BrowserWindow.instances.push(this); }
		loadURL(url) { return m.windowLoadURL(url); }
		static instances = [];
	}
	const value = {
		clipboard: { writeText: m.writeText },
		remote: {
			Menu, MenuItem, BrowserWindow,
			app: { getPath: vi.fn(() => "/tmp") },
			getCurrentWindow: vi.fn(() => "current-window"),
		},
	};
	return { default: value, ...value };
});

vi.mock("node:fs", () => ({ default: { writeFile: m.writeFile }, writeFile: m.writeFile }));

import MessageControlsInterop from "../internal_packages/message-list/lib/message-controls.jsx";
import StarButtonInterop from "../internal_packages/message-list/lib/thread-star-button.jsx";
import { NylasAPIRequest } from "nylas-exports";
import electron from "electron";

// message-controls is CommonJS with top-level require bindings; Vitest exposes it as the default export.
const MessageControls = MessageControlsInterop.default || MessageControlsInterop;
const StarButton = StarButtonInterop.default || StarButtonInterop;

const makeProps = (overrides = {}) => ({
	thread: { serverId: "thread-server", pluginMetadata: { thread: true } },
	message: {
		id: "local-message", serverId: "message-server", accountId: "account-1",
		subject: "A subject", pluginMetadata: { message: true },
		canReplyAll: vi.fn(() => true),
	},
	...overrides,
});

afterEach(cleanup);

beforeEach(() => {
	vi.clearAllMocks();
	NylasAPIRequest.instances.length = 0;
	electron.remote.Menu.instances.length = 0;
	electron.remote.BrowserWindow.instances.length = 0;
	globalThis.Actions = { toggleStarredThreads: m.toggleStarredThreads };
	globalThis.NylasEnv.config.get.mockReturnValue("reply");
});

describe("MessageControls", () => {
	it("uses Reply as the primary action by default", () => {
		render(<MessageControls {...makeProps()} />);
		expect(screen.getByTitle("Reply")).toBeDefined();
	});

	it("uses Reply All as the configured primary action", () => {
		globalThis.NylasEnv.config.get.mockReturnValue("reply-all");
		render(<MessageControls {...makeProps()} />);
		expect(screen.getByTitle("Reply All")).toBeDefined();
	});

	it("does not offer Reply All when the message cannot reply all", () => {
		const props = makeProps();
		props.message.canReplyAll.mockReturnValue(false);
		render(<MessageControls {...props} />);
		expect(screen.queryByText("Reply All")).toBeNull();
		expect(screen.getByText("Forward")).toBeDefined();
	});

	it("reads the reply preference from the expected config key", () => {
		new MessageControls(makeProps())._items();
		expect(globalThis.NylasEnv.config.get).toHaveBeenCalledWith("core.sending.defaultReplyType");
	});





	it("builds three system actions from the ellipsis", () => {
		const { container } = render(<MessageControls {...makeProps()} />);
		fireEvent.click(container.querySelector(".message-actions-ellipsis"));
		expect(electron.remote.Menu.instances[0].items.map((item) => item.label)).toEqual([
			"Log Data", "Show Original", "Copy Debug Info to Clipboard",
		]);
	});

	it("opens the system action menu for the current window", () => {
		const { container } = render(<MessageControls {...makeProps()} />);
		fireEvent.click(container.querySelector(".message-actions-ellipsis"));
		expect(m.menuPopup).toHaveBeenCalledWith("current-window");
	});

	it("logs and exposes message data for debugging", () => {
		const props = makeProps();
		const log = vi.spyOn(console, "log").mockImplementation(() => {});
		new MessageControls(props)._onLogData();
		expect(window.__message).toBe(props.message);
		expect(window.__thread).toBe(props.thread);
		expect(log).toHaveBeenCalledWith(props.message);
		log.mockRestore();
	});




});

describe("StarButton", () => {
	it("titles an unstarred icon button Add star", () => {
		render(<StarButton thread={{ starred: false }} />);
		expect(screen.getByTitle("Add star")).toBeDefined();
	});

	it("titles a starred icon button Remove star", () => {
		render(<StarButton thread={{ starred: true }} />);
		expect(screen.getByTitle("Remove star")).toBeDefined();
	});

	it("marks the star image selected from thread state", () => {
		const { container } = render(<StarButton thread={{ starred: true }} />);
		expect(container.querySelector('[data-image="toolbar-star.png"]').dataset.selected).toBe("true");
	});

	it("treats a missing thread as unstarred while rendering", () => {
		render(<StarButton />);
		expect(screen.getByTitle("Add star")).toBeDefined();
	});

	it("toggles the supplied thread from the toolbar source", () => {
		const thread = { starred: false };
		render(<StarButton thread={thread} />);
		fireEvent.click(screen.getByTitle("Add star"));
		expect(m.toggleStarredThreads).toHaveBeenCalledWith({ source: "Toolbar Button: Message List", threads: [thread] });
	});

	it("stops the star click from propagating", () => {
		const view = new StarButton({ thread: { starred: false } });
		view._onStarToggle({ stopPropagation: m.stopPropagation });
		expect(m.stopPropagation).toHaveBeenCalledOnce();
	});
});
