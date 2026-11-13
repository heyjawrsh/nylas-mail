// The real-app harness (architecture AD-19): Playwright drives the built,
// unpacked app on a temporary NYLAS_HOME. Run it with
// `pnpm --filter nylas-mail e2e` (see e2e/run.mjs).
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "@playwright/test";

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	testDir: here,
	testMatch: /.*\.spec\.mjs$/,
	globalSetup: path.join(here, "global-setup.mjs"),
	outputDir: path.join(here, ".tmp", "test-results"),
	// One app at a time: each describe launches its own copy of the app, and
	// qemu-emulated CI-like runs are slow enough already.
	workers: 1,
	fullyParallel: false,
	retries: 0,
	forbidOnly: !!process.env.CI,
	timeout: 180_000,
	expect: { timeout: 15_000 },
	reporter: [
		["list"],
		[
			"html",
			{ outputFolder: path.join(here, ".tmp", "report"), open: "never" },
		],
	],
});
