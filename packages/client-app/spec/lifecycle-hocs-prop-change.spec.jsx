// Prop-change behaviour of the decorators and containers whose
// componentWillReceiveProps moved to getDerivedStateFromProps or
// componentDidUpdate: they re-derive or re-subscribe when the props they read
// change, not on every parent render, and dispose the old subscription first.
import React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	destroyDraft: vi.fn(),
	sessionForClientId: vi.fn(),
	waitFor: vi.fn((callback) => Promise.resolve(callback())),
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

import ListensToFluxStore from "../src/components/decorators/listens-to-flux-store.jsx";
import ListensToObservable from "../src/components/decorators/listens-to-observable.jsx";
import InflatesDraftClientId from "../src/decorators/inflates-draft-client-id.jsx";
import FluxContainer from "../src/components/flux-container.jsx";

afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());

class Probe extends React.Component {
	static displayName = "LifecycleProbe";
	render() {
		return (
			<button type="button">
				{this.props.label || this.props.draft?.subject || "probe"}
			</button>
		);
	}
}

const label = () => screen.getByRole("button").textContent;

describe("ListensToFluxStore on prop change", () => {
	const store = () => ({ listen: vi.fn(() => vi.fn()) });

	it("renders state derived from the new props on the same render", () => {
		const seen = [];
		const Inner = (props) => {
			seen.push(props.label);
			return <span>{props.label}</span>;
		};
		const Decorated = ListensToFluxStore(Inner, {
			stores: [store()],
			getStateFromStores: ({ name }) => ({ label: `Hi ${name}` }),
		});
		const view = render(<Decorated name="Ada" />);
		view.rerender(<Decorated name="Bea" />);
		// No frame where the wrapped component got Ada's label with Bea's props.
		expect(seen).toEqual(["Hi Ada", "Hi Bea"]);
	});

	it("does not re-derive when re-rendered with the same props", () => {
		const derive = vi.fn(({ name }) => ({ label: name }));
		const Decorated = ListensToFluxStore(Probe, { stores: [store()], getStateFromStores: derive });
		const view = render(<Decorated name="Ada" />);
		const calls = derive.mock.calls.length;
		view.rerender(<Decorated name="Ada" />);
		expect(derive).toHaveBeenCalledTimes(calls);
	});

	it("derives from the current props when a store emits after a change", () => {
		let emit;
		const s = { listen: vi.fn((cb) => { emit = cb; return vi.fn(); }) };
		const Decorated = ListensToFluxStore(Probe, {
			stores: [s],
			getStateFromStores: ({ name }) => ({ label: `store ${name}` }),
		});
		const view = render(<Decorated name="Ada" />);
		view.rerender(<Decorated name="Bea" />);
		act(() => emit());
		expect(label()).toBe("store Bea");
		expect(s.listen).toHaveBeenCalledOnce();
	});
});

describe("ListensToObservable on prop change", () => {
	function observableFor(log) {
		return (props) => ({
			subscribe(callback) {
				const sub = { id: props.id, callback, dispose: vi.fn() };
				log.push(sub);
				return sub;
			},
		});
	}

	it("disposes the old subscription and subscribes for the new props", () => {
		const subs = [];
		const Decorated = ListensToObservable(Probe, {
			getObservable: observableFor(subs),
			getStateFromObservable: (data) => ({ label: data || "initial" }),
		});
		const view = render(<Decorated id="a" />);
		view.rerender(<Decorated id="b" />);
		expect(subs.map((s) => s.id)).toEqual(["a", "b"]);
		expect(subs[0].dispose).toHaveBeenCalledOnce();
		expect(subs[1].dispose).not.toHaveBeenCalled();
		act(() => subs[1].callback("from b"));
		expect(label()).toBe("from b");
	});

	it("keeps its subscription when re-rendered with the same props", () => {
		const subs = [];
		const Decorated = ListensToObservable(Probe, {
			getObservable: observableFor(subs),
			getStateFromObservable: () => ({}),
		});
		const view = render(<Decorated id="a" />);
		view.rerender(<Decorated id="a" />);
		expect(subs).toHaveLength(1);
		expect(subs[0].dispose).not.toHaveBeenCalled();
	});

	it("disposes the new subscription and ignores emissions after unmounting mid-change", () => {
		const subs = [];
		const derive = vi.fn(() => ({}));
		const Decorated = ListensToObservable(Probe, {
			getObservable: observableFor(subs),
			getStateFromObservable: derive,
		});
		const view = render(<Decorated id="a" />);
		view.rerender(<Decorated id="b" />);
		view.unmount();
		expect(subs[1].dispose).toHaveBeenCalledOnce();
		const calls = derive.mock.calls.length;
		subs[1].callback("late");
		expect(derive).toHaveBeenCalledTimes(calls);
	});
});

