import React from "react";
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	expandInitialSyncState: vi.fn(),
	folderListen: vi.fn(() => vi.fn()),
	perspectiveListen: vi.fn(() => vi.fn()),
	currentPerspective: vi.fn(),
}));

vi.mock("nylas-exports", () => {
	const FolderSyncProgressStore = { listen: mocks.folderListen };
	const FocusedPerspectiveStore = {
		listen: mocks.perspectiveListen,
		current: mocks.currentPerspective,
	};
	return {
		default: { FolderSyncProgressStore, FocusedPerspectiveStore },
		Actions: { expandInitialSyncState: mocks.expandInitialSyncState },
		FolderSyncProgressStore,
		FocusedPerspectiveStore,
	};
});

vi.mock("nylas-component-kit", () => ({
	default: {},
	SyncingListState: ({ empty }) => (
		<div data-testid="kit-syncing">{empty ? "empty sync" : "sync"}</div>
	),
}));

vi.mock("../src/components/retina-img.jsx", () => {
	function RetinaImg({ className, name, mode }) {
		return <img alt={name} className={className} data-mode={mode} />;
	}
	RetinaImg.Mode = { ContentPreserve: "preserve", ContentIsMask: "mask" };
	return { default: RetinaImg };
});

import EmptyListState from "../src/components/empty-list-state.jsx";
import Notification from "../src/components/notification.jsx";
import SyncingListState from "../src/components/syncing-list-state.jsx";

const perspective = (overrides = {}) => ({
	name: "Projects",
	categoriesSharedName: () => "Projects",
	emptyMessage: () => "Nothing here",
	hasSyncingCategories: () => false,
	isArchive: () => false,
	isInbox: () => false,
	...overrides,
});

function renderEmptyListOutput({ visible = true, syncing = false, rect = {} } = {}) {
	const output = EmptyListState.prototype.render.call({
		props: { visible },
		state: { active: true, rect, syncing },
	});
	return render(output);
}

afterEach(cleanup);

beforeEach(() => {
	vi.clearAllMocks();
	NylasEnv.savedState = { dismissedNotificationAsks: {} };
	mocks.currentPerspective.mockReturnValue(perspective());
});

describe("Notification", () => {
	it("renders its title, subtitle, priority, and custom classes", () => {
		const { container } = render(
			<Notification
				className="account-alert"
				isError
				priority="high"
				subtitle="Try again"
				title="Sync failed"
			/>,
		);
		const notification = container.querySelector(".notification");
		expect(notification.className).toContain("error");
		expect(notification.className).toContain("account-alert");
		expect(notification.dataset.priority).toBe("high");
		expect(screen.getByText("Sync failed")).toBeDefined();
		expect(screen.getByText("Try again")).toBeDefined();
	});

	it("omits the actions wrapper when there are no actions", () => {
		const { container } = render(<Notification title="Quiet" />);
		expect(container.querySelector(".actions-wrapper")).toBeNull();
	});

	it("renders an icon in content-preserve mode", () => {
		render(<Notification icon="sync.png" title="Syncing" />);
		const icon = screen.getByAltText("sync.png");
		expect(icon.className).toBe("icon");
		expect(icon.dataset.mode).toBe("preserve");
	});

	it("marks an actionable subtitle and invokes its handler", () => {
		const subtitleAction = vi.fn();
		render(<Notification subtitle="Details" subtitleAction={subtitleAction} />);
		const subtitle = screen.getByText("Details");
		expect(subtitle.className).toContain("has-action");
		fireEvent.click(subtitle);
		expect(subtitleAction).toHaveBeenCalledOnce();
	});

	it("invokes an action with the click event", () => {
		const action = vi.fn();
		render(<Notification actions={[{ label: "Retry", fn: action }]} />);
		fireEvent.click(screen.getByText("Retry"));
		expect(action).toHaveBeenCalledOnce();
		expect(action.mock.calls[0][0].nativeEvent).toBeInstanceOf(MouseEvent);
	});

	it("passes custom action props to the action element", () => {
		render(
			<Notification
				actions={[{ label: "Open", fn: vi.fn(), props: { title: "Open settings" } }]}
			/>,
		);
		expect(screen.getByTitle("Open settings").textContent).toBe("Open");
	});

	it("shows a loading class while an action promise is pending", async () => {
		let resolveAction;
		const pending = new Promise((resolve) => { resolveAction = resolve; });
		render(<Notification actions={[{ label: "Save", fn: () => pending }]} />);
		const action = screen.getByText("Save");
		fireEvent.click(action);
		expect(action.className).toContain("loading");
		await act(async () => {
			resolveAction();
			await pending;
		});
		expect(action.className).not.toContain("loading");
	});

	it("dismisses the notification and records another ask", () => {
		NylasEnv.savedState.dismissedNotificationAsks.upgrade = 2;
		const { container } = render(
			<Notification displayName="upgrade" isDismissable title="Upgrade" />,
		);
		fireEvent.click(screen.getByText("Dismiss"));
		expect(NylasEnv.savedState.dismissedNotificationAsks.upgrade).toBe(3);
		expect(container.firstChild.tagName).toBe("SPAN");
	});

	it("appends Dismiss to the supplied actions array", () => {
		const actions = [{ label: "Keep", fn: vi.fn() }];
		render(<Notification actions={actions} displayName="tip" isDismissable />);
		// The component currently mutates this prop during render.
		expect(actions.map(({ label }) => label)).toEqual(["Keep", "Dismiss"]);
	});

	it("starts hidden after five permanent-dismissal asks", () => {
		NylasEnv.savedState.dismissedNotificationAsks.tip = 5;
		const { container } = render(
			<Notification displayName="tip" isPermanentlyDismissable title="Tip" />,
		);
		expect(container.firstChild.tagName).toBe("SPAN");
		expect(screen.queryByText("Tip")).toBeNull();
	});

	it("offers permanent dismissal after the first ask", () => {
		NylasEnv.savedState.dismissedNotificationAsks.tip = 1;
		const { container } = render(
			<Notification
				displayName="tip"
				isPermanentlyDismissable
				subtitle="Maybe later"
			/>,
		);
		fireEvent.click(screen.getByText("Don't show this again"));
		expect(NylasEnv.savedState.dismissedNotificationAsks.tip).toBe(5);
		expect(container.firstChild.tagName).toBe("SPAN");
	});
});

