// Prop-change behaviour of the plugin-package components whose legacy
// lifecycles moved to componentDidUpdate: each re-derives or re-subscribes
// when the props it reads change, disposes the old subscription first, and
// keeps local state through an unrelated re-render. Modules load through the
// package loader with stubbed stores.
import path from "node:path";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import classnames from "classnames";
import PropTypes from "prop-types";
import React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import moment from "moment-timezone";
import underscore from "underscore";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createPackageLoader } from "./helpers/load-package-module.js";

const pkg = (rel) => path.join(__dirname, "..", "internal_packages", rel);
const Nothing = () => null;
const FakeRetinaImg = () => null;
FakeRetinaImg.Mode = { ContentIsMask: "mask", ContentPreserve: "preserve" };

const base = {
	react: React,
	"react/jsx-runtime": jsxRuntime,
	"prop-types": PropTypes,
	classnames,
	underscore,
};

afterEach(() => {
	cleanup();
	vi.useRealTimers();
});

describe("CopyButton", () => {
	const load = () =>
		createPackageLoader({
			...base,
			"nylas-exports": { Utils: { fastOmit: (o, keys) => underscore.omit(o, keys) } },
			electron: { clipboard: { writeText: vi.fn() } },
		})(pkg("thread-sharing/lib/copy-button.jsx")).default;

	it("keeps \"Copied!\" up through an unrelated re-render", () => {
		vi.useFakeTimers();
		const CopyButton = load();
		const view = render(<CopyButton btnLabel="Copy" copyValue="a" />);
		fireEvent.click(view.container.querySelector("button"));
		view.rerender(<CopyButton btnLabel="Copy" copyValue="a" className="x" />);
		expect(view.container.textContent).toBe("Copied!");
		act(() => vi.advanceTimersByTime(2000));
		expect(view.container.textContent).toBe("Copy");
	});

	it("shows a new label at once and cancels the pending reset", () => {
		vi.useFakeTimers();
		const CopyButton = load();
		const view = render(<CopyButton btnLabel="Copy" copyValue="a" />);
		fireEvent.click(view.container.querySelector("button"));
		view.rerender(<CopyButton btnLabel="Copy link" copyValue="a" />);
		expect(view.container.textContent).toBe("Copy link");
		act(() => vi.advanceTimersByTime(2000));
		expect(view.container.textContent).toBe("Copy link");
	});
});

describe("EventHeader on a new message", () => {
	it("refreshes the new message's event, not the old one", async () => {
		const find = vi.fn((_klass, id) =>
			Promise.resolve({ id, title: `db ${id}`, start: 0, end: 0, participantForMe: () => null }),
		);
		const EventHeader = createPackageLoader({
			...base,
			"moment-timezone": moment,
			"nylas-component-kit": { RetinaImg: FakeRetinaImg },
			"nylas-exports": {
				Actions: {},
				DateUtils: { getTimeFormat: () => "", timeZone: "UTC" },
				Message: class {},
				Event: class Event {},
				ComponentRegistry: {},
				EventRSVPTask: class {},
				DatabaseStore: { find, listen: () => () => {} },
				AccountStore: {},
			},
		})(pkg("events/lib/event-header.jsx"));
		const Header = EventHeader.default || EventHeader;
		const ref = React.createRef();
		const message = (id) => ({
			events: [{ id, title: id, start: 0, end: 0, participants: [], participantForMe: () => null }],
		});
		const first = message("e1");
		const view = render(<Header ref={ref} message={first} />);
		await act(async () => {});
		find.mockClear();
		view.rerender(<Header ref={ref} message={message("e2")} />);
		await act(async () => {});
		expect(find).toHaveBeenCalledOnce();
		expect(find.mock.calls[0][1]).toBe("e2");
		expect(ref.current.state.event.id).toBe("e2");
	});
});