describe("InflatesDraftClientId on a new draftClientId", () => {
	function makeSession(draftClientId, subject) {
		const unlisten = vi.fn();
		return {
			draftClientId,
			unlisten,
			changes: { commit: vi.fn() },
			draft: vi.fn(() => ({ subject, pristine: false })),
			listen: vi.fn(() => unlisten),
		};
	}

	it("commits and unlistens the old session, then renders the new draft", async () => {
		const a = makeSession("a", "Draft A");
		const b = makeSession("b", "Draft B");
		mocks.sessionForClientId.mockImplementation((id) => Promise.resolve(id === "a" ? a : b));
		const onDraftReady = vi.fn();
		const Decorated = InflatesDraftClientId(Probe);
		const view = render(<Decorated draftClientId="a" onDraftReady={onDraftReady} />);
		await screen.findByRole("button", { name: "Draft A" });
		view.rerender(<Decorated draftClientId="b" onDraftReady={onDraftReady} />);
		expect(a.changes.commit).toHaveBeenCalledOnce();
		expect(a.unlisten).toHaveBeenCalledOnce();
		expect(await screen.findByRole("button", { name: "Draft B" })).toBeDefined();
		expect(mocks.sessionForClientId).toHaveBeenLastCalledWith("b");
		expect(onDraftReady).toHaveBeenCalledTimes(2);
		view.unmount();
		expect(a.unlisten).toHaveBeenCalledOnce();
		expect(b.unlisten).toHaveBeenCalledOnce();
	});

	it("does not re-request the session on an unrelated re-render", async () => {
		const a = makeSession("a", "Draft A");
		mocks.sessionForClientId.mockResolvedValue(a);
		const Decorated = InflatesDraftClientId(Probe);
		const view = render(<Decorated draftClientId="a" extra={1} />);
		await screen.findByRole("button", { name: "Draft A" });
		view.rerender(<Decorated draftClientId="a" extra={2} />);
		expect(mocks.sessionForClientId).toHaveBeenCalledOnce();
		expect(a.changes.commit).not.toHaveBeenCalled();
	});

	it("ignores the new session when it unmounts right after the change", async () => {
		const a = makeSession("a", "Draft A");
		let resolveB;
		mocks.sessionForClientId.mockImplementation((id) =>
			id === "a" ? Promise.resolve(a) : new Promise((resolve) => { resolveB = resolve; }),
		);
		const onDraftReady = vi.fn();
		const Decorated = InflatesDraftClientId(Probe);
		const view = render(<Decorated draftClientId="a" onDraftReady={onDraftReady} />);
		await screen.findByRole("button", { name: "Draft A" });
		view.rerender(<Decorated draftClientId="b" onDraftReady={onDraftReady} />);
		view.unmount();
		const b = makeSession("b", "Draft B");
		await act(async () => resolveB(b));
		expect(b.listen).not.toHaveBeenCalled();
		expect(onDraftReady).toHaveBeenCalledOnce();
	});
});

describe("FluxContainer on prop change", () => {
	const Child = (props) => <span data-testid="child">{props.count}</span>;
	const count = () => screen.getByTestId("child").textContent;

	it("passes state from a new getStateFromStores on the same render", () => {
		const seen = [];
		const Spy = (props) => {
			seen.push(props.count);
			return null;
		};
		const store = { listen: vi.fn(() => vi.fn()) };
		const view = render(
			<FluxContainer stores={[store]} getStateFromStores={() => ({ count: 1 })}>
				<Spy />
			</FluxContainer>,
		);
		view.rerender(
			<FluxContainer stores={[store]} getStateFromStores={() => ({ count: 2 })}>
				<Spy />
			</FluxContainer>,
		);
		expect(seen).toEqual([1, 2]);
	});

	it("keeps its listeners when the stores are the same, and the listener uses the current props", () => {
		let emit;
		const unlisten = vi.fn();
		const store = { listen: vi.fn((cb) => { emit = cb; return unlisten; }) };
		const child = <Child />;
		const view = render(
			<FluxContainer stores={[store]} getStateFromStores={() => ({ count: 1 })}>{child}</FluxContainer>,
		);
		view.rerender(
			<FluxContainer stores={[store]} getStateFromStores={() => ({ count: 2 })}>{child}</FluxContainer>,
		);
		expect(store.listen).toHaveBeenCalledOnce();
		expect(unlisten).not.toHaveBeenCalled();
		view.rerender(
			<FluxContainer stores={[store]} getStateFromStores={() => ({ count: 3 })}>{child}</FluxContainer>,
		);
		act(() => emit());
		expect(count()).toBe("3");
	});

	it("drops the old store's listener before listening to a new store", () => {
		const unlistenA = vi.fn();
		const a = { listen: vi.fn(() => unlistenA) };
		const b = { listen: vi.fn(() => vi.fn()) };
		const get = () => ({ count: 1 });
		const view = render(<FluxContainer stores={[a]} getStateFromStores={get}><Child /></FluxContainer>);
		view.rerender(<FluxContainer stores={[b]} getStateFromStores={get}><Child /></FluxContainer>);
		expect(unlistenA).toHaveBeenCalledOnce();
		expect(b.listen).toHaveBeenCalledOnce();
	});
});
