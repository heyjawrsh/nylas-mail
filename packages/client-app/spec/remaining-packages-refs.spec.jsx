// The non-mail packages after findDOMNode and string refs: toolbar and popover
// buttons open their popover from their own rect, tipped buttons hand over
// their node through getDOMNode() (HasTutorialTip no longer wraps them), and
// the frames, preferences and notifications reach their
// nodes by ref. Modules load through the package loader with stubbed stores.
import path from "node:path";
import { act, fireEvent, render } from "@testing-library/react";
import classnames from "classnames";
import PropTypes from "prop-types";
import React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import underscore from "underscore";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createPackageLoader } from "./helpers/load-package-module.js";

const pkg = (rel) => path.join(__dirname, "..", "internal_packages", rel);

class RootedComponent extends React.Component {
	root = React.createRef();
	getDOMNode() {
		return this.root.current;
	}
	render() {
		const { children, className, tabIndex } = this.props;
		return (
			<div ref={this.root} className={className} tabIndex={tabIndex}>
				{children}
			</div>
		);
	}
}
const Passthrough = ({ children }) => <>{children}</>;
const Nothing = () => null;
const FakeRetinaImg = () => null;
FakeRetinaImg.Mode = { ContentIsMask: "mask", ContentPreserve: "preserve", ContentDark: "dark", ContentLight: "light" };

// A stand-in for EventedIFrame: an instance with its methods and a node.
class FakeIFrame extends React.Component {
	node = React.createRef();
	didReplaceDocument = vi.fn();
	setHeightQuietly = vi.fn();
	getDOMNode() {
		return this.node.current;
	}
	render() {
		return <iframe ref={this.node} className={this.props.className} title="frame" />;
	}
}

const base = {
	react: React,
	"react/jsx-runtime": jsxRuntime,
	"prop-types": PropTypes,
	classnames,
	underscore,
};

const rect = { top: 1, left: 2, bottom: 21, right: 32, width: 30, height: 20 };
const inbox = { current: () => ({ isInbox: () => true }) };
const notInbox = { current: () => ({ isInbox: () => false }) };
const emptyObservable = { subscribe: () => ({ dispose() {} }) };

let actions;
beforeEach(() => {
	actions = { openPopover: vi.fn(), closePopover: vi.fn(), recordUserEvent: vi.fn() };
});

const expectPopoverFrom = (originRect) =>
	expect(actions.openPopover).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ originRect }));

// Renders, stubs the target's rect, fires the event and checks the popover's
// origin. Returns the render result and the target node.
const fireAndCheck = (element, selector, event = "click") => {
	const view = render(element);
	const node = view.container.querySelector(selector);
	node.getBoundingClientRect = () => rect;
	fireEvent[event](node);
	expectPopoverFrom(rect);
	return { ...view, node };
};

const loadSnoozeButtons = (perspective = inbox) =>
	createPackageLoader({
		...base,
		"nylas-exports": { Actions: actions, FocusedPerspectiveStore: perspective },
		"nylas-component-kit": { RetinaImg: FakeRetinaImg },
		"./snooze-popover": { default: Nothing },
	})(pkg("thread-snooze/lib/snooze-buttons.jsx"));

describe("toolbar and popover buttons open their popover from their own rect", () => {
	it("ToolbarSnooze", () => {
		const { ToolbarSnooze } = loadSnoozeButtons();
		fireAndCheck(<ToolbarSnooze items={[{ id: "t1" }]} />, ".snooze-button");
	});

	it("QuickActionSnooze measures its parent, nudged right by 5", () => {
		const { QuickActionSnooze } = loadSnoozeButtons();
		const { container } = render(
			<div className="parent">
				<QuickActionSnooze thread={{ id: "t1" }} />
			</div>,
		);
		container.querySelector(".parent").getBoundingClientRect = () => rect;
		fireEvent.click(container.querySelector(".action-snooze"));
		expectPopoverFrom({ ...rect, left: rect.left + 5 });
		expect(actions.openPopover.mock.calls[0][1].direction).toBe("left");
	});

	it("QuickEventButton", () => {
		const QuickEventButton = createPackageLoader({
			...base,
			"nylas-exports": { Actions: actions },
			"./quick-event-popover": { default: Nothing },
		})(pkg("main-calendar/lib/quick-event-button.jsx")).default;
		fireAndCheck(<QuickEventButton />, "button");
	});

	it("ThreadSharingButton", () => {
		const ThreadSharingButton = createPackageLoader({
			...base,
			"nylas-exports": { React, Actions: actions },
			"nylas-component-kit": { RetinaImg: FakeRetinaImg },
			"./thread-sharing-popover": { default: Nothing },
		})(pkg("thread-sharing/lib/thread-sharing-button.jsx")).default;
		fireAndCheck(<ThreadSharingButton thread={{ id: "t1", accountId: "a1" }} />, ".thread-sharing-button");
	});

	it("EncryptMessageButton opens the key recommender from its wrapper's rect", async () => {
		const contacts = [{ email: "ben@fixture.test" }];
		const EncryptMessageButton = createPackageLoader({
			...base,
			"nylas-exports": {
				Utils: {},
				DraftStore: {},
				React,
				Actions: actions,
				DatabaseStore: { findAll: () => Promise.resolve(contacts) },
				Contact: class {},
			},
			"./pgp-key-store": { listen: () => () => {}, pubKeys: () => [] },
			"./identity": class {},
			"./modal-key-recommender": Nothing,
			"nylas-component-kit": { RetinaImg: FakeRetinaImg },
			"@electron/remote": {},
			kbpgp: {},
		})(pkg("keybase/lib/encrypt-button.jsx"));
		const ref = React.createRef();
		const { container } = render(<EncryptMessageButton ref={ref} draft={{ to: [], body: "" }} session={{}} />);
		const wrap = container.querySelector(".n1-keybase");
		wrap.getBoundingClientRect = () => rect;
		await act(() => ref.current._checkKeysAndEncrypt("body", [{ key: null, addresses: ["ben@fixture.test"] }], () => {}));
		expectPopoverFrom(rect);
		expect(ref.current.getDOMNode()).toBe(wrap);
	});

});

