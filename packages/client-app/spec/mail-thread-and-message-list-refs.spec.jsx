// thread-list and message-list after findDOMNode and string refs: the list's
// root node, thread selection through the list's ref, message containers by
// callback ref, and the scroll region's object ref. The modules are CommonJS
// with extensionless .jsx requires, so they load through the package loader
// with stubbed stores and kit components.
import path from "node:path";
import { act, fireEvent, render } from "@testing-library/react";
import classnames from "classnames";
import React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import underscore from "underscore";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createPackageLoader } from "./helpers/load-package-module.js";

const pkg = (rel) => path.join(__dirname, "..", "internal_packages", rel);

// A list/region stand-in that owns a root node and exposes it the way the real
// kit components do (getDOMNode()).
class RootedComponent extends React.Component {
	root = React.createRef();
	getDOMNode() {
		return this.root.current;
	}
	render() {
		return (
			<div ref={this.root} className={this.props.className}>
				{this.props.children}
			</div>
		);
	}
}

const Passthrough = ({ children }) => children ?? null;
const Nothing = () => null;
const FakeRetinaImg = () => null;
FakeRetinaImg.Mode = { ContentIsMask: "mask", ContentPreserve: "preserve" };

describe("ThreadList", () => {
	let ThreadList;
	let list;
	let menus;
	let dataSource;
	let actions;

	beforeEach(() => {
		menus = [];
		actions = { recordPerfMetric: vi.fn(), setFocus: vi.fn(), popoutThread: vi.fn() };
		dataSource = {
			count: () => 2,
			getById: (id) => ({ id, accountId: "a1" }),
			selection: { ids: () => [], items: () => [], count: () => 0 },
			itemsCurrentlyInView: () => [],
			itemsCurrentlyInViewMatching: (fn) =>
				[{ id: "t1", unread: true }, { id: "t2", unread: false }].filter(fn),
		};
		const handler = { onSelect: vi.fn() };
		class FakeMultiselectList extends RootedComponent {
			constructor(props) {
				super(props);
				list = this;
			}
			handler() {
				return handler;
			}
			itemIdAtPoint() {
				return "t1";
			}
		}
		class FakeContextMenu {
			constructor(data) {
				this.data = data;
				menus.push(this);
			}
			displayMenu() {
				this.shown = true;
			}
		}
		NylasEnv.timer = { isPending: () => false };
		const load = createPackageLoader({
			react: React,
			"react/jsx-runtime": jsxRuntime,
			classnames,
			underscore,
			"nylas-component-kit": {
				MultiselectList: FakeMultiselectList,
				FocusContainer: Passthrough,
				EmptyListState: Nothing,
				FluxContainer: Passthrough,
				SyncingListState: Nothing,
			},
			"nylas-exports": {
				Actions: actions,
				Utils: { isEqualReact: () => false },
				ExtensionRegistry: { ThreadList: { extensions: () => [] } },
				FocusedContentStore: { focusedId: () => null, focused: () => null },
				FocusedPerspectiveStore: {
					current: () => ({ hasSyncingCategories: () => false, isInbox: () => true }),
				},
				FolderSyncProgressStore: { listen: () => () => {} },
			},
			"./thread-list-columns": { Wide: [], Narrow: [] },
			"./thread-list-scroll-tooltip": { default: Nothing },
			"./thread-list-store": { default: { dataSource: () => dataSource } },
			"./thread-list-context-menu": { default: FakeContextMenu },
			"./category-removal-target-rulesets": { default: { Default: {}, Gmail: {} } },
		});
		ThreadList = load(pkg("thread-list/lib/thread-list.jsx"));
		list = null;
	});

	afterEach(() => {
		delete NylasEnv.timer;
	});

	it("opens the context menu for the thread under the pointer on the list's root node", () => {
		render(<ThreadList />);
		fireEvent.contextMenu(list.getDOMNode(), { clientX: 10, clientY: 10 });
		expect(menus).toHaveLength(1);
		expect(menus[0].data).toEqual({ threadIds: ["t1"], accountIds: ["a1"] });
		expect(menus[0].shown).toBe(true);
	});

	it("stops listening for the context menu on unmount", () => {
		const view = render(<ThreadList />);
		const node = list.getDOMNode();
		view.unmount();
		fireEvent.contextMenu(node);
		expect(menus).toHaveLength(0);
	});

	it("picks the wide or narrow layout from the root node's width", () => {
		render(<ThreadList />);
		expect(list.props.className).toContain("thread-list-narrow");
		Object.defineProperty(list.getDOMNode(), "offsetWidth", { value: 800 });
		act(() => {
			window.dispatchEvent(new Event("resize"));
		});
		expect(list.props.className).toContain("thread-list-wide");
	});

	it("selects the unread threads in view through the list's handler", () => {
		render(<ThreadList />);
		list.props.keymapHandlers["thread-list:select-unread"]();
		expect(list.handler().onSelect).toHaveBeenCalledWith([{ id: "t1", unread: true }]);
		list.props.keymapHandlers["thread-list:select-read"]();
		expect(list.handler().onSelect).toHaveBeenLastCalledWith([{ id: "t2", unread: false }]);
	});
});