describe("Salesforce thread views on a new thread", () => {
	const observable = () => {
		const subs = [];
		return {
			subs,
			observe: vi.fn((thread) => ({
				subscribe: () => {
					const sub = { thread, dispose: vi.fn() };
					subs.push(sub);
					return sub;
				},
			})),
		};
	};

	it("SalesforceSyncLabel re-observes the new thread, and an unrelated re-render doesn't restart it", () => {
		vi.useFakeTimers();
		const obs = observable();
		const SyncLabel = createPackageLoader({
			...base,
			"../shared-components/salesforce-icon": { default: Nothing },
			"../salesforce-actions": { default: {} },
			"../salesforce-constants": { CORE_RELATEABLE_OBJECT_TYPES: [] },
			"../related-object-helpers": {
				relatedSObjectsForThread: () => [],
				observeRelatedSObjectsForThread: obs.observe,
			},
			"../metadata-helpers": { getSObjectsToSyncActivityTo: () => [] },
		})(pkg("nylas-private-salesforce/lib/thread/salesforce-sync-label.jsx")).default;
		const a = { id: "a" };
		const b = { id: "b" };
		const view = render(<SyncLabel thread={a} />);
		act(() => vi.advanceTimersByTime(3000));
		view.rerender(<SyncLabel thread={a} extra />);
		act(() => vi.advanceTimersByTime(3000));
		expect(obs.subs).toHaveLength(1);
		view.rerender(<SyncLabel thread={b} />);
		act(() => vi.advanceTimersByTime(3000));
		expect(obs.subs[0].dispose).toHaveBeenCalledOnce();
		expect(obs.subs.map((s) => s.thread)).toEqual([a, b]);
		view.unmount();
		expect(obs.subs[1].dispose).toHaveBeenCalledOnce();
	});

	it("RelatedObjectsForThread disposes the old observable and keeps its panel open on an unrelated re-render", () => {
		const obs = observable();
		const Related = createPackageLoader({
			...base,
			"underscore.string": { titleize: (s) => s, humanize: (s) => s },
			"nylas-exports": {
				Utils: {},
				DatabaseStore: {},
				AccountStore: {},
				FocusedContactsStore: { listen: () => () => {}, focusedContact: () => null, sortedContacts: () => [] },
			},
			"../shared-components/salesforce-icon": { default: Nothing },
			"../models/salesforce-object": { default: class {} },
			"./sync-thread-toggle": { default: Nothing },
			"../salesforce-actions": { default: {} },
			"../shared-components/open-in-salesforce-btn": { default: Nothing },
			"../salesforce-object-helpers": {},
			"../related-object-helpers": { observeRelatedSObjectsForThread: obs.observe },
			"../salesforce-constants": { CORE_RELATEABLE_OBJECT_TYPES: [] },
		})(pkg("nylas-private-salesforce/lib/thread/related-objects-for-thread.jsx")).default;
		const ref = React.createRef();
		const a = { id: "a", participants: [] };
		const view = render(<Related ref={ref} thread={a} />);
		act(() => ref.current.setState({ expanded: true }));
		view.rerender(<Related ref={ref} thread={a} />);
		expect(ref.current.state.expanded).toBe(true);
		expect(obs.subs).toHaveLength(1);
		const b = { id: "b", participants: [] };
		view.rerender(<Related ref={ref} thread={b} />);
		expect(obs.subs[0].dispose).toHaveBeenCalledOnce();
		expect(obs.subs[1].thread).toBe(b);
		expect(ref.current.state.expanded).toBe(false);
	});
});

describe("SendRemindersThreadTimestamp on new messages", () => {
	it("drops the old message's query and follows the latest message with a reminder", () => {
		const subs = [];
		const Timestamp = createPackageLoader({
			...base,
			"nylas-component-kit": { RetinaImg: FakeRetinaImg },
			"nylas-exports": {
				Rx: {
					Observable: {
						fromQuery: (query) => ({
							subscribe: () => {
								const sub = { id: query.id, dispose: vi.fn() };
								subs.push(sub);
								return sub;
							},
						}),
					},
				},
				Message: class {},
				DatabaseStore: { find: (_klass, id) => ({ id }) },
				FocusedPerspectiveStore: { current: () => ({ isReminders: true }) },
			},
			"./send-reminders-utils": {
				getReminderLabel: () => "",
				getLatestMessageWithReminder: (_thread, messages) => messages.at(-1),
				setMessageReminder: () => {},
			},
			"./send-reminders-constants": { PLUGIN_ID: "send-reminders" },
		})(pkg("send-reminders/lib/send-reminders-thread-timestamp.jsx")).default;
		const thread = { id: "t1" };
		const msg = (id) => ({ id, metadataForPluginId: () => ({ expiration: 1 }) });
		const first = [msg("m1")];
		const view = render(<Timestamp thread={thread} messages={first} fallback={Nothing} />);
		view.rerender(<Timestamp thread={thread} messages={first} fallback={Nothing} />);
		expect(subs).toHaveLength(1);
		view.rerender(<Timestamp thread={thread} messages={[msg("m1"), msg("m2")]} fallback={Nothing} />);
		expect(subs[0].dispose).toHaveBeenCalledOnce();
		expect(subs[1].id).toBe("m2");
	});
});

