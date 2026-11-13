import React from "react";
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
	listen: vi.fn(() => vi.fn()),
	registerSearchRegion: vi.fn(),
	unregisterSearchRegion: vi.fn(),
}));

vi.mock("../src/flux/stores/searchable-component-store.js", () => ({
	default: {
		listen: m.listen,
		registerSearchRegion: m.registerSearchRegion,
		unregisterSearchRegion: m.unregisterSearchRegion,
		getCurrentRegionIndex: () => null,
		getCurrentSearchData: () => ({ searchTerm: "" }),
	},
}));

const { default: SearchableComponentMaker } = await import(
	"../src/searchable-components/searchable-component-maker.jsx"
);

afterEach(cleanup);

// Shaped like MessageList: the root ref is a component (a KeyCommandsRegion
// stand-in) that hands over its own node.
class Region extends React.Component {
	rootRef = React.createRef();
	getDOMNode() {
		return this.rootRef.current;
	}
	render() {
		return (
			<div ref={this.rootRef} className="region">
				{this.props.children}
			</div>
		);
	}
}

// Like MessageList, it defines the update lifecycles the mixin wraps (the
// mixin's versions of those expect a super method to call).
class Searchable extends React.Component {
	state = {};
	shouldComponentUpdate() {
		return true;
	}
	componentDidUpdate() {}
	_setRoot = (value) => {
		this._root = value;
	};
	getDOMNode() {
		return this._root?.getDOMNode ? this._root.getDOMNode() : this._root || null;
	}
	render() {
		return (
			<Region ref={this._setRoot}>
				<p>{this.props.text}</p>
			</Region>
		);
	}
}
SearchableComponentMaker.extend(Searchable);

describe("SearchableComponentMaker", () => {
	beforeEach(() => vi.clearAllMocks());

	it("registers the component's real root node on mount", () => {
		const { container } = render(<Searchable text="hello" />);
		expect(m.registerSearchRegion).toHaveBeenCalledOnce();
		const [regionId, node] = m.registerSearchRegion.mock.calls[0];
		expect(regionId).toEqual(expect.any(String));
		expect(node).toBe(container.querySelector(".region"));
	});

	it("re-registers the same region and node on update", () => {
		const view = render(<Searchable text="hello" />);
		view.rerender(<Searchable text="again" />);
		expect(m.registerSearchRegion).toHaveBeenCalledTimes(2);
		const [first, second] = m.registerSearchRegion.mock.calls;
		expect(second[0]).toBe(first[0]);
		expect(second[1]).toBe(view.container.querySelector(".region"));
	});

	it("unregisters its region and stops listening on unmount", () => {
		const unlisten = vi.fn();
		m.listen.mockReturnValueOnce(unlisten);
		const view = render(<Searchable text="hello" />);
		const [regionId] = m.registerSearchRegion.mock.calls[0];
		view.unmount();
		expect(m.unregisterSearchRegion).toHaveBeenCalledWith(regionId);
		expect(unlisten).toHaveBeenCalledOnce();
	});
});
