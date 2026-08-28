import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => {
	class EventEmitter {
		constructor() { this.listeners = new Map(); this.maxListeners = undefined; }
		setMaxListeners(value) { this.maxListeners = value; return this; }
		addListener(event, callback) {
			const callbacks = this.listeners.get(event) || [];
			callbacks.push(callback);
			this.listeners.set(event, callbacks);
			return this;
		}
		removeListener(event, callback) {
			const callbacks = this.listeners.get(event) || [];
			this.listeners.set(event, callbacks.filter((candidate) => candidate !== callback));
			return this;
		}
		emit(event, ...args) {
			for (const callback of [...(this.listeners.get(event) || [])]) callback(...args);
			return (this.listeners.get(event) || []).length > 0;
		}
	}
	const underscore = { isFunction: (value) => typeof value === "function" };
	const underscoreString = { capitalize: (value) => `${value.charAt(0).toUpperCase()}${value.slice(1)}` };
	return { EventEmitter, underscore, underscoreString };
});

vi.mock("underscore", () => ({ default: m.underscore, ...m.underscore }));
vi.mock("underscore.string", () => ({ default: m.underscoreString, ...m.underscoreString }));
vi.mock("node:events", () => ({ default: { EventEmitter: m.EventEmitter }, EventEmitter: m.EventEmitter }));

globalThis.NylasEnv = {
	isWorkWindow: vi.fn(() => true),
	inSpecMode: vi.fn(() => true),
	inDevMode: vi.fn(() => false),
	reportError: vi.fn(),
	config: { get: vi.fn(() => null), onDidChange: vi.fn(() => ({ dispose: vi.fn() })) },
	getConfigDirPath: vi.fn(() => "/config"),
	getPath: vi.fn(() => "/tmp"),
	getVersion: vi.fn(() => "0.0.0"),
};

const imported = await import("../src/flux/modules/reflux-coffee.js");
const RefluxCoffee = imported.default.Listener ? imported.default : imported.default.default;
const { Listener, Publisher } = RefluxCoffee;

const makePublisher = (properties = {}) => Object.assign({}, Publisher, properties);
const makeListener = (properties = {}) => Object.assign({}, Listener, properties);

describe("RefluxCoffee Publisher composition", () => {
	beforeEach(() => { vi.clearAllMocks(); });



	it("preserves an emitter that is already installed", () => {
		const emitter = new m.EventEmitter();
		const publisher = makePublisher({ _emitter: emitter });
		publisher.setupEmitter();
		expect(publisher._emitter).toBe(emitter);
	});

	it("rejects an undefined listener callback", () => {
		expect(() => makePublisher().listen()).toThrow("@listen called with undefined callback");
	});

	it("delivers every trigger argument to a listener", () => {
		const callback = vi.fn();
		const publisher = makePublisher();
		publisher.listen(callback);
		publisher.trigger("message", 7);
		expect(callback).toHaveBeenCalledWith("message", 7);
	});

	it("binds callbacks to an explicit context", () => {
		const context = { name: "store" };
		const callback = vi.fn(function () { return this; });
		const publisher = makePublisher();
		publisher.listen(callback, context);
		publisher.trigger();
		expect(callback.mock.contexts[0]).toBe(context);
	});

	it("binds callbacks to the publisher by default", () => {
		const callback = vi.fn(function () { return this; });
		const publisher = makePublisher();
		publisher.listen(callback);
		publisher.trigger();
		expect(callback.mock.contexts[0]).toBe(publisher);
	});

	it("returns an unsubscribe function", () => {
		expect(makePublisher().listen(vi.fn())).toEqual(expect.any(Function));
	});

	it("stops delivery after unsubscribe", () => {
		const callback = vi.fn();
		const publisher = makePublisher();
		const unsubscribe = publisher.listen(callback);
		unsubscribe();
		publisher.trigger("ignored");
		expect(callback).not.toHaveBeenCalled();
	});

	it("leaves other subscribers active when one unsubscribes", () => {
		const first = vi.fn();
		const second = vi.fn();
		const publisher = makePublisher();
		publisher.listen(first)();
		publisher.listen(second);
		publisher.trigger("kept");
		expect(second).toHaveBeenCalledWith("kept");
	});

	it("returns false when triggering without listeners", () => {
		expect(makePublisher().trigger("empty")).toBeUndefined();
	});
});

