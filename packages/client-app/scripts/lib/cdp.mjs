// A small Chrome DevTools Protocol client for driving the dev app from Node
// (Node 24's global WebSocket and fetch, no dependencies). Launch Electron
// with --remote-debugging-port=<port>, then find a window by its NylasEnv
// window type and evaluate code in it.
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export class CdpPage {
	constructor(ws) {
		this.ws = ws;
		this.nextId = 1;
		this.pending = new Map();
		this.listeners = new Set();
		ws.addEventListener("message", (event) => {
			const msg = JSON.parse(event.data);
			if (msg.id && this.pending.has(msg.id)) {
				const { resolve, reject } = this.pending.get(msg.id);
				this.pending.delete(msg.id);
				if (msg.error) reject(new Error(msg.error.message));
				else resolve(msg.result);
			} else if (msg.method) {
				for (const listener of this.listeners) listener(msg);
			}
		});
	}

	static connect(webSocketDebuggerUrl) {
		return new Promise((resolve, reject) => {
			const ws = new WebSocket(webSocketDebuggerUrl);
			ws.addEventListener("open", () => resolve(new CdpPage(ws)), {
				once: true,
			});
			ws.addEventListener(
				"error",
				() => reject(new Error("CDP connect failed")),
				{
					once: true,
				},
			);
		});
	}

	send(method, params = {}) {
		const id = this.nextId++;
		return new Promise((resolve, reject) => {
			this.pending.set(id, { resolve, reject });
			this.ws.send(JSON.stringify({ id, method, params }));
		});
	}

	onEvent(listener) {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	// Evaluates an expression (awaiting it if it is a promise) and returns its
	// value, which must be JSON-serialisable.
	async evaluate(expression) {
		const { result, exceptionDetails } = await this.send("Runtime.evaluate", {
			expression,
			awaitPromise: true,
			returnByValue: true,
		});
		if (exceptionDetails) {
			const text =
				exceptionDetails.exception?.description || exceptionDetails.text;
			throw new Error(`evaluate failed: ${text}`);
		}
		return result.value;
	}

	close() {
		this.ws.close();
	}
}

export async function listTargets(port) {
	const res = await fetch(`http://127.0.0.1:${port}/json/list`);
	return res.json();
}

// Polls until a page whose NylasEnv window type is `windowType` is up and
// `ready` (an expression) is truthy in it, then returns a connected CdpPage.
// With `configDirPath`, a matching window from an app on any other config dir
// is an error, not a match.
export async function waitForWindow(
	port,
	windowType,
	{ ready = "true", timeout = 60_000, configDirPath } = {},
) {
	const deadline = Date.now() + timeout;
	while (Date.now() < deadline) {
		let targets = [];
		try {
			targets = await listTargets(port);
		} catch {
			// The debugger port isn't listening yet.
		}
		for (const target of targets.filter((t) => t.type === "page")) {
			let page;
			let found = null;
			try {
				page = await CdpPage.connect(target.webSocketDebuggerUrl);
				found = await page.evaluate(
					`typeof NylasEnv !== "undefined" && NylasEnv.getWindowType() === ${JSON.stringify(windowType)} && !!(${ready}) ? NylasEnv.getConfigDirPath() : null`,
				);
			} catch {
				// The page is still loading or went away.
			}
			if (found !== null && found !== undefined) {
				if (configDirPath === undefined || found === configDirPath) {
					return page;
				}
				page.close();
				throw new Error(
					`the ${windowType} window on port ${port} belongs to an app on ${found}, not ${configDirPath}; refusing to use it`,
				);
			}
			page?.close();
		}
		await sleep(500);
	}
	throw new Error(`timed out waiting for the ${windowType} window`);
}
