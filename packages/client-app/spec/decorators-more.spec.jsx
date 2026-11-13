import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	closePopover: vi.fn(),
	destroyDraft: vi.fn(),
	nodeIsVisible: vi.fn(() => true),
	openPopover: vi.fn(),
	sessionForClientId: vi.fn(),
	topSheet: vi.fn(() => ({ id: "top" })),
	waitFor: vi.fn((callback) => Promise.resolve(callback())),
	workspaceListen: vi.fn(() => vi.fn()),
}));

vi.mock("nylas-exports", () => ({
	Actions: {
		closePopover: mocks.closePopover,
		openPopover: mocks.openPopover,
	},
	DOMUtils: { nodeIsVisible: mocks.nodeIsVisible },
	WorkspaceStore: {
		listen: mocks.workspaceListen,
		topSheet: mocks.topSheet,
	},
}));

vi.mock("nylas-store", () => ({
	default: class NylasStore {
		listeners = [];

		listen(callback) {
			this.listeners.push(callback);
			return () => {
				this.listeners = this.listeners.filter((listener) => listener !== callback);
			};
		}

		trigger() {
			this.listeners.forEach((listener) => listener());
		}
	},
}));

vi.mock("../src/flux/stores/draft-store.js", () => ({
	default: { sessionForClientId: mocks.sessionForClientId },
}));

vi.mock("../src/flux/actions.js", () => ({
	default: { destroyDraft: mocks.destroyDraft },
}));

vi.mock("../src/flux/models/utils.js", () => ({
	default: { waitFor: mocks.waitFor },
}));

import HasTutorialTip from "../src/components/decorators/has-tutorial-tip.jsx";
import ListensToFluxStore from "../src/components/decorators/listens-to-flux-store.jsx";
import ListensToObservable from "../src/components/decorators/listens-to-observable.jsx";
import InflatesDraftClientId from "../src/decorators/inflates-draft-client-id.jsx";

class Probe extends React.Component {
	static displayName = "DecoratorsMoreProbe";
	static containerRequired = true;
	static containerStyles = { flex: 1 };

	focus = vi.fn(() => "focused");

	_button = React.createRef();

	getDOMNode() {
		return this._button.current;
	}

	render() {
		return (
			<button ref={this._button} type="button" data-extra={this.props.extra} onClick={this.props.onClick}>
				{this.props.label || this.props.draft?.subject || "probe"}
			</button>
		);
	}
}

function makeSession(draft = { subject: "First draft", pristine: false }) {
	let listener;
	return {
		changes: { commit: vi.fn() },
		draft: vi.fn(() => draft),
		draftClientId: "client-a",
		listen: vi.fn((callback) => {
			listener = callback;
			return vi.fn();
		}),
		emit: () => listener?.(),
	};
}

afterEach(() => {
	cleanup();
	document.querySelectorAll("[data-tooltips-anchor]").forEach((node) => node.remove());
	vi.useRealTimers();
});

describe("ListensToFluxStore", () => {
	let listeners;
	let stores;

	beforeEach(() => {
		listeners = [];
		stores = [0, 1].map(() => ({
			listen: vi.fn((callback) => {
				listeners.push(callback);
				return vi.fn();
			}),
		}));
	});

	it("renders state derived from the initial props", () => {
		const Decorated = ListensToFluxStore(Probe, {
			stores,
			getStateFromStores: ({ name }) => ({ label: `Hello ${name}` }),
		});
		render(<Decorated name="Ada" />);
		expect(screen.getByRole("button", { name: "Hello Ada" })).toBeDefined();
	});

	it("subscribes to every configured store", () => {
		const Decorated = ListensToFluxStore(Probe, { stores, getStateFromStores: () => ({}) });
		render(<Decorated />);
		expect(stores[0].listen).toHaveBeenCalledOnce();
		expect(stores[1].listen).toHaveBeenCalledOnce();
	});

	it("refreshes derived props after a store notification", () => {
		let value = "before";
		const Decorated = ListensToFluxStore(Probe, {
			stores,
			getStateFromStores: () => ({ label: value }),
		});
		render(<Decorated />);
		value = "after";
		React.act(() => listeners[1]());
		expect(screen.getByRole("button", { name: "after" })).toBeDefined();
	});

	it("lets store-derived state override a colliding caller prop", () => {
		const Decorated = ListensToFluxStore(Probe, {
			stores,
			getStateFromStores: () => ({ label: "from store" }),
		});
		// This decorator intentionally spreads derived state after caller props.
		render(<Decorated label="from caller" />);
		expect(screen.getByRole("button", { name: "from store" })).toBeDefined();
	});

	it("keeps non-colliding caller props", () => {
		const onClick = vi.fn();
		const Decorated = ListensToFluxStore(Probe, {
			stores,
			getStateFromStores: () => ({ label: "merged" }),
		});
		render(<Decorated extra="caller-extra" onClick={onClick} />);
		const button = screen.getByRole("button", { name: "merged" });
		expect(button.dataset.extra).toBe("caller-extra");
		fireEvent.click(button);
		expect(onClick).toHaveBeenCalledOnce();
	});

	it("recomputes derived state when caller props change", () => {
		const derive = vi.fn(({ label }) => ({ label: label.toUpperCase() }));
		const Decorated = ListensToFluxStore(Probe, { stores, getStateFromStores: derive });
		const view = render(<Decorated label="first" />);
		view.rerender(<Decorated label="second" />);
		expect(screen.getByRole("button", { name: "SECOND" })).toBeDefined();
	});

	it("unsubscribes from every store on unmount", () => {
		const unlisteners = [vi.fn(), vi.fn()];
		stores.forEach((store, index) => store.listen.mockImplementation(() => unlisteners[index]));
		const Decorated = ListensToFluxStore(Probe, { stores, getStateFromStores: () => ({}) });
		const view = render(<Decorated />);
		view.unmount();
		expect(unlisteners[0]).toHaveBeenCalledOnce();
		expect(unlisteners[1]).toHaveBeenCalledOnce();
	});
});