describe("MessageList", () => {
	let MessageList;
	let messages;
	let region;
	let focusDraftListener;
	let actions;
	let containers;
	const thread = { id: "t1", subject: "Lunch on Thursday?" };

	beforeEach(() => {
		messages = [
			{ id: "m1", clientId: "c1", draft: false, canReplyAll: () => false },
			{ id: "m2", clientId: "c2", draft: false, canReplyAll: () => false },
		];
		containers = {};
		actions = {
			focusDraft: {
				listen: (cb) => {
					focusDraftListener = cb;
					return () => {};
				},
			},
			printThread: vi.fn(),
			composeReply: vi.fn(),
		};
		class FakeScrollRegion extends RootedComponent {
			static ScrollPosition = { Top: "top", Visible: "visible", CenterIfInvisible: "center" };
			constructor(props) {
				super(props);
				region = this;
				this.scrollTop = 0;
				this.scrollTo = vi.fn();
				this.scrollToRect = vi.fn();
			}
		}
		class FakeContainer extends RootedComponent {
			constructor(props) {
				super(props);
				containers[props.message.clientId] = this;
				this.focus = vi.fn();
			}
		}
		NylasEnv.isThreadWindow = () => false;
		const load = createPackageLoader({
			react: React,
			"react/jsx-runtime": jsxRuntime,
			classnames,
			underscore,
			"prop-types": { number: { isRequired: null }, object: {}, func: {} },
			"./find-in-thread": { default: Nothing },
			"./message-item-container": FakeContainer,
			"nylas-exports": {
				Utils: {
					isEqualReact: () => false,
					waitFor: (fn) => (fn() ? Promise.resolve() : Promise.reject()),
					generateTempId: () => "tmp",
				},
				Actions: actions,
				MessageStore: {
					listen: () => () => {},
					items: () => messages,
					itemsExpandedState: () => ({ m1: "explicit", m2: "default" }),
					hasCollapsedItems: () => false,
					thread: () => thread,
					itemsLoading: () => false,
				},
				SearchableComponentStore: { searchTerm: null },
				SearchableComponentMaker: { extend: (C) => C },
			},
			"nylas-component-kit": {
				Spinner: Nothing,
				RetinaImg: FakeRetinaImg,
				MailLabelSet: Nothing,
				ScrollRegion: FakeScrollRegion,
				MailImportantIcon: Nothing,
				InjectedComponent: Nothing,
				KeyCommandsRegion: RootedComponent,
				InjectedComponentSet: Nothing,
			},
		});
		MessageList = load(pkg("message-list/lib/message-list.jsx"));
	});

	afterEach(() => {
		delete NylasEnv.isThreadWindow;
	});

	const renderList = () => {
		const ref = React.createRef();
		const view = render(<MessageList ref={ref} />);
		return { ...view, list: ref.current };
	};

	it("renders the thread's messages and finds each container by clientId", () => {
		const { list, container } = renderList();
		expect(container.querySelector(".message-subject").textContent).toBe("Lunch on Thursday?");
		expect(list._getMessageContainer("c1")).toBe(containers.c1);
		expect(list._getMessageContainer("c2")).toBe(containers.c2);
		expect(list._getMessageContainer("nope")).toBeUndefined();
	});

	it("forgets a container once its message leaves the thread", () => {
		const { list } = renderList();
		messages = [messages[0]];
		act(() => list._onChange());
		expect(list._getMessageContainer("c1")).toBe(containers.c1);
		expect(list._getMessageContainer("c2")).toBeUndefined();
	});

	it("focuses a draft and scrolls the region to it on Actions.focusDraft", async () => {
		renderList();
		await act(async () => {
			await focusDraftListener({ draftClientId: "c2" });
		});
		expect(containers.c2.focus).toHaveBeenCalled();
		expect(region.scrollTo).toHaveBeenCalledWith(
			containers.c2,
			expect.objectContaining({ position: "top", settle: true }),
		);
	});

	it("unblocks scrolling when scrolling to a draft fails", async () => {
		const { list } = renderList();
		region.scrollTo.mockImplementationOnce(() => {
			throw new Error("no node to scroll to");
		});
		await act(async () => {
			await focusDraftListener({ draftClientId: "c2" });
		});
		expect(list._draftScrollInProgress).toBe(false);
		list._scrollTo({ clientId: "c1" });
		expect(region.scrollTo).toHaveBeenLastCalledWith(containers.c1, { position: "visible" });
	});

	it("scrolls to a message container or a rect", () => {
		const { list } = renderList();
		list._scrollTo({ clientId: "c1" });
		expect(region.scrollTo).toHaveBeenCalledWith(containers.c1, { position: "visible" });
		const rect = { top: 1, height: 2 };
		list._scrollTo({ rect });
		expect(region.scrollToRect).toHaveBeenCalledWith(rect, { position: "center" });
	});

	it("pages the region by its node's height", () => {
		const { list } = renderList();
		Object.defineProperty(region.getDOMNode(), "clientHeight", { value: 300 });
		list._onScrollByPage(1);
		expect(region.scrollTop).toBe(300);
	});

	it("prints the list's own markup", () => {
		const { list } = renderList();
		list._onPrintThread();
		expect(actions.printThread).toHaveBeenCalledWith(thread, list.getDOMNode().innerHTML);
		expect(list.getDOMNode().innerHTML).toContain("Lunch on Thursday?");
	});
});

