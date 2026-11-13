// @vitest-environment node
// Stores built while the renderer bundle evaluates subscribe to the bundle's
// placeholder config; replayEarlyConfigSubscriptions moves them onto the real
// one once it has loaded. AccountStore is the case that matters: it must hold
// `nylas.accounts` at boot and reload when they change, in every window.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BANNER } from "../scripts/build-renderer.js";
import { replayEarlyConfigSubscriptions } from "../src/early-config-subscriptions.js";

// A config with the real Config's change semantics (onDidChange fires when a
// key path's value changes after the subscription).
function realConfig(initial) {
	let settings = structuredClone(initial);
	const listeners = [];
	const get = (keyPath) =>
		keyPath ? keyPath.split(".").reduce((v, k) => v?.[k], settings) : settings;
	return {
		get,
		onDidChange(keyPath, callback) {
			const listener = { keyPath, callback, old: structuredClone(get(keyPath)) };
			listeners.push(listener);
			return { dispose: () => listeners.splice(listeners.indexOf(listener), 1) };
		},
		update(next) {
			settings = structuredClone(next);
			for (const l of [...listeners]) {
				const now = get(l.keyPath);
				if (JSON.stringify(now) !== JSON.stringify(l.old)) {
					const event = { oldValue: l.old, newValue: now };
					l.old = structuredClone(now);
					l.callback(event);
				}
			}
		},
		listenerCount: () => listeners.length,
	};
}

const placeholderWindow = (saved) => {
	const win = { location: { search: "" } };
	const require = () => ({
		getGlobal: () => ({ configPersistenceManager: { getRawValuesString: () => JSON.stringify(saved) } }),
	});
	new Function("window", "require", BANNER)(win, require);
	return win;
};

describe("replayEarlyConfigSubscriptions", () => {
	it("moves live subscriptions onto the real config, and later changes reach them", () => {
		const win = placeholderWindow({ a: { b: 1 } });
		const changed = vi.fn();
		win.NylasEnv.config.onDidChange("a.b", changed);
		const config = realConfig({ a: { b: 1 } });
		replayEarlyConfigSubscriptions(config, win);
		expect(win.__nylasEarlyConfigSubscriptions).toBeNull();
		expect(changed).not.toHaveBeenCalled();
		config.update({ a: { b: 2 } });
		expect(changed).toHaveBeenCalledWith({ oldValue: 1, newValue: 2 });
	});

	it("reports a value that changed between the placeholder read and the replay", () => {
		const win = placeholderWindow({ a: { b: 1 } });
		const changed = vi.fn();
		const observed = vi.fn();
		win.NylasEnv.config.onDidChange("a.b", changed);
		win.NylasEnv.config.observe("a.b", observed);
		replayEarlyConfigSubscriptions(realConfig({ a: { b: 5 } }), win);
		expect(changed).toHaveBeenCalledWith({ oldValue: 1, newValue: 5 });
		expect(observed).toHaveBeenLastCalledWith(5);
	});

	it("treats a missing key as unchanged", () => {
		const win = placeholderWindow({});
		const changed = vi.fn();
		win.NylasEnv.config.onDidChange("x.y", changed);
		replayEarlyConfigSubscriptions(realConfig({}), win);
		expect(changed).not.toHaveBeenCalled();
	});

	it("skips a subscription disposed before the replay, and disposes a replayed one", () => {
		const win = placeholderWindow({});
		const gone = win.NylasEnv.config.onDidChange("a", vi.fn());
		gone.dispose();
		const kept = win.NylasEnv.config.onDidChange("b", vi.fn());
		const config = realConfig({});
		replayEarlyConfigSubscriptions(config, win);
		expect(config.listenerCount()).toBe(1);
		kept.dispose();
		expect(config.listenerCount()).toBe(0);
	});

	it("does nothing when there is no placeholder", () => {
		expect(() => replayEarlyConfigSubscriptions(realConfig({}), {})).not.toThrow();
	});
});

describe("AccountStore on the placeholder config", () => {
	const account = (id, email) => ({ id, email_address: email, object: "account" });
	let previousEnv;
	let win;

	beforeEach(() => {
		vi.resetModules();
		previousEnv = globalThis.NylasEnv;
		win = placeholderWindow({
			nylas: { accounts: [account("a1", "me@fixture.test")], accountsVersion: 1 },
		});
		globalThis.NylasEnv = Object.assign(win.NylasEnv, {
			showErrorDialog: vi.fn(),
			reportError: vi.fn(),
		});
		vi.doMock("../src/key-manager.js", () => ({
			default: { getPassword: () => null, replacePassword: vi.fn(), deletePassword: vi.fn() },
		}));
		vi.doMock("../src/flux/stores/database-store.js", () => ({ default: {} }));
	});

	afterEach(() => {
		globalThis.NylasEnv = previousEnv;
		vi.doUnmock("../src/key-manager.js");
		vi.doUnmock("../src/flux/stores/database-store.js");
	});

	it("holds the saved accounts at boot", async () => {
		const { default: AccountStore } = await import("../src/flux/stores/account-store.js");
		expect(AccountStore.accountIds()).toEqual(["a1"]);
	});

	it("reloads when the accounts change on the real config after the replay", async () => {
		const { default: AccountStore } = await import("../src/flux/stores/account-store.js");
		const config = realConfig({
			nylas: { accounts: [account("a1", "me@fixture.test")], accountsVersion: 1 },
		});
		globalThis.NylasEnv.config = config;
		replayEarlyConfigSubscriptions(config, win);
		config.update({
			nylas: {
				accounts: [account("a1", "me@fixture.test"), account("a2", "two@fixture.test")],
				accountsVersion: 2,
			},
		});
		expect(AccountStore.accountIds()).toEqual(["a1", "a2"]);
	});
});