describe("ListensToObservable", () => {
	it("passes the current caller props to initial state derivation", () => {
		const derive = vi.fn((_data, context) => ({ label: context.props.label }));
		const Decorated = ListensToObservable(Probe, {
			getObservable: () => ({ subscribe: () => ({ dispose: vi.fn() }) }),
			getStateFromObservable: derive,
		});
		render(<Decorated label="caller" />);
		expect(derive).toHaveBeenCalledWith(null, { props: expect.objectContaining({ label: "caller" }) });
	});

	it("merges emission state while preserving unrelated caller props", () => {
		let emit;
		const Decorated = ListensToObservable(Probe, {
			getObservable: () => ({ subscribe: (callback) => { emit = callback; return { dispose: vi.fn() }; } }),
			getStateFromObservable: (value) => ({ label: value || "initial" }),
		});
		render(<Decorated extra="kept" />);
		React.act(() => emit("emitted"));
		const button = screen.getByRole("button", { name: "emitted" });
		expect(button.dataset.extra).toBe("kept");
	});

	it("lets caller props override colliding observable state", () => {
		let emit;
		const Decorated = ListensToObservable(Probe, {
			getObservable: () => ({ subscribe: (callback) => { emit = callback; return { dispose: vi.fn() }; } }),
			getStateFromObservable: (value) => ({ label: value || "initial" }),
		});
		render(<Decorated label="caller wins" />);
		React.act(() => emit("observable"));
		expect(screen.getByRole("button", { name: "caller wins" })).toBeDefined();
	});

	it("ignores an emission after it has unmounted", () => {
		let emit;
		const derive = vi.fn(() => ({ label: "value" }));
		const Decorated = ListensToObservable(Probe, {
			getObservable: () => ({ subscribe: (callback) => { emit = callback; return { dispose: vi.fn() }; } }),
			getStateFromObservable: derive,
		});
		const view = render(<Decorated />);
		view.unmount();
		emit("late");
		expect(derive).toHaveBeenCalledTimes(1);
	});
});

