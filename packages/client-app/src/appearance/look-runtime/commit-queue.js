import { flushSync } from "react-dom";
import { resolveLook } from "./resolve-look";

const FLAGS = [
	"data-increased-contrast",
	"data-forced-colors",
	"data-reduced-motion",
	"data-reduced-transparency",
];

export function applyLookAttributes(root, attributes) {
	for (const [name, value] of Object.entries(attributes)) {
		if (root.getAttribute(name) !== value) root.setAttribute(name, value);
	}
	for (const name of FLAGS) {
		if (!Object.hasOwn(attributes, name) && root.hasAttribute(name)) {
			root.removeAttribute(name);
		}
	}
}

function mergeState(state, change) {
	const next = { ...state, ...change };
	for (const key of ["applied", "overrides", "signals"]) {
		if (Object.hasOwn(change, key)) {
			next[key] = { ...state[key], ...change[key] };
		}
	}
	return next;
}

export function createLookRuntime({
	root,
	state,
	shell,
	flush = () => flushSync(() => {}),
}) {
	const document = root.ownerDocument;
	const hooks = new Set();
	const listeners = new Set();
	let current =
		state.attributes ||
		resolveLook(state.applied, state.overrides, state.signals, state.library);
	let pending = null;
	let running = false;

	const subscribe = (set, callback) => {
		set.add(callback);
		return { dispose: () => set.delete(callback) };
	};

	async function apply(attributes) {
		const fontChanged =
			root.getAttribute("data-font") !== attributes["data-font"];
		applyLookAttributes(root, attributes);
		if (fontChanged && document.fonts?.load) {
			const style = document.defaultView.getComputedStyle(root);
			await document.fonts.load(
				style.font ||
					`${style.fontSize || "16px"} ${style.fontFamily || "sans-serif"}`,
			);
		}
		for (const hook of hooks) await hook(attributes);
		await flush();
		await shell.setWindowChrome(attributes);
		current = attributes;
		for (const listener of listeners) listener(attributes);
	}

	async function drain(batch) {
		running = true;
		while (batch) {
			try {
				state = mergeState(state, batch.change);
				const attributes = resolveLook(
					state.applied,
					state.overrides,
					state.signals,
					state.library,
				);
				if (
					batch.transition &&
					document.startViewTransition &&
					!Object.hasOwn(attributes, "data-reduced-motion")
				) {
					const transition = document.startViewTransition(() =>
						apply(attributes),
					);
					// Skipped animations reject ready; the DOM update still runs.
					transition.ready.catch(() => {});
					await Promise.all([
						transition.updateCallbackDone,
						transition.finished,
					]);
				} else {
					await apply(attributes);
				}
				for (const waiter of batch.waiters) waiter.resolve(attributes);
			} catch (error) {
				for (const waiter of batch.waiters) waiter.reject(error);
			}
			batch = pending;
			pending = null;
		}
		running = false;
	}

	return {
		get current() {
			return current;
		},
		beforeFlush: (callback) => subscribe(hooks, callback),
		onLookChanged: (callback) => subscribe(listeners, callback),
		commit(change, { transition = false } = {}) {
			return new Promise((resolve, reject) => {
				if (running) {
					if (!pending) pending = { change: {}, waiters: [] };
					pending.change = mergeState(pending.change, change);
					pending.transition = transition;
					pending.waiters.push({ resolve, reject });
				} else {
					void drain({ change, transition, waiters: [{ resolve, reject }] });
				}
			});
		},
	};
}