describe("MessageItemContainer", () => {
	let MessageItemContainer;
	let item;
	let composer;

	beforeEach(() => {
		class FakeMessageItem extends RootedComponent {
			constructor(props) {
				super(props);
				item = this;
				this.focus = vi.fn();
			}
		}
		class FakeComposer extends RootedComponent {
			constructor(props) {
				super(props);
				composer = this;
				this.focus = vi.fn();
			}
		}
		const load = createPackageLoader({
			react: React,
			"react/jsx-runtime": jsxRuntime,
			classnames,
			"./message-item": FakeMessageItem,
			"nylas-exports": {
				Utils: { isEqualReact: () => false },
				DraftStore: { listen: () => () => {}, isSendingDraft: () => false },
				ComponentRegistry: { findComponentsMatching: () => [FakeComposer] },
			},
		});
		MessageItemContainer = load(pkg("message-list/lib/message-item-container.jsx"));
	});

	const renderContainer = (message) => {
		const ref = React.createRef();
		render(
			<MessageItemContainer ref={ref} thread={{ id: "t1" }} message={message} messages={[message]} />,
		);
		return ref.current;
	};

	it("hands over the message item's node and focus", () => {
		const container = renderContainer({ id: "m1", clientId: "c1", draft: false });
		expect(container.getDOMNode()).toBe(item.getDOMNode());
		container.focus();
		expect(item.focus).toHaveBeenCalled();
	});

	it("hands over the inline composer's node and focus for a draft", () => {
		const container = renderContainer({ id: "d1", clientId: "d1", draft: true });
		expect(container.getDOMNode()).toBe(composer.getDOMNode());
		container.focus();
		expect(composer.focus).toHaveBeenCalled();
	});
});

