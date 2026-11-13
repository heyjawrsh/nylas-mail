// verify-install-location asks mac users to move the app into /Applications.
// dialog.showMessageBox returns a promise and takes no callback, so the
// answer must be read from the resolved { response } (#14).
import * as remote from "@electron/remote";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { activate } from "../internal_packages/verify-install-location/lib/main.js";

describe("verify-install-location", () => {
	let config;
	let platform;
	let argv0;

	beforeEach(() => {
		config = {};
		platform = Object.getOwnPropertyDescriptor(process, "platform");
		argv0 = process.argv[0];
		Object.defineProperty(process, "platform", { value: "darwin" });
		process.argv[0] = "/Users/someone/Downloads/Nylas Mail.app/Contents/MacOS/Nylas Mail";
		vi.spyOn(NylasEnv, "inDevMode").mockReturnValue(false);
		vi.spyOn(NylasEnv, "inSpecMode").mockReturnValue(false);
		NylasEnv.config = {
			get: (key) => config[key],
			set: (key, value) => {
				config[key] = value;
			},
		};
	});

	afterEach(() => {
		Object.defineProperty(process, "platform", platform);
		process.argv[0] = argv0;
		vi.restoreAllMocks();
	});

	it("saves 'Don't ask again' from the promise result", async () => {
		config.asksAboutAppMove = 2;
		const shown = vi
			.spyOn(remote.dialog, "showMessageBox")
			.mockResolvedValue({ response: 1 });
		activate();
		expect(shown).toHaveBeenCalledTimes(1);
		expect(shown.mock.calls[0]).toHaveLength(1);
		await shown.mock.results[0].value;
		await Promise.resolve();
		expect(config.asksAboutAppMove).toBe(5);
	});

	it("counts an 'Okay' as one more ask", async () => {
		config.asksAboutAppMove = 2;
		const shown = vi
			.spyOn(remote.dialog, "showMessageBox")
			.mockResolvedValue({ response: 0 });
		activate();
		await shown.mock.results[0].value;
		await Promise.resolve();
		expect(config.asksAboutAppMove).toBe(3);
	});

	it("never shows the dialog once asksAboutAppMove reaches 5", () => {
		config.asksAboutAppMove = 5;
		const shown = vi.spyOn(remote.dialog, "showMessageBox");
		activate();
		expect(shown).not.toHaveBeenCalled();
	});
});
