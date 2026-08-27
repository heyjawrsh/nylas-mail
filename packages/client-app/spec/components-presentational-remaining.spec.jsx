import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
	const configValues = {};
	globalThis.NylasEnv = {
		savedState: { dismissedNotificationAsks: {} },
		config: {
			get: vi.fn((key) => (key ? configValues[key] : { theme: "dark" })),
			set: vi.fn((key, value) => { configValues[key] = value; }),
			getSchema: vi.fn(() => ({ type: "object" })),
			onDidChange: vi.fn(() => ({ dispose: vi.fn() })),
		},
		reportError: vi.fn(),
		showErrorDialog: vi.fn(),
	};
	return {
		configValues,
		expandInitialSyncState: vi.fn(),
		fetchSingleSignOnURL: vi.fn(),
		openExternal: vi.fn(),
		imageNamed: vi.fn((name) => `/images/${name}`),
		futureDateFromString: vi.fn(),
		formatDate: vi.fn((date, format) => `${format}:${date?.label || ""}`),
		setFocus: vi.fn(),
		setCursorPosition: vi.fn(),
		focused: vi.fn(() => ({ id: "focused" })),
		focusedId: vi.fn(() => "focused"),
		keyboardCursor: vi.fn(() => ({ id: "cursor" })),
		keyboardCursorId: vi.fn(() => "cursor"),
		listen: vi.fn(() => vi.fn()),
		recordUserEvent: vi.fn(),
		authPlugin: vi.fn(() => Promise.resolve()),
	};
});

vi.mock("electron", () => ({ shell: { openExternal: mocks.openExternal } }));
vi.mock("../src/flux/stores/identity-store.js", () => ({
	default: { fetchSingleSignOnURL: mocks.fetchSingleSignOnURL },
}));
vi.mock("nylas-exports", () => ({
	React,
	Actions: {
		expandInitialSyncState: mocks.expandInitialSyncState,
		setFocus: mocks.setFocus,
		setCursorPosition: mocks.setCursorPosition,
		recordUserEvent: mocks.recordUserEvent,
	},
	Utils: {
		imageNamed: mocks.imageNamed,
		fastOmit: (object, keys) => Object.fromEntries(Object.entries(object).filter(([key]) => !keys.includes(key))),
	},
	DateUtils: {
		futureDateFromString: mocks.futureDateFromString,
		format: mocks.formatDate,
	},
	FocusedContentStore: {
		focused: mocks.focused,
		focusedId: mocks.focusedId,
		keyboardCursor: mocks.keyboardCursor,
		keyboardCursorId: mocks.keyboardCursorId,
		listen: mocks.listen,
	},
	NylasAPI: { TimeoutErrorCodes: [408] },
	NylasAPIHelpers: { authPlugin: mocks.authPlugin },
	APIError: class APIError extends Error {},
}));
vi.mock("nylas-component-kit", () => {
	function MockRetinaImg(props) {
		return <img alt={props.name || "plugin icon"} src={props.url} />;
	}
	MockRetinaImg.Mode = { ContentIsMask: "mask" };
	return {
		RetinaImg: MockRetinaImg,
		FluxContainer: ({ children, getStateFromStores }) => React.cloneElement(children, getStateFromStores()),
	};
});
vi.mock("../src/components/table/table.jsx", () => {
	const Cell = ({ children, className, onClick }) => <div className={className} onClick={onClick}>{children}</div>;
	Cell.propTypes = {};
	const Row = ({ children, className }) => <div className={className}>{children}</div>;
	Row.propTypes = { rowIdx: () => null };
	function Table() { return <div />; }
	Table.propTypes = { tableDataSource: () => null };
	return { default: Table, TableCell: Cell, TableRow: Row };
});
vi.mock("../src/components/decorators/compose.js", () => ({ default: (component) => component }));
vi.mock("../src/components/decorators/auto-focuses.jsx", () => ({ default: (component) => component }));
vi.mock("../src/components/decorators/listens-to-movement-keys.jsx", () => ({ default: (component) => component }));

