// Opens every window type in the built app. Each one fails on a renderer
// error not listed in known-errors.json, and on an axe violation above its
// entry in axe-baseline.json.
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import {
	allowPlaywrightEvaluate,
	evaluate,
	fixWindowSize,
	launchApp,
} from "./app.mjs";
import {
	compareToBaseline,
	formatFailures,
	readBaseline,
	updateBaseline,
} from "./axe-baseline.mjs";
import { formatErrors } from "./errors.mjs";
import { WINDOWS } from "./windows.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const OS_DIR = { linux: "linux", darwin: "mac", win32: "windows" }[
	process.platform
];
const referenceDir = path.join(here, "reference", OS_DIR);

const updatingBaseline = process.env.E2E_UPDATE_AXE_BASELINE === "1";
const capturing = process.env.E2E_CAPTURE_REFERENCE === "1";
// Proves the gate: every window logs an error, so every render test fails.
const probeFailure = process.env.E2E_PROBE_FAIL === "1";

// Time for late errors (deferred package loads, first sync attempt) to
// arrive before a window's errors are checked.
const SETTLE_MS = 2_000;

for (const spec of WINDOWS) {
	test.describe(`${spec.type} window`, () => {
		let run;
		let page;

		test.beforeAll(async () => {
			run = await launchApp({ seeded: spec.seeded !== false });
			try {
				page = await spec.open(run);
			} catch (err) {
				err.message += `\n--- app log (tail) ---\n${run.log().slice(-4000)}`;
				throw err;
			}
			if (probeFailure) {
				await evaluate(page, () => {
					console.error("E2E_PROBE_FAIL: deliberate renderer error");
				});
			}
		});

		test.afterAll(async () => {
			await run?.close();
		});

		test("opens with no renderer errors", async () => {
			await page.waitForTimeout(SETTLE_MS);
			const unexpected = run.errors.unexpected(run.known);
			expect(unexpected, formatErrors(unexpected)).toEqual([]);
		});

		test("matches the axe baseline", async () => {
			await fixWindowSize(run, page);
			await allowPlaywrightEvaluate(page);
			const { violations } = await new AxeBuilder({ page })
				// The default mode runs finishRun in a new blank page, which an
				// Electron app can't open.
				.setLegacyMode(true)
				.analyze();
			if (updatingBaseline) {
				const counts = updateBaseline(spec.type, violations);
				console.log(
					`Updated the axe baseline for ${spec.type}: ${JSON.stringify(counts)}`,
				);
				return;
			}
			const failures = compareToBaseline(violations, readBaseline()[spec.type]);
			expect(failures, formatFailures(spec.type, failures)).toEqual([]);
		});

		test("reference screenshot", async () => {
			test.skip(!capturing, "only with --capture-reference");
			mkdirSync(referenceDir, { recursive: true });
			await fixWindowSize(run, page);
			const file = path.join(referenceDir, `${spec.type}.png`);
			await page.screenshot({
				path: file,
				animations: "disabled",
				caret: "hide",
			});
			console.log(`Wrote ${file}`);
		});
	});
}