describe("InflatesDraftClientId", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("renders a placeholder before the draft session resolves", () => {
		mocks.sessionForClientId.mockReturnValue(new Promise(() => {}));
		const Decorated = InflatesDraftClientId(Probe);
		const { container } = render(<Decorated draftClientId="client-a" />);
		expect(container.querySelector("span")).not.toBeNull();
	});

	it("does not request a session without a client id", () => {
		const Decorated = InflatesDraftClientId(Probe);
		render(<Decorated />);
		expect(mocks.sessionForClientId).not.toHaveBeenCalled();
	});

	it("renders the resolved draft and calls onDraftReady", async () => {
		const session = makeSession();
		mocks.sessionForClientId.mockResolvedValue(session);
		const onDraftReady = vi.fn();
		const Decorated = InflatesDraftClientId(Probe);
		render(<Decorated draftClientId="client-a" onDraftReady={onDraftReady} />);
		expect(await screen.findByRole("button", { name: "First draft" })).toBeDefined();
		expect(onDraftReady).toHaveBeenCalledOnce();
	});

	it("refreshes the rendered draft when its session emits", async () => {
		const first = { subject: "First draft", pristine: false };
		const second = { subject: "Changed draft", pristine: false };
		const session = makeSession(first);
		mocks.sessionForClientId.mockResolvedValue(session);
		const Decorated = InflatesDraftClientId(Probe);
		render(<Decorated draftClientId="client-a" />);
		await screen.findByRole("button", { name: "First draft" });
		session.draft.mockReturnValue(second);
		React.act(() => session.emit());
		expect(screen.getByRole("button", { name: "Changed draft" })).toBeDefined();
	});

	it("ignores a session that resolves after unmount", async () => {
		let resolveSession;
		mocks.sessionForClientId.mockReturnValue(new Promise((resolve) => { resolveSession = resolve; }));
		const onDraftReady = vi.fn();
		const Decorated = InflatesDraftClientId(Probe);
		const view = render(<Decorated draftClientId="client-a" onDraftReady={onDraftReady} />);
		view.unmount();
		await React.act(async () => resolveSession(makeSession()));
		expect(onDraftReady).not.toHaveBeenCalled();
	});

	it("commits and unsubscribes from the active session on unmount", async () => {
		const session = makeSession();
		const unlisten = vi.fn();
		session.listen.mockReturnValue(unlisten);
		mocks.sessionForClientId.mockResolvedValue(session);
		const Decorated = InflatesDraftClientId(Probe);
		const view = render(<Decorated draftClientId="client-a" />);
		await screen.findByRole("button", { name: "First draft" });
		view.unmount();
		expect(session.changes.commit).toHaveBeenCalledOnce();
		expect(unlisten).toHaveBeenCalledOnce();
	});

	it("destroys a pristine draft on unmount", async () => {
		const session = makeSession({ subject: "Empty draft", pristine: true });
		mocks.sessionForClientId.mockResolvedValue(session);
		const Decorated = InflatesDraftClientId(Probe);
		const view = render(<Decorated draftClientId="client-a" />);
		await screen.findByRole("button", { name: "Empty draft" });
		view.unmount();
		expect(mocks.destroyDraft).toHaveBeenCalledWith("client-a");
	});

	it("preserves a non-pristine draft on unmount", async () => {
		const session = makeSession({ subject: "Written draft", pristine: false });
		mocks.sessionForClientId.mockResolvedValue(session);
		const Decorated = InflatesDraftClientId(Probe);
		const view = render(<Decorated draftClientId="client-a" />);
		await screen.findByRole("button", { name: "Written draft" });
		view.unmount();
		expect(mocks.destroyDraft).not.toHaveBeenCalled();
	});
});