import ConfigPropContainer from "../src/components/config-prop-container.jsx";
import ReactCSSTransitionGroup from "../src/components/css-transition-group-compat.jsx";
import DateInput from "../src/components/date-input.jsx";
import FocusContainer from "../src/components/focus-container.jsx";
import MetadataComposerToggleButton from "../src/components/metadata-composer-toggle-button.jsx";
import Notification from "../src/components/notification.jsx";
import OpenIdentityPageButton from "../src/components/open-identity-page-button.jsx";
import RetinaImg from "../src/components/retina-img.jsx";
import { SelectableTableCell } from "../src/components/selectable-table.jsx";
import SyncingListState from "../src/components/syncing-list-state.jsx";

afterEach(cleanup);

beforeEach(() => {
	vi.clearAllMocks();
	Object.keys(mocks.configValues).forEach((key) => delete mocks.configValues[key]);
	NylasEnv.savedState.dismissedNotificationAsks = {};
	mocks.fetchSingleSignOnURL.mockResolvedValue("https://identity.example.test/account");
});

describe("Notification", () => {
	it("renders title, subtitle, priority, and custom state classes", () => {
		const { container } = render(<Notification title="Update" subtitle="Ready" priority="high" isError className="banner" />);
		expect(screen.getByText("Update")).toBeDefined();
		expect(screen.getByText("Ready")).toBeDefined();
		expect(container.firstChild.className).toContain("error");
		expect(container.firstChild.dataset.priority).toBe("high");
	});

	it("invokes a subtitle action", () => {
		const subtitleAction = vi.fn();
		render(<Notification subtitle="Details" subtitleAction={subtitleAction} />);
		fireEvent.click(screen.getByText("Details"));
		expect(subtitleAction).toHaveBeenCalledOnce();
	});

	it("invokes a supplied action", () => {
		const action = vi.fn();
		render(<Notification actions={[{ label: "Install", fn: action }]} />);
		fireEvent.click(screen.getByText("Install"));
		expect(action).toHaveBeenCalledOnce();
	});

	it("dismisses and records the number of asks", () => {
		const { container } = render(<Notification displayName="upgrade" isDismissable />);
		fireEvent.click(screen.getByText("Dismiss"));
		expect(container.firstChild.tagName).toBe("SPAN");
		expect(NylasEnv.savedState.dismissedNotificationAsks.upgrade).toBe(1);
	});

	it("offers permanent dismissal after a prior dismissal", () => {
		NylasEnv.savedState.dismissedNotificationAsks.upgrade = 1;
		const { container } = render(<Notification displayName="upgrade" subtitle="Later" isPermanentlyDismissable />);
		fireEvent.click(screen.getByText("Don't show this again"));
		expect(NylasEnv.savedState.dismissedNotificationAsks.upgrade).toBe(5);
		expect(container.firstChild.tagName).toBe("SPAN");
	});
});

describe("OpenIdentityPageButton", () => {
	it("renders CTA styling", () => {
		const { container } = render(<OpenIdentityPageButton label="Manage" isCTA />);
		expect(container.firstChild.className).toContain("btn-emphasis");
	});

	it("renders its optional image", () => {
		render(<OpenIdentityPageButton label="Manage" img="account.png" />);
		expect(screen.getByAltText("account.png")).toBeDefined();
	});

	it("requests an SSO URL with attribution and opens it", async () => {
		render(<OpenIdentityPageButton path="/billing" label="Manage" source="settings" campaign="renewal" />);
		fireEvent.click(screen.getByText("Manage"));
		expect(screen.getByText(/Manage…/)).toBeDefined();
		expect(mocks.fetchSingleSignOnURL).toHaveBeenCalledWith("/billing", {
			source: "settings", campaign: "renewal", content: "Manage",
		});
		await vi.waitFor(() => expect(mocks.openExternal).toHaveBeenCalledWith("https://identity.example.test/account"));
	});
});

