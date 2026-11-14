import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The real store on a real temp config dir: the bug (#22) was an async
// mkdir racing a synchronous fs.watch() of the same dirs.
describe("keybase PGPKeyStore key dirs", () => {
	let configDir;
	let store;
	const originalConfigDir = NylasEnv.getConfigDirPath;

	beforeEach(() => {
		configDir = fs.mkdtempSync(path.join(os.tmpdir(), "nylas-keys-"));
		NylasEnv.getConfigDirPath = vi.fn(() => configDir);
		vi.resetModules();
	});

	afterEach(() => {
		store?.unwatch();
		store = null;
		NylasEnv.getConfigDirPath = originalConfigDir;
		fs.rmSync(configDir, { recursive: true, force: true });
	});

	const load = async () => {
		const mod = await import("../internal_packages/keybase/lib/pgp-key-store.jsx");
		store = mod.default || mod;
		// _populate reads both dirs async; let it finish before cleanup.
		await new Promise((resolve) => {
			const stop = store.listen(() => { stop(); resolve(); });
		});
		return store;
	};

	it("creates keys/public and keys/private on a fresh profile, then watches them", async () => {
		const loaded = await load();
		expect(fs.statSync(path.join(configDir, "keys", "public")).isDirectory()).toBe(true);
		expect(fs.statSync(path.join(configDir, "keys", "private")).isDirectory()).toBe(true);
		expect(loaded._pubWatcher).not.toBeNull();
		expect(loaded._privWatcher).not.toBeNull();
	});

	it("creates the subdirs when keys/ exists without them", async () => {
		fs.mkdirSync(path.join(configDir, "keys"));
		const loaded = await load();
		expect(fs.existsSync(path.join(configDir, "keys", "public"))).toBe(true);
		expect(fs.existsSync(path.join(configDir, "keys", "private"))).toBe(true);
		expect(loaded._pubWatcher).not.toBeNull();
		expect(loaded._privWatcher).not.toBeNull();
	});
});
