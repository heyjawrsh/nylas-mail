import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
	abort: vi.fn(),
	accountToken: vi.fn(() => "account-token"),
	identity: vi.fn(() => ({ token: "identity-token" })),
	httpRequest: vi.fn(),
	httpsRequest: vi.fn(),
	requestEnd: vi.fn(),
	removeRequestListeners: vi.fn(),
	setKeepAlive: vi.fn(),
	setTimeout: vi.fn(),
}));

vi.mock("node:module", () => {
	const createRequire = () => (name) => name === "node:http"
		? { request: m.httpRequest }
		: { request: m.httpsRequest };
	return { default: { createRequire }, createRequire };
});
vi.mock("underscore", () => {
	const exports = {
		values: (object) => Object.values(object || {}),
		uniq: (items) => [...new Set(items || [])],
		extend: (target, ...sources) => Object.assign(target, ...sources),
		extendOwn: (target, ...sources) => Object.assign(target, ...sources),
		debounce: (fn) => fn,
		throttle: (fn) => function throttled(...args) { return fn.apply(this, args); },
		last: (items) => items?.[items.length - 1],
	};
	return { default: exports, ...exports };
});
vi.mock("node:url", () => ({
	default: { parse: (value) => ({ href: value }) },
}));
vi.mock("event-kit", () => ({
	Emitter: class Emitter {
		constructor() { this.listeners = new Map(); }
		on(name, callback) { this.listeners.set(name, callback); }
		emit(name, value) { this.listeners.get(name)?.(value); }
	},
}));
vi.mock("nylas-exports", () => ({
	default: { IdentityStore: { identity: m.identity } },
}));
vi.mock("../src/flux/errors.js", () => ({
	APIError: class APIError extends Error {
		constructor(options = {}) {
			super(options.message || options.error?.message);
			Object.assign(this, options);
		}
	},
}));

import NylasLongConnection from "../src/flux/nylas-long-connection.js";

class FakeEvents {
	constructor(values = {}) { Object.assign(this, values); this.handlers = {}; }
	on(name, callback) { this.handlers[name] = callback; return this; }
	emit(name, ...args) { return this.handlers[name]?.(...args); }
	removeAllListeners = vi.fn();
}

const makeRequest = () => Object.assign(new FakeEvents(), {
	abort: m.abort,
	end: m.requestEnd,
	removeAllListeners: m.removeRequestListeners,
	setSocketKeepAlive: m.setKeepAlive,
	setTimeout: m.setTimeout,
});

const makeConnection = (overrides = {}) => new NylasLongConnection({
	api: {
		APIRoot: "https://api.example.com",
		accessTokenForAccountId: m.accountToken,
	},
	accountId: "account-1",
	path: "/delta/streaming",
	...overrides,
});