describe("EmailFrame", () => {
	it("writes the body into its iframe and sizes the height holder", () => {
		let frame;
		class EventedIFrame extends React.Component {
			node = React.createRef();
			constructor(props) {
				super(props);
				frame = this;
				this.didReplaceDocument = vi.fn();
				this.setHeightQuietly = vi.fn();
			}
			getDOMNode() {
				return this.node.current;
			}
			render() {
				return <iframe ref={this.node} title="body" />;
			}
		}
		const load = createPackageLoader({
			react: React,
			"react/jsx-runtime": jsxRuntime,
			underscore,
			"nylas-component-kit": { EventedIFrame },
			"nylas-exports": {
				Utils: { isEqualReact: () => false },
				QuotedHTMLTransformer: { removeQuotedHTML: (html) => html },
				MessageStore: { extensions: () => [] },
			},
			"./autolinker": { autolink: vi.fn() },
			"./autoscale-images": { autoscaleImages: vi.fn() },
			"./inline-image-listeners": { addInlineImageListeners: vi.fn() },
			"./email-frame-styles-store": { default: { listen: () => () => {}, styles: () => "" } },
		});
		const EmailFrame = load(pkg("message-list/lib/email-frame.jsx")).default;
		const { container } = render(<EmailFrame content="<p>Noon is perfect.</p>" message={{}} />);
		const iframe = container.querySelector("iframe");
		expect(iframe.contentDocument.body.textContent).toContain("Noon is perfect.");
		expect(frame.didReplaceDocument).toHaveBeenCalled();
		expect(frame.setHeightQuietly).toHaveBeenCalledWith(0);
		const height = Number.parseInt(container.querySelector(".iframe-container").style.height, 10);
		expect(frame.setHeightQuietly).toHaveBeenLastCalledWith(height);
	});
});

describe("FindInThread", () => {
	it("focuses the search box on find, and blurs it on Escape", () => {
		const load = createPackageLoader({
			react: React,
			"react/jsx-runtime": jsxRuntime,
			classnames,
			"nylas-exports": {
				Actions: { findInThread: vi.fn() },
				MessageStore: { hasCollapsedItems: () => false },
				SearchableComponentStore: {
					getCurrentSearchData: () => ({ searchTerm: "", globalIndex: null, resultsLength: 0 }),
					listen: () => () => {},
				},
			},
			"nylas-component-kit": { RetinaImg: FakeRetinaImg, KeyCommandsRegion: RootedComponent },
		});
		const FindInThread = load(pkg("message-list/lib/find-in-thread.jsx")).default;
		const ref = React.createRef();
		const { container } = render(<FindInThread ref={ref} />);
		const input = container.querySelector("input");
		ref.current._onFindInThread();
		expect(document.activeElement).toBe(input);
		fireEvent.keyDown(input, { key: "Escape" });
		expect(document.activeElement).not.toBe(input);
	});
});

describe("MessageItem", () => {
	it("hands over its root node and measures its header", () => {
		const load = createPackageLoader({
			react: React,
			"react/jsx-runtime": jsxRuntime,
			classnames,
			underscore,
			"prop-types": { object: { isRequired: null }, array: { isRequired: null }, bool: null, func: null },
			"./message-participants": {
				default: () => <div className="participant-name from-contact">Cleo</div>,
			},
			"./message-item-body": Nothing,
			"./message-timestamp": { default: Nothing },
			"./message-controls": { default: Nothing },
			"nylas-exports": {
				Utils: { isEqualReact: () => false, showIconForAttachments: () => false },
				FileDownloadStore: {
					getDownloadDataForFiles: () => ({}),
					previewPathsForFiles: () => ({}),
					listen: () => () => {},
				},
			},
			"nylas-component-kit": {
				RetinaImg: FakeRetinaImg,
				InjectedComponentSet: Nothing,
				InjectedComponent: Nothing,
			},
		});
		const MessageItem = load(pkg("message-list/lib/message-item.jsx"));
		const message = { id: "m1", clientId: "c1", files: [], from: [], to: [], cc: [], bcc: [], fileIds: () => [] };
		const ref = React.createRef();
		const { container } = render(
			<MessageItem ref={ref} className="message-item-wrap" thread={{}} message={message} messages={[message]} />,
		);
		expect(ref.current.getDOMNode()).toBe(container.querySelector(".message-item-wrap"));
		expect(container.querySelector("header.message-header .from-contact")).not.toBeNull();
		expect(ref.current.state.detailedHeadersTogglePos.top).toBe(-10);
	});
});
