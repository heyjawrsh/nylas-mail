// MultiselectList on prop change: new props tear down its WorkspaceStore
// listener and set a new one up, with a handler built from the new props; an
// unrelated (deep-equal) re-render keeps them.
import React from "react";
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
	unlisteners: [],
	listen: null,
	handlerProps: [],
}));

vi.mock("nylas-exports", () => {
	m.listen = vi.fn(() => {
		const unlisten = vi.fn();
		m.unlisteners.push(unlisten);
		return unlisten;
	});
	const exports = {
		Actions: {},
		AccountStore: {},
		Utils: {
			fastOmit: (object, keys) => Object.fromEntries(Object.entries(object).filter(([key]) => !keys.includes(key))),
		},
		WorkspaceStore: { layoutMode: () => "list", listen: (...args) => m.listen(...args), topSheet: () => ({ root: true }) },
	};
	return { default: exports, ...exports };
});
vi.mock("nylas-component-kit", () => {
	class KeyCommandsRegion extends React.Component {
		render() {
			return <div className={this.props.className}>{this.props.children}</div>;
		}
	}
	return { default: { KeyCommandsRegion }, KeyCommandsRegion };
});
vi.mock("../src/components/list-tabular.jsx", () => {
	class ListTabular extends React.Component {
		static Column = class Column {
			constructor(options) {
				Object.assign(this, options);
			}
		};
		render() {
			return <div className="list" />;
		}
	}
	return { default: ListTabular };
});
vi.mock("../src/components/spinner.jsx", () => ({ default: () => null }));
vi.mock("../src/components/multiselect-list-interaction-handler.js", () => ({
	default: class Handler {
		constructor(props) {
			m.handlerProps.push(props);
		}
		cssClass() {
			return "handler";
		}
	},
}));
vi.mock("../src/components/multiselect-split-interaction-handler.js", () => ({
	default: class Handler {
		cssClass() {
			return "handler";
		}
	},
}));

const { default: MultiselectList } = await import("../src/components/multiselect-list.jsx");

afterEach(cleanup);
beforeEach(() => {
	m.unlisteners.length = 0;
	m.handlerProps.length = 0;
	m.listen.mockClear();
});

const columns = [{ name: "Subject" }];
const itemPropsProvider = () => ({});
const ids = () => [];
const source = (name) => ({ name, selection: { ids } });
const list = (dataSource, extra = {}) => (
	<MultiselectList className="mail" columns={columns} itemPropsProvider={itemPropsProvider} dataSource={dataSource} {...extra} />
);

describe("MultiselectList on prop change", () => {
	it("tears down its listener and sets up a new one for a new dataSource", () => {
		const a = source("a");
		const b = source("b");
		const view = render(list(a));
		expect(m.listen).toHaveBeenCalledOnce();
		view.rerender(list(b));
		expect(m.unlisteners[0]).toHaveBeenCalledOnce();
		expect(m.listen).toHaveBeenCalledTimes(2);
		expect(m.unlisteners[1]).not.toHaveBeenCalled();
		expect(m.handlerProps.at(-1).dataSource).toBe(b);
		view.unmount();
		expect(m.unlisteners[1]).toHaveBeenCalledOnce();
	});

	it("keeps its listener on an unrelated re-render", () => {
		const view = render(list(source("a")));
		view.rerender(list(source("a")));
		expect(m.listen).toHaveBeenCalledOnce();
		expect(m.unlisteners[0]).not.toHaveBeenCalled();
	});
});