describe("SyncingListState", () => {
	it("describes loading additional messages", () => {
		render(<SyncingListState />);
		expect(screen.getByText(/Looking for more messages/)).toBeDefined();
	});

	it("describes loading an empty list", () => {
		render(<SyncingListState empty />);
		expect(screen.getByText(/Looking for messages/)).toBeDefined();
	});

	it("expands sync progress", () => {
		render(<SyncingListState />);
		fireEvent.click(screen.getByText("Show Progress"));
		expect(mocks.expandInitialSyncState).toHaveBeenCalledOnce();
	});
});

describe("RetinaImg", () => {
	it("resolves a named image", () => {
		render(<RetinaImg name="archive.png" mode={RetinaImg.Mode.ContentPreserve} />);
		expect(screen.getByAltText("archive.png").getAttribute("src")).toBe("/images/archive.png");
	});

	it("prefers selected image variants", () => {
		render(<RetinaImg name="star.png" selected mode={RetinaImg.Mode.ContentDark} />);
		expect(mocks.imageNamed).toHaveBeenCalledWith("star-selected.png", undefined);
		expect(screen.getByAltText("star.png").className).toContain("content-dark");
	});

	it("uses a direct URL without image lookup", () => {
		render(<RetinaImg url="https://cdn.example.test/icon.png" mode={RetinaImg.Mode.ContentPreserve} />);
		expect(document.querySelector("img").src).toBe("https://cdn.example.test/icon.png");
		expect(mocks.imageNamed).not.toHaveBeenCalled();
	});

	it("configures mask images", () => {
		render(<RetinaImg name="mask.png" mode={RetinaImg.Mode.ContentIsMask} />);
		const image = screen.getByAltText("mask.png");
		expect(image.className).toContain("content-mask");
		expect(image.style.webkitMaskImage).toContain("/images/mask.png");
	});
});

describe("DateInput", () => {
	it("renders its prompt and custom class", () => {
		const { container } = render(<DateInput className="schedule" dateFormat="MMM D" />);
		expect(screen.getByPlaceholderText("Or, 'next Monday at 2PM'")).toBeDefined();
		expect(container.firstChild.className).toContain("schedule");
	});

	it("interprets and formats a valid date", () => {
		const date = { label: "tomorrow", clone: vi.fn(() => ({ copied: true })) };
		mocks.futureDateFromString.mockReturnValue(date);
		const onDateInterpreted = vi.fn();
		render(<DateInput dateFormat="MMM D" onDateInterpreted={onDateInterpreted} />);
		fireEvent.change(screen.getByRole("textbox"), { target: { value: "tomorrow" } });
		expect(onDateInterpreted).toHaveBeenCalledWith({ copied: true }, "tomorrow");
		expect(screen.getByText("MMM D:tomorrow")).toBeDefined();
	});

	it("submits non-empty text on Enter", () => {
		// Real futureDateFromString returns a moment (has .clone); the
		// component calls clone() during change interpretation.
		const date = { label: "Friday", clone() { return this; } };
		mocks.futureDateFromString.mockReturnValue(date);
		const onDateSubmitted = vi.fn();
		render(<DateInput dateFormat="MMM D" onDateSubmitted={onDateSubmitted} />);
		const input = screen.getByRole("textbox");
		fireEvent.change(input, { target: { value: "Friday" } });
		act(() => {
			fireEvent.keyDown(input, { key: "Enter" });
		});
		expect(onDateSubmitted).toHaveBeenCalledWith(date, "Friday");
	});
});

describe("ConfigPropContainer", () => {
	function Child({ config, configSchema }) {
		return <button onClick={() => config.toggle("enabled")}>{configSchema.type}</button>;
	}

	it("injects config and schema into its child", () => {
		render(<ConfigPropContainer><Child /></ConfigPropContainer>);
		expect(screen.getByText("object")).toBeDefined();
		expect(NylasEnv.config.getSchema).toHaveBeenCalledWith("core");
	});

	it("provides a config toggle mutator", () => {
		mocks.configValues.enabled = false;
		render(<ConfigPropContainer><Child /></ConfigPropContainer>);
		fireEvent.click(screen.getByText("object"));
		expect(NylasEnv.config.set).toHaveBeenCalledWith("enabled", true);
	});
});