describe("HasTutorialTip render behavior", () => {
	let anchor;
	// Renders inside the tooltip anchor, the way a toolbar button sits in a
	// [data-tooltips-anchor] region in the app.
	const renderInAnchor = (element) =>
		render(element, { container: anchor.appendChild(document.createElement("div")) });

	beforeEach(() => {
		vi.clearAllMocks();
		mocks.nodeIsVisible.mockReturnValue(true);
		mocks.topSheet.mockReturnValue({ id: "top" });
		mocks.workspaceListen.mockImplementation(() => vi.fn());
		NylasEnv.config.get.mockReturnValue([]);
		NylasEnv.config.pushAtKeyPath = vi.fn();
		NylasEnv.themes = { onDidChangeActiveThemes: vi.fn(() => ({ dispose: vi.fn() })) };
		window.requestAnimationFrame = vi.fn((callback) => { callback(); return 1; });
		anchor = document.createElement("section");
		anchor.dataset.tooltipsAnchor = "true";
		anchor.innerHTML = '<div class="tooltips-container"></div>';
		document.body.appendChild(anchor);
	});

	afterEach(() => {
		anchor.remove();
	});

	it("renders the wrapped component with no wrapper element", () => {
		const Decorated = HasTutorialTip(Probe, { title: "Title", instructions: "Help" });
		const { container } = renderInAnchor(<Decorated label="wrapped" />);
		const button = screen.getByRole("button", { name: "wrapped" });
		expect(button.parentNode).toBe(container);
		expect(container.querySelector(".tutorial-tip-target")).toBeNull();
	});

	it("shows no bubble and doesn't throw when the wrapped component has no node", () => {
		class NoNode extends React.Component {
			static displayName = "DecoratorsMoreNoNode";
			getDOMNode() {
				return null;
			}
			render() {
				return null;
			}
		}
		const Decorated = HasTutorialTip(NoNode, { title: "Title", instructions: "Help" });
		const view = render(<Decorated />);
		const tip = document.querySelector(".tooltips-container > .tutorial-tip");
		expect(tip.classList.contains("visible")).toBe(false);
		expect(() => view.unmount()).not.toThrow();
		expect(tip.parentNode).toBeNull();
	});

	it("stops listening for hover on the wrapped node after unmount", () => {
		const Decorated = HasTutorialTip(Probe, { title: "Title", instructions: "Help" });
		const view = renderInAnchor(<Decorated />);
		const button = screen.getByRole("button");
		view.unmount();
		fireEvent.mouseOver(button);
		expect(mocks.openPopover).not.toHaveBeenCalled();
	});

	it("hands over the wrapped component's root node", () => {
		const Decorated = HasTutorialTip(Probe, { title: "Title", instructions: "Help" });
		const ref = React.createRef();
		renderInAnchor(<Decorated ref={ref} label="wrapped" />);
		expect(ref.current.getDOMNode()).toBe(screen.getByRole("button", { name: "wrapped" }));
	});

	it("appends its visual marker to the nearest tooltip anchor", () => {
		const Decorated = HasTutorialTip(Probe, { title: "Title", instructions: "Help" });
		renderInAnchor(<Decorated />);
		expect(anchor.querySelector(".tooltips-container > .tutorial-tip")).not.toBeNull();
	});

	it("marks the first unseen mounted tip visible", () => {
		const Decorated = HasTutorialTip(Probe, { title: "Title", instructions: "Help" });
		renderInAnchor(<Decorated />);
		expect(anchor.querySelector(".tutorial-tip").classList.contains("visible")).toBe(true);
	});

	it("keeps a tip hidden when its DOM node is not visible", () => {
		mocks.nodeIsVisible.mockReturnValue(false);
		const Decorated = HasTutorialTip(Probe, { title: "Title", instructions: "Help" });
		renderInAnchor(<Decorated />);
		expect(anchor.querySelector(".tutorial-tip").classList.contains("visible")).toBe(false);
	});

	it("opens the configured popover when a visible target is hovered", () => {
		const Decorated = HasTutorialTip(Probe, { title: "A useful title", instructions: "Useful help" });
		renderInAnchor(<Decorated />);
		fireEvent.mouseOver(screen.getByRole("button"));
		expect(mocks.openPopover).toHaveBeenCalledOnce();
		const [contents, options] = mocks.openPopover.mock.calls[0];
		expect(contents.props).toMatchObject({ title: "A useful title", instructions: "Useful help" });
		expect(options).toMatchObject({ direction: "down", fallbackDirection: "up" });
	});

	it("does not open a popover when the tip is hidden", () => {
		mocks.nodeIsVisible.mockReturnValue(false);
		const Decorated = HasTutorialTip(Probe, { title: "Title", instructions: "Help" });
		renderInAnchor(<Decorated />);
		fireEvent.mouseOver(screen.getByRole("button"));
		expect(mocks.openPopover).not.toHaveBeenCalled();
	});

	it("recomputes visibility after a workspace-store notification", () => {
		mocks.nodeIsVisible.mockReturnValue(false);
		let workspaceChanged;
		mocks.workspaceListen.mockImplementation((callback) => { workspaceChanged = callback; return vi.fn(); });
		vi.useFakeTimers();
		const Decorated = HasTutorialTip(Probe, { title: "Title", instructions: "Help" });
		renderInAnchor(<Decorated />);
		mocks.nodeIsVisible.mockReturnValue(true);
		React.act(() => {
			workspaceChanged();
			vi.runAllTimers();
		});
		expect(anchor.querySelector(".tutorial-tip").classList.contains("visible")).toBe(true);
	});

	it("removes its marker and subscriptions on unmount", () => {
		const workspaceUnlisten = vi.fn();
		const themeDispose = vi.fn();
		mocks.workspaceListen.mockReturnValue(workspaceUnlisten);
		NylasEnv.themes.onDidChangeActiveThemes.mockReturnValue({ dispose: themeDispose });
		const Decorated = HasTutorialTip(Probe, { title: "Title", instructions: "Help" });
		const view = renderInAnchor(<Decorated />);
		view.unmount();
		expect(anchor.querySelector(".tutorial-tip")).toBeNull();
		expect(workspaceUnlisten).toHaveBeenCalledOnce();
		expect(themeDispose).toHaveBeenCalledOnce();
	});
});