describe("SyncingListState", () => {
	it("describes a non-empty list sync", () => {
		render(<SyncingListState />);
		expect(screen.getByText(/Looking for more messages/)).toBeDefined();
	});

	it("uses the shorter message for an empty list", () => {
		render(<SyncingListState empty />);
		expect(screen.getByText(/Looking for messages/)).toBeDefined();
		expect(screen.queryByText(/Looking for more messages/)).toBeNull();
	});

	it("renders its centered, full-width structure", () => {
		const { container } = render(<SyncingListState />);
		const state = container.querySelector(".syncing-list-state");
		expect(state.style.width).toBe("100%");
		expect(state.style.textAlign).toBe("center");
		expect(state.querySelector("br")).toBeDefined();
	});

	it("opens sync progress when its link is clicked", () => {
		render(<SyncingListState />);
		fireEvent.click(screen.getByText("Show Progress"));
		expect(mocks.expandInitialSyncState).toHaveBeenCalledOnce();
	});
});

describe("EmptyListState render output", () => {
	it("renders only a placeholder while hidden", () => {
		const { container } = renderEmptyListOutput({ visible: false });
		expect(container.firstChild.tagName).toBe("SPAN");
	});

	it("renders a named perspective icon and its empty message", () => {
		const { container } = renderEmptyListOutput();
		expect(container.querySelector(".empty-state.active")).toBeDefined();
		expect(screen.getByAltText("ic-emptystate-projects.png").dataset.mode).toBe("mask");
		expect(screen.getByText("Nothing here")).toBeDefined();
	});

	it("uses the archive icon for archive perspectives", () => {
		mocks.currentPerspective.mockReturnValue(
			perspective({ categoriesSharedName: () => "All Mail", isArchive: () => true }),
		);
		renderEmptyListOutput();
		expect(screen.getByAltText("ic-emptystate-archive.png")).toBeDefined();
	});

	it("renders syncing content instead of the perspective message", () => {
		renderEmptyListOutput({ syncing: true });
		expect(screen.getByTestId("kit-syncing").textContent).toBe("empty sync");
		expect(screen.queryByText("Nothing here")).toBeNull();
	});

	it("renders inbox-zero content for an empty inbox", () => {
		mocks.currentPerspective.mockReturnValue(perspective({ isInbox: () => true }));
		const { container } = renderEmptyListOutput({ rect: { width: 500 } });
		expect(screen.getByText("Hooray! You’re done.")).toBeDefined();
		expect(container.querySelector("iframe").getAttribute("src")).toMatch(
			/^animations\/inbox-zero\/(gem|oasis|tron|airstrip|galaxy)\//,
		);
		expect(container.querySelector(".animation-wrapper").style.transform).toBe("scale(0.6)");
	});
});
