// Prop-change behaviour of the list and scroll components whose
// componentWillReceiveProps moved to getDerivedStateFromProps,
// getSnapshotBeforeUpdate or componentDidUpdate.
import React from "react";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ListDataSource from "../src/components/list-data-source.js";
import ListTabular from "../src/components/list-tabular.jsx";
import LazyRenderedList from "../src/components/lazy-rendered-list.jsx";
import MultiselectActionBar from "../src/components/multiselect-action-bar.jsx";
import KeyCommandsRegion from "../src/components/key-commands-region.jsx";
import SwipeContainer from "../src/components/swipe-container.jsx";

afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());

class FixtureSource extends ListDataSource {
	constructor(ids) {
		super();
		this.items = ids.map((id) => ({ id }));
	}
	loaded() {
		return true;
	}
	empty() {
		return this.items.length === 0;
	}
	get(idx) {
		return this.items[idx] || null;
	}
	count() {
		return this.items.length;
	}
	setRetainedRange() {}
}

describe("ListTabular on a new dataSource", () => {
	const renderedIds = [];
	const columns = [
		new ListTabular.Column({
			name: "id",
			resolver: (item) => {
				renderedIds.push(item.id);
				return <span className="cell">{item.id}</span>;
			},
		}),
	];
	const list = (dataSource) => <ListTabular dataSource={dataSource} columns={columns} itemHeight={20} />;
	const cells = (container) => [...container.querySelectorAll(".cell")].map((n) => n.textContent);

	beforeEach(() => {
		renderedIds.length = 0;
	});

	it("never renders the old source's rows after the swap", () => {
		const a = new FixtureSource(["a1", "a2"]);
		const b = new FixtureSource(["b1"]);
		const view = render(list(a));
		expect(cells(view.container)).toEqual(["a1", "a2"]);
		renderedIds.length = 0;
		view.rerender(list(b));
		expect(renderedIds.filter((id) => id.startsWith("a"))).toEqual([]);
		expect(cells(view.container)).toEqual(["b1"]);
	});

	it("stops listening to the old source and listens to the new one", () => {
		const a = new FixtureSource(["a1"]);
		const b = new FixtureSource(["b1"]);
		const view = render(list(a));
		view.rerender(list(b));
		expect(a._emitter.listenerCount("trigger")).toBe(0);
		expect(b._emitter.listenerCount("trigger")).toBe(1);
		b.items = [{ id: "b1" }, { id: "b2" }];
		act(() => b.trigger());
		expect(cells(view.container)).toEqual(["b1", "b2"]);
		view.unmount();
		expect(b._emitter.listenerCount("trigger")).toBe(0);
	});
});

describe("LazyRenderedList on new items", () => {
	const Item = ({ item }) => <div className="item">{item}</div>;
	const lazy = (items) => (
		<LazyRenderedList items={items} itemHeight={10} containerHeight={20} ItemRenderer={Item} RootRenderer="div" />
	);

	it("recomputes its range for the new items", () => {
		const view = render(lazy(["a"]));
		expect(view.container.querySelectorAll(".item")).toHaveLength(1);
		view.rerender(lazy(Array.from({ length: 20 }, (_, i) => `i${i}`)));
		// 4 container heights of 2 items each.
		expect(view.container.querySelectorAll(".item")).toHaveLength(8);
	});

	it("reads scrollTop from before the update", () => {
		const items = Array.from({ length: 100 }, (_, i) => `i${i}`);
		const view = render(lazy(items));
		const root = view.container.firstChild;
		root.scrollTop = 500;
		view.rerender(lazy([...items]));
		// scrollTop 500 / itemHeight 10 = row 50, less two bodies of 2 rows.
		expect(view.container.querySelector(".item").textContent).toBe("i46");
	});
});

describe("MultiselectActionBar on a new dataSource", () => {
	const source = () => {
		const unlisten = vi.fn();
		return {
			unlisten,
			selection: { items: () => [] },
			listen: vi.fn(() => unlisten),
		};
	};

	it("re-subscribes even when the new source compares equal to the old", () => {
		const a = source();
		const b = source();
		const view = render(<MultiselectActionBar collection="thread" dataSource={a} />);
		view.rerender(<MultiselectActionBar collection="thread" dataSource={b} />);
		expect(a.unlisten).toHaveBeenCalledOnce();
		expect(b.listen).toHaveBeenCalledOnce();
	});

	it("keeps its subscription on an unrelated re-render", () => {
		const a = source();
		const view = render(<MultiselectActionBar collection="thread" dataSource={a} />);
		view.rerender(<MultiselectActionBar collection="thread" dataSource={a} />);
		expect(a.unlisten).not.toHaveBeenCalled();
		expect(a.listen).toHaveBeenCalledOnce();
	});
});

describe("KeyCommandsRegion on new handlers", () => {
	it("swaps its command registration for the new handlers", () => {
		const first = { "core:a": () => {} };
		const second = { "core:b": () => {} };
		const view = render(<KeyCommandsRegion localHandlers={first} />);
		const [firstDisposable] = NylasEnv.commands.add.mock.results.map((r) => r.value);
		view.rerender(<KeyCommandsRegion localHandlers={second} />);
		expect(firstDisposable.dispose).toHaveBeenCalledOnce();
		expect(NylasEnv.commands.add).toHaveBeenLastCalledWith(expect.anything(), second);
	});

	it("keeps its registration when only its focus state changes", () => {
		const view = render(<KeyCommandsRegion localHandlers={{ "core:a": () => {} }} />);
		const calls = NylasEnv.commands.add.mock.calls.length;
		act(() => window.dispatchEvent(new Event("browser-window-blur")));
		expect(NylasEnv.commands.add).toHaveBeenCalledTimes(calls);
		view.unmount();
	});

	it("re-adds the global menu only when its items change", () => {
		const items = [{ label: "Edit" }];
		const view = render(<KeyCommandsRegion globalMenuItems={items} />);
		view.rerender(<KeyCommandsRegion globalMenuItems={[{ label: "Edit" }]} />);
		expect(NylasEnv.menu.add).toHaveBeenCalledOnce();
		view.rerender(<KeyCommandsRegion globalMenuItems={[{ label: "View" }]} />);
		expect(NylasEnv.menu.add).toHaveBeenCalledTimes(2);
	});
});

describe("SwipeContainer enabled cache", () => {
	it("keeps the cache across a setState-only render", () => {
		const shouldEnableSwipe = vi.fn(() => true);
		const ref = React.createRef();
		render(
			<SwipeContainer ref={ref} onSwipeLeft={() => {}} shouldEnableSwipe={shouldEnableSwipe}>
				<span>Row</span>
			</SwipeContainer>,
		);
		ref.current._isEnabled();
		act(() => ref.current.setState({ currentX: 1 }));
		ref.current._isEnabled();
		expect(shouldEnableSwipe).toHaveBeenCalledOnce();
	});

	it("recomputes it after a new shouldEnableSwipe prop", () => {
		const ref = React.createRef();
		const view = render(
			<SwipeContainer ref={ref} onSwipeLeft={() => {}} shouldEnableSwipe={() => true}>
				<span>Row</span>
			</SwipeContainer>,
		);
		expect(ref.current._isEnabled()).toBe(true);
		const disabled = vi.fn(() => false);
		view.rerender(
			<SwipeContainer ref={ref} onSwipeLeft={() => {}} shouldEnableSwipe={disabled}>
				<span>Row</span>
			</SwipeContainer>,
		);
		expect(ref.current._isEnabled()).toBe(false);
		expect(disabled).toHaveBeenCalledOnce();
	});
});