describe("tipped buttons hand over their node through getDOMNode()", () => {
	const nodeOf = (Component, props = {}) => {
		const ref = React.createRef();
		const { container } = render(<Component ref={ref} {...props} />);
		return { node: ref.current.getDOMNode(), container };
	};

	it("ModeToggle", () => {
		const ModeToggle = createPackageLoader({
			...base,
			"nylas-exports": {
				ComponentRegistry: {},
				WorkspaceStore: { Location: { MessageListSidebar: "sidebar" }, isLocationHidden: () => false, listen: () => () => {} },
				Actions: actions,
			},
			"nylas-component-kit": { RetinaImg: FakeRetinaImg },
		})(pkg("mode-switch/lib/mode-toggle.jsx"));
		const { node } = nodeOf(ModeToggle);
		expect(node.classList.contains("mode-toggle")).toBe(true);
	});

	it("ToolbarSnooze, and its empty span outside the inbox", () => {
		const { node } = nodeOf(loadSnoozeButtons().ToolbarSnooze, { items: [] });
		expect(node.classList.contains("snooze-button")).toBe(true);
		const outside = nodeOf(loadSnoozeButtons(notInbox).ToolbarSnooze, { items: [] });
		expect(outside.node.tagName).toBe("SPAN");
	});

});

describe("frames reach their iframe through the EventedIFrame instance", () => {
	it("main-calendar's EmailFrame writes the content and sizes the frame", () => {
		const EmailFrame = createPackageLoader({
			...base,
			"nylas-component-kit": { EventedIFrame: FakeIFrame },
			"nylas-exports": { Utils: { isEqualReact: () => false } },
		})(pkg("main-calendar/lib/event-description-frame.jsx")).default;
		const ref = React.createRef();
		const { container } = render(<EmailFrame ref={ref} content="<b>Agenda</b>" />);
		const iframe = container.querySelector("iframe");
		expect(iframe.contentDocument.body.innerHTML).toContain("Agenda");
		const frame = ref.current._iframe.current;
		expect(frame.didReplaceDocument).toHaveBeenCalled();
		expect(frame.setHeightQuietly).toHaveBeenCalledWith(0);
		// The holder keeps the last height while the new one is measured.
		ref.current._lastComputedHeight = 0;
		Object.defineProperty(iframe.contentDocument.documentElement, "scrollHeight", { value: 100, configurable: true });
		ref.current._setFrameHeight();
		expect(frame.setHeightQuietly).toHaveBeenLastCalledWith(125);
		expect(container.querySelector(".iframe-container").style.height).toBe("125px");
	});

	it("theme-picker's ThemeOption writes its preview into the iframe", () => {
		const ThemeOption = createPackageLoader({
			...base,
			"fs-plus": { isDirectorySync: () => false, readFileSync: () => "body {}", existsSync: () => false },
			"node:path": path,
			"nylas-component-kit": { EventedIFrame: FakeIFrame },
			"../../../src/less-compile-cache": {
				default: class {
					setImportPaths() {}
					cssForFile() {
						return "";
					}
				},
			},
		})(pkg("theme-picker/lib/theme-option.jsx")).default;
		NylasEnv.getLoadSettings.mockReturnValue({ resourcePath: "/res" });
		NylasEnv.themes = { getActiveThemes: () => [], baseThemeName: () => "ui-light" };
		const theme = { name: "ui-dark", displayName: "Dark", getStylesheetsPath: () => "/themes/dark" };
		const { container } = render(<ThemeOption theme={theme} active onSelect={() => {}} />);
		const doc = container.querySelector("iframe").contentDocument;
		expect(doc.querySelector(".theme-name").textContent).toBe("Dark");
		expect(doc.querySelector(".theme-option").className).toContain("active-true");
		delete NylasEnv.themes;
		NylasEnv.getLoadSettings.mockReturnValue({ windowType: "root" });
	});
});