describe("FocusContainer", () => {
	it("injects focused and keyboard cursor state", () => {
		function Child(props) { return <div>{props.focused.id}:{props.keyboardCursor.id}</div>; }
		render(<FocusContainer collection="thread"><Child /></FocusContainer>);
		expect(screen.getByText("focused:cursor")).toBeDefined();
	});

	it("injects collection-scoped focus callbacks", () => {
		function Child({ onFocusItem, onSetCursorPosition }) {
			return <button onClick={() => { onFocusItem({ id: "a" }); onSetCursorPosition({ id: "b" }); }}>Move</button>;
		}
		render(<FocusContainer collection="thread"><Child /></FocusContainer>);
		fireEvent.click(screen.getByText("Move"));
		expect(mocks.setFocus).toHaveBeenCalledWith({ collection: "thread", item: { id: "a" } });
		expect(mocks.setCursorPosition).toHaveBeenCalledWith({ collection: "thread", item: { id: "b" } });
	});
});

describe("ReactCSSTransitionGroup", () => {
	it("renders its single child and wrapper class", () => {
		const { container } = render(<ReactCSSTransitionGroup transitionName="fade" className="wrap"><div>Notice</div></ReactCSSTransitionGroup>);
		expect(screen.getByText("Notice")).toBeDefined();
		expect(container.firstChild.className).toContain("wrap");
	});

	it("renders no transition child when several are supplied", () => {
		const { container } = render(<ReactCSSTransitionGroup transitionName="fade"><i>A</i><i>B</i></ReactCSSTransitionGroup>);
		// The compatibility wrapper intentionally drops anything other than one child.
		expect(container.querySelectorAll("i")).toHaveLength(0);
	});
});

describe("SelectableTableCell", () => {
	const tableDataSource = { rows: () => [["a"], ["b"]], cellAt: () => "a" };

	it("marks a selected cell", () => {
		const { container } = render(<SelectableTableCell tableDataSource={tableDataSource} rowIdx={0} colIdx={0} selection={{ rowIdx: 0, colIdx: 0 }} onSetSelection={() => {}}>Cell</SelectableTableCell>);
		expect(container.firstChild.className).toContain("selected");
	});

	it("reports a clicked cell coordinate", () => {
		const onSetSelection = vi.fn();
		render(<SelectableTableCell tableDataSource={tableDataSource} rowIdx={1} colIdx={2} onSetSelection={onSetSelection}>Cell</SelectableTableCell>);
		fireEvent.click(screen.getByText("Cell"));
		expect(onSetSelection).toHaveBeenCalledWith({ rowIdx: 1, colIdx: 2, key: null });
	});

});

describe("MetadataComposerToggleButton", () => {
	const makeProps = (value = null) => ({
		title: (enabled) => enabled ? "Disable plugin" : "Enable plugin",
		iconName: "plugin.png", pluginId: "calendar", pluginName: "Calendar",
		metadataEnabledValue: { enabled: true }, errorMessage: () => "Failed",
		draft: { accountId: "account-1", metadataForPluginId: vi.fn(() => value) },
		session: { changes: { addPluginMetadata: vi.fn() } },
	});

	it("renders enabled state from matching metadata", () => {
		mocks.configValues["plugins.calendar.defaultOn"] = false;
		const { container } = render(<MetadataComposerToggleButton {...makeProps({ enabled: true })} />);
		expect(container.querySelector("button").className).toContain("btn-enabled");
		expect(screen.getByTitle("Disable plugin")).toBeDefined();
	});

	it("authenticates and enables metadata when clicked", async () => {
		mocks.configValues["plugins.calendar.defaultOn"] = false;
		const props = makeProps();
		render(<MetadataComposerToggleButton {...props} />);
		fireEvent.click(screen.getByTitle("Enable plugin"));
		expect(mocks.recordUserEvent).toHaveBeenCalledWith("Calendar Enabled");
		await vi.waitFor(() => expect(props.session.changes.addPluginMetadata).toHaveBeenCalledWith("calendar", { enabled: true }));
	});
});