describe("CategoryPickerPopover on new props", () => {
	const loadPopover = (forAccount) =>
		createPackageLoader({
			...base,
			"nylas-component-kit": { Menu: Nothing, RetinaImg: FakeRetinaImg, LabelColorizer: {}, BoldedSearchResult: Nothing },
			"nylas-exports": {
				Utils: { wordSearchRegExp: () => /./ },
				Actions: {},
				TaskQueueStatusStore: {},
				ChangeLabelsTask: class {},
				ChangeFolderTask: class {},
				SyncbackCategoryTask: class {},
				FocusedPerspectiveStore: { current: () => ({ categories: () => [] }) },
				Category: class {},
				DatabaseStore: {},
				TaskFactory: {},
			},
			"nylas-observables": { Categories: { forAccount } },
		})(pkg("category-picker/lib/category-picker-popover.jsx")).default;

	it("re-subscribes for a new account, keeps the search, and keeps its subscription otherwise", () => {
		const subs = [];
		const forAccount = vi.fn((account) => ({
			sort: () => ({
				subscribe: () => {
					const sub = { account, dispose: vi.fn() };
					subs.push(sub);
					return sub;
				},
			}),
		}));
		const Popover = loadPopover(forAccount);
		const ref = React.createRef();
		const account = (id) => ({ id, usesLabels: () => true, usesFolders: () => false });
		const a = account("a");
		const threads = [];
		const view = render(<Popover ref={ref} account={a} threads={threads} />);
		act(() => ref.current.setState({ searchValue: "inv" }));
		view.rerender(<Popover ref={ref} account={a} threads={threads} />);
		expect(subs).toHaveLength(1);
		const b = account("b");
		view.rerender(<Popover ref={ref} account={b} threads={threads} />);
		expect(subs[0].dispose).toHaveBeenCalledOnce();
		expect(subs[1].account).toBe(b);
		expect(ref.current.state.searchValue).toBe("inv");
	});
});

describe("C setters keep local edits through an unrelated re-render", () => {
	it("MailMergeHeaderInput keeps the size of typed text, and follows a new defaultValue", () => {
		const Input = createPackageLoader({
			...base,
			"pick-react-known-prop": { pickHTMLProps: (p) => ({ onChange: p.onChange, onBlur: p.onBlur }) },
			"./mail-merge-token": { default: ({ children }) => <span>{children}</span> },
		})(pkg("composer-mail-merge/lib/mail-merge-header-input.jsx")).default;
		const ref = React.createRef();
		const table = { colAt: () => "col" };
		const view = render(<Input ref={ref} tableDataSource={table} defaultValue="ab" onBlur={() => {}} />);
		const sizeOf = () => ref.current.state.inputSize;
		const start = sizeOf();
		fireEvent.change(view.container.querySelector("input"), { target: { value: "a much longer header" } });
		const typed = sizeOf();
		expect(typed).not.toBe(start);
		view.rerender(<Input ref={ref} tableDataSource={table} defaultValue="ab" onBlur={() => {}} className="x" />);
		expect(sizeOf()).toBe(typed);
		view.rerender(<Input ref={ref} tableDataSource={table} defaultValue="abc" onBlur={() => {}} />);
		expect(sizeOf()).not.toBe(typed);
	});
});