describe("NotifWrapper marks the highest-priority notification", () => {
	it("observes the set's node and tags the top priority", async () => {
		const NotifWrapper = createPackageLoader({
			...base,
			"nylas-exports": { React },
			"nylas-component-kit": {
				InjectedComponentSet: class extends RootedComponent {
					render() {
						return (
							<div ref={this.root} className={this.props.className}>
								<div data-priority="1" />
								<div data-priority="3" id="top" />
							</div>
						);
					}
				},
			},
		})(pkg("notifications/lib/notif-wrapper.jsx")).default;
		const ref = React.createRef();
		const { container } = render(<NotifWrapper ref={ref} />);
		expect(container.querySelector("#top").classList.contains("highest-priority")).toBe(true);
		expect(ref.current.getDOMNode()).toBe(container.querySelector(".notifications"));
		// A new top notification moves the mark when the set's children change.
		const higher = document.createElement("div");
		higher.dataset.priority = "9";
		container.querySelector(".notifications").appendChild(higher);
		await vi.waitFor(() => expect(higher.classList.contains("highest-priority")).toBe(true));
		expect(container.querySelector("#top").classList.contains("highest-priority")).toBe(false);
	});
});

describe("preferences", () => {
	it("PreferencesRoot focuses itself, then the first tabindex in the tab", () => {
		class ScrollRegion extends RootedComponent {
			render() {
				return (
					<div ref={this.root} className={this.props.className}>
						<div className="scroll-region-content">
							<div className="scroll-region-content-inner">{this.props.children}</div>
						</div>
					</div>
				);
			}
		}
		const ConfigPropContainer = ({ children }) => children;
		const Tab = () => (
			<div className="tab" tabIndex={-1}>
				<input className="first" tabIndex={1} />
			</div>
		);
		const exported = createPackageLoader({
			...base,
			"nylas-component-kit": {
				Flexbox: Passthrough,
				ScrollRegion,
				KeyCommandsRegion: RootedComponent,
				ListensToFluxStore: (Component) => Component,
				ConfigPropContainer,
			},
			"nylas-exports": { PreferencesUIStore: {} },
			"./preferences-tabs-bar": { default: Nothing },
		})(pkg("preferences/lib/preferences-root.jsx"));
		const PreferencesRoot = exported.default;
		const focused = [];
		const spy = vi.spyOn(HTMLElement.prototype, "focus").mockImplementation(function record() {
			focused.push(this);
		});
		try {
			const selection = { get: () => "a1" };
			const { container } = render(<PreferencesRoot tab={{ component: Tab }} tabs={{}} selection={selection} />);
			expect(focused[0]).toBe(container.querySelector(".preferences-wrap"));
			// The tab's root has a tabindex too, but only what's inside it counts.
			expect(focused[1]).toBe(container.querySelector("input.first"));
		} finally {
			spy.mockRestore();
		}
	});

	it("CommandKeybinding blurs its row once a binding is complete", () => {
		const CommandKeybinding = createPackageLoader({
			...base,
			"nylas-component-kit": { Flexbox: RootedComponent },
			"node:fs": {},
			"./mousetrap-keybinding-helpers": { keyAndModifiersForEvent: () => ["k", ["shift"]] },
		})(pkg("preferences/lib/tabs/keymaps/command-item.jsx")).default;
		NylasEnv.keymaps.suspendAllKeymaps = vi.fn();
		NylasEnv.keymaps.resumeAllKeymaps = vi.fn();
		const ref = React.createRef();
		const { container } = render(<CommandKeybinding ref={ref} bindings={[]} label="Archive" command="core:archive" />);
		const row = container.firstChild;
		row.blur = vi.fn();
		act(() => ref.current._onEdit());
		act(() => ref.current._onKey({ preventDefault() {}, stopPropagation() {} }));
		expect(row.blur).toHaveBeenCalled();
	});
});

describe("thread-sharing popover", () => {
	it("focuses its root after an update", () => {
		const ThreadSharingPopover = createPackageLoader({
			...base,
			"nylas-exports": {
				Rx: { Observable: { fromQuery: () => emptyObservable } },
				Actions: actions,
				NylasAPIHelpers: {},
				Thread: class {},
				DatabaseStore: { find: () => ({}) },
			},
			"nylas-component-kit": { RetinaImg: FakeRetinaImg },
			"./copy-button": { default: Nothing },
			"./thread-sharing-constants": { PLUGIN_ID: "sharing", PLUGIN_NAME: "Sharing", PLUGIN_URL: "https://share" },
		})(pkg("thread-sharing/lib/thread-sharing-popover.jsx")).default;
		const thread = { id: "t1", metadataForPluginId: () => null };
		const ref = React.createRef();
		const { container } = render(<ThreadSharingPopover ref={ref} thread={thread} accountId="a1" />);
		const root = container.querySelector(".thread-sharing-popover");
		root.focus = vi.fn();
		act(() => ref.current.setState({ shared: true }));
		expect(root.focus).toHaveBeenCalled();
		expect(container.querySelector("#urlInput").value).toBe("https://share/thread/a1/t1");
	});
});