describe("NylasLongConnection", () => {
	let request;
	let response;
	let socket;
	let respond;

	beforeEach(() => {
		vi.clearAllMocks();
		vi.useFakeTimers();
		m.accountToken.mockReturnValue("account-token");
		m.identity.mockReturnValue({ token: "identity-token" });
		request = makeRequest();
		response = new FakeEvents({ statusCode: 200, setEncoding: vi.fn() });
		socket = new FakeEvents();
		m.httpsRequest.mockImplementation((options, callback) => {
			respond = () => callback(response);
			return request;
		});
		m.httpRequest.mockImplementation((options, callback) => {
			respond = () => callback(response);
			return request;
		});
	});

	it("starts with no connection status", () => {
		expect(makeConnection().status).toBe(NylasLongConnection.Status.None);
	});

	it("exposes its account id", () => {
		expect(makeConnection().accountId).toBe("account-1");
	});

	it("can start when new", () => {
		expect(makeConnection().canStart()).toBe(true);
	});

	it("cannot start while connecting", () => {
		const connection = makeConnection();
		connection.setStatus(NylasLongConnection.Status.Connecting);
		expect(connection.canStart()).toBe(false);
	});

	it("can restart after closing", () => {
		const connection = makeConnection();
		connection.setStatus(NylasLongConnection.Status.Closed);
		expect(connection.canStart()).toBe(true);
	});

	it("reports status changes once", () => {
		const onStatusChanged = vi.fn();
		const connection = makeConnection({ onStatusChanged });
		connection.setStatus(NylasLongConnection.Status.Connecting);
		connection.setStatus(NylasLongConnection.Status.Connecting);
		expect(onStatusChanged).toHaveBeenCalledOnce();
	});

	it("parses complete newline-delimited results", () => {
		const onResults = vi.fn();
		const connection = makeConnection({ onResults });
		connection._buffer = '{"id":1}\n{"id":2}\n';
		connection._processBuffer();
		expect(onResults).toHaveBeenCalledWith([{ id: 1 }, { id: 2 }]);
	});

	it("retains an incomplete trailing result", () => {
		const connection = makeConnection();
		connection._buffer = '{"id":1}\n{"id"';
		connection._processBuffer();
		expect(connection._buffer).toBe('{"id"');
	});

	it("skips malformed JSON and continues parsing", () => {
		const onResults = vi.fn();
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const connection = makeConnection({ onResults });
		connection._buffer = 'bad\n{"id":2}\n';
		connection._processBuffer();
		expect(onResults).toHaveBeenCalledWith([{ id: 2 }]);
		warn.mockRestore();
	});

	it("does not publish an empty buffer", () => {
		const onResults = vi.fn();
		makeConnection({ onResults })._processBuffer();
		expect(onResults).not.toHaveBeenCalled();
	});

	it("opens HTTPS roots with the HTTPS client", () => {
		makeConnection().start();
		expect(m.httpsRequest).toHaveBeenCalledOnce();
	});

	it("opens HTTP roots with the HTTP client", () => {
		makeConnection({ api: { APIRoot: "http://localhost", accessTokenForAccountId: m.accountToken } }).start();
		expect(m.httpRequest).toHaveBeenCalledOnce();
	});

	it("authenticates with account and identity tokens", () => {
		makeConnection().start();
		expect(m.httpsRequest.mock.calls[0][0].auth).toBe("account-token:identity-token");
	});

	it("uses an empty identity token when signed out", () => {
		m.identity.mockReturnValue(null);
		makeConnection().start();
		expect(m.httpsRequest.mock.calls[0][0].auth).toBe("account-token:");
	});

	it("sets a one-hour request timeout", () => {
		makeConnection().start();
		expect(m.setTimeout).toHaveBeenCalledWith(60 * 60 * 1000);
	});

	it("enables socket keepalive", () => {
		makeConnection().start();
		expect(m.setKeepAlive).toHaveBeenCalledWith(true);
	});

	it("ends the request to begin streaming", () => {
		makeConnection().start();
		expect(m.requestEnd).toHaveBeenCalledOnce();
	});

	it("does not start the same request twice", () => {
		const connection = makeConnection();
		connection.start();
		connection.start();
		expect(m.httpsRequest).toHaveBeenCalledOnce();
	});

	it("transitions from connecting to connected with the socket", () => {
		const onStatusChanged = vi.fn();
		const connection = makeConnection({ onStatusChanged }).start();
		request.emit("socket", socket);
		socket.emit("connect");
		expect(onStatusChanged.mock.calls.map(([status]) => status)).toEqual(["connecting", "connected"]);
	});

	it("decodes successful response streams as UTF-8", () => {
		makeConnection().start();
		respond();
		expect(response.setEncoding).toHaveBeenCalledWith("utf8");
	});

	it("publishes data received from a successful stream", () => {
		const onResults = vi.fn();
		makeConnection({ onResults }).start();
		respond();
		response.emit("data", '{"id":1}\n');
		expect(onResults).toHaveBeenCalledWith([{ id: 1 }]);
	});

	it("ignores a standalone newline ping on an empty buffer", () => {
		const connection = makeConnection().start();
		respond();
		response.emit("data", "\n");
		expect(connection._buffer).toBe("");
	});

	it("closes after the configured heartbeat interval", () => {
		const connection = makeConnection({ closeIfDataStopsInterval: 250 });
		connection.setStatus(NylasLongConnection.Status.Connected);
		connection.closeIfDataStops();
		vi.advanceTimersByTime(250);
		expect(connection.status).toBe(NylasLongConnection.Status.Closed);
	});

	it("new data resets the heartbeat deadline", () => {
		const connection = makeConnection({ closeIfDataStopsInterval: 250 }).start();
		respond();
		connection.closeIfDataStops();
		vi.advanceTimersByTime(200);
		response.emit("data", '{"id":1}\n');
		vi.advanceTimersByTime(200);
		expect(connection.status).not.toBe(NylasLongConnection.Status.Closed);
	});

	it("turns a non-200 response body into an API error", () => {
		const onError = vi.fn();
		response.statusCode = 503;
		const connection = makeConnection({ onError }).start();
		respond();
		response.emit("data", Buffer.from("Unavailable"));
		expect(onError.mock.calls[0][0]).toMatchObject({ message: "Unavailable", statusCode: 503 });
	});

	it("reports a missing account token asynchronously", async () => {
		const onError = vi.fn();
		m.accountToken.mockReturnValue(null);
		makeConnection({ onError }).start();
		expect(onError).not.toHaveBeenCalled();
		await vi.runAllTimersAsync();
		expect(onError.mock.calls[0][0]).toMatchObject({ statusCode: 401 });
	});

	it("closes when the response stream ends", () => {
		const connection = makeConnection().start();
		respond();
		response.emit("end");
		expect(connection.status).toBe(NylasLongConnection.Status.Closed);
	});

	it("aborts an active request when closing", () => {
		const connection = makeConnection().start();
		respond();
		connection.close();
		expect(m.abort).toHaveBeenCalledOnce();
	});

	it("detaches request listeners when closing", () => {
		const connection = makeConnection().start();
		connection.close();
		expect(m.removeRequestListeners).toHaveBeenCalledOnce();
	});

	it("detaches response listeners when closing", () => {
		const connection = makeConnection().start();
		respond();
		connection.close();
		expect(response.removeAllListeners).toHaveBeenCalledOnce();
	});

	it("ends permanently when requested", () => {
		const connection = makeConnection();
		connection.end();
		expect(connection.status).toBe(NylasLongConnection.Status.Ended);
	});

	it("discards an unterminated final JSON fragment on disposal", () => {
		const onResults = vi.fn();
		const connection = makeConnection({ onResults });
		connection._buffer = '{"id":1}';
		connection.close();
		// Disposal processes once, but the parser deliberately waits for a newline.
		expect(onResults).not.toHaveBeenCalled();
		expect(connection._buffer).toBe("");
	});
});