describe("RefluxCoffee Listener subscription lifecycle", () => {
	it("rejects listening to itself", () => {
		const listener = makeListener();
		expect(() => listener.listenTo(listener, vi.fn())).toThrow("Listener is not able to listen to itself");
	});

	it("rejects a circular listener relationship", () => {
		const listenable = makePublisher({ hasListener: vi.fn(() => true) });
		const listener = makeListener();
		expect(() => listener.listenTo(listenable, vi.fn())).toThrow("circular loop");
	});

	it("rejects a listenable without a listen method", () => {
		const log = vi.spyOn(console, "log").mockImplementation(() => {});
		expect(() => makeListener().listenTo({}, vi.fn())).toThrow("missing a listen method");
		log.mockRestore();
	});

	it("rejects an undefined callback", () => {
		expect(() => makeListener().listenTo(makePublisher(), undefined)).toThrow("@listenTo called with undefined callback");
	});

	it("resolves a callback method by name", () => {
		const onChange = vi.fn();
		const listener = makeListener({ onChange });
		const publisher = makePublisher();
		listener.listenTo(publisher, "onChange");
		publisher.trigger("ready");
		expect(onChange).toHaveBeenCalledWith("ready");
	});

	it("binds a direct callback to the listener", () => {
		const callback = vi.fn(function () { return this; });
		const listener = makeListener();
		const publisher = makePublisher();
		listener.listenTo(publisher, callback);
		publisher.trigger();
		expect(callback.mock.contexts[0]).toBe(listener);
	});

	it("records the listenable in its subscription", () => {
		const publisher = makePublisher();
		const subscription = makeListener().listenTo(publisher, vi.fn());
		expect(subscription.listenable).toBe(publisher);
	});

	it("reports a directly subscribed listenable", () => {
		const publisher = makePublisher();
		const listener = makeListener();
		listener.listenTo(publisher, vi.fn());
		expect(listener.hasListener(publisher)).toBe(true);
	});

	it("reports a listenable nested behind a subscription", () => {
		const target = makePublisher();
		const intermediary = makePublisher({ hasListener: vi.fn((value) => value === target) });
		const listener = makeListener();
		listener.listenTo(intermediary, vi.fn());
		expect(listener.hasListener(target)).toBe(true);
	});

	it("returns false for an unrelated listenable", () => {
		const listener = makeListener();
		listener.listenTo(makePublisher(), vi.fn());
		expect(listener.hasListener(makePublisher())).toBe(false);
	});

	it("stops one matching subscription", () => {
		const publisher = makePublisher();
		const listener = makeListener();
		listener.listenTo(publisher, vi.fn());
		expect(listener.stopListeningTo(publisher)).toBe(true);
	});

	it("returns false when no matching subscription exists", () => {
		expect(makeListener().stopListeningTo(makePublisher())).toBe(false);
	});

	it("removes a stopped subscription from the listener", () => {
		const publisher = makePublisher();
		const listener = makeListener();
		listener.listenTo(publisher, vi.fn());
		listener.stopListeningTo(publisher);
		expect(listener.subscriptions).toHaveLength(0);
	});

	it("rejects stopping the same subscription twice", () => {
		const subscription = makeListener().listenTo(makePublisher(), vi.fn());
		subscription.stop();
		expect(() => subscription.stop()).toThrow("already gone");
	});

	it("stops all subscriptions", () => {
		const listener = makeListener();
		listener.listenTo(makePublisher(), vi.fn());
		listener.listenTo(makePublisher(), vi.fn());
		listener.stopListeningToAll();
		expect(listener.subscriptions).toHaveLength(0);
	});
});

describe("RefluxCoffee initial state and listenToMany composition", () => {

	it("resolves an initial-state callback method by name", () => {
		const onInitial = vi.fn();
		const listener = makeListener({ onInitial });
		listener.listenTo(makePublisher({ getInitialState: () => 3 }), vi.fn(), "onInitial");
		expect(onInitial).toHaveBeenCalledWith(3);
	});

	it("passes promised initial state to the default callback", async () => {
		const callback = vi.fn();
		const listener = makeListener();
		listener.listenTo(makePublisher({ getInitialState: () => Promise.resolve("later") }), vi.fn(), callback);
		await Promise.resolve();
		expect(callback).toHaveBeenCalledWith("later");
	});

	it("skips initial state when no default callback is provided", () => {
		const getInitialState = vi.fn(() => "initial");
		makeListener().listenTo(makePublisher({ getInitialState }), vi.fn());
		expect(getInitialState).not.toHaveBeenCalled();
	});

	it("connects a camel-cased onAction method", () => {
		const action = makePublisher();
		const onSaveDraft = vi.fn();
		const listener = makeListener({ onSaveDraft });
		listener.listenToMany({ saveDraft: action });
		action.trigger("draft");
		expect(onSaveDraft).toHaveBeenCalledWith("draft");
	});

	it("falls back to a method matching the action key", () => {
		const action = makePublisher();
		const archive = vi.fn();
		const listener = makeListener({ archive });
		listener.listenToMany({ archive: action });
		action.trigger("thread");
		expect(archive).toHaveBeenCalledWith("thread");
	});

	it("ignores an action without a matching method", () => {
		const listener = makeListener();
		listener.listenToMany({ ignored: makePublisher() });
		expect(listener.subscriptions).toBeUndefined();
	});

	it("connects recursively flattened child actions", () => {
		const completed = makePublisher();
		const send = makePublisher({ children: ["completed"], completed });
		const onSendCompleted = vi.fn();
		const listener = makeListener({ onSendCompleted });
		listener.listenToMany({ send });
		completed.trigger("id-1");
		expect(onSendCompleted).toHaveBeenCalledWith("id-1");
	});

	it("uses an onActionDefault method for initial state", () => {
		const onLoad = vi.fn();
		const onLoadDefault = vi.fn();
		const listener = makeListener({ onLoad, onLoadDefault });
		listener.listenToMany({ load: makePublisher({ getInitialState: () => "cached" }) });
		expect(onLoadDefault).toHaveBeenCalledWith("cached");
	});

	it("uses a key-method default hook for initial state", () => {
		const refresh = vi.fn();
		const refreshDefault = vi.fn();
		const listener = makeListener({ refresh, refreshDefault });
		listener.listenToMany({ refresh: makePublisher({ getInitialState: () => "cached" }) });
		expect(refreshDefault).toHaveBeenCalledWith("cached");
	});
});
