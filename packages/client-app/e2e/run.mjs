// `pnpm --filter nylas-mail e2e [-- <flags>]`: runs the Playwright harness on
// the built app (build it first with `build:e2e`).
//
//   --update-axe-baseline  rewrite e2e/axe-baseline.json from this run
//   --capture-reference    write e2e/reference/<os>/<window>.png
//
// Anything else goes to `playwright test`. The env equivalents are
// E2E_UPDATE_AXE_BASELINE=1 and E2E_CAPTURE_REFERENCE=1.
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const FLAGS = {
	"--update-axe-baseline": "E2E_UPDATE_AXE_BASELINE",
	"--capture-reference": "E2E_CAPTURE_REFERENCE",
};

const env = { ...process.env };
const rest = [];
for (const arg of process.argv.slice(2)) {
	if (arg === "--") continue;
	if (FLAGS[arg]) env[FLAGS[arg]] = "1";
	else rest.push(arg);
}

const cli = createRequire(import.meta.url).resolve("@playwright/test/cli");
const result = spawnSync(
	process.execPath,
	[cli, "test", "--config", path.join(here, "playwright.config.mjs"), ...rest],
	{ stdio: "inherit", env },
);
process.exit(result.status ?? 1);
