// The one place that knows how the e2e harness runs the app: where the built
// app is, the temporary NYLAS_HOME it runs on, its launch flags, and how
// renderer errors are collected per window. Specs (and later sweeps) build on
// launchApp() and openWindow() instead of copying any of this.
import {
	cpSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FuseState, FuseV1Options, getCurrentFuseWire } from "@electron/fuses";
import { _electron as electron } from "@playwright/test";

import {
	MARKER,
	prepareHome,
	seedFixtureAccount,
	fixtureConfig,
} from "../scripts/seed-fixture-account.mjs";
import { loadKnownErrors, unexpectedErrors } from "./errors.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
export const appDir = path.resolve(here, "..");
// Everything the harness writes stays under e2e/.tmp (gitignored), never a
// real config dir.
export const tmpRoot = process.env.E2E_TMP_DIR || path.join(here, ".tmp");
export const templateHome = path.join(tmpRoot, "seeded-home");

// The fixed window size for screenshots and axe runs.
export const WINDOW_SIZE = { width: 1280, height: 800 };

// The unpacked app electron-builder --dir writes for this machine (see
// scripts/dist.mjs host --dir, run as build:e2e). E2E_APP_PATH overrides it.
export function builtAppPath() {
	if (process.env.E2E_APP_PATH) return path.resolve(process.env.E2E_APP_PATH);
	const dist = path.join(appDir, "dist");
	switch (process.platform) {
		case "darwin":
			return path.join(
				dist,
				process.arch === "arm64" ? "mac-arm64" : "mac",
				"Nylas Mail.app",
				"Contents",
				"MacOS",
				"Nylas Mail",
			);
		case "linux":
			return path.join(dist, "linux-unpacked", "nylas-mail");
		case "win32":
			return path.join(dist, "win-unpacked", "Nylas Mail.exe");
		default:
			throw new Error(`no built app path for ${process.platform}`);
	}
}

// Extra Electron flags from E2E_LAUNCH_ARGS (space-separated). The Linux
// container sets them: root needs --no-sandbox, and under qemu the GPU
// process won't start without --disable-gpu --in-process-gpu --no-zygote.
export function launchArgs() {
	return (process.env.E2E_LAUNCH_ARGS || "").split(/\s+/).filter(Boolean);
}

// Playwright attaches through --inspect, which the
// EnableNodeCliInspectArguments fuse gates. Stop with a clear message rather
// than a launch timeout when the build has it off.
export async function checkBuiltApp(executable = builtAppPath()) {
	if (!existsSync(executable)) {
		throw new Error(
			`No built app at ${executable}. Build it with \`pnpm --filter nylas-mail build:e2e\` (or set E2E_APP_PATH).`,
		);
	}
	const wire = await getCurrentFuseWire(executable);
	const inspect = wire[FuseV1Options.EnableNodeCliInspectArguments];
	if (inspect !== FuseState.ENABLE && inspect !== FuseState.INHERIT) {
		throw new Error(
			`The EnableNodeCliInspectArguments fuse is off in ${executable}, so Playwright can't drive it. Test builds must keep it on (architecture AD-19).`,
		);
	}
	return executable;
}

// Seeds the fixture account once per run into templateHome, with the built
// app itself, so every test can start from a copy.
export async function seedTemplate(executable = builtAppPath()) {
	mkdirSync(tmpRoot, { recursive: true });
	const userDataDir = mkdtempSync(path.join(tmpRoot, "seed-profile-"));
	try {
		return await seedFixtureAccount(templateHome, {
			executable,
			// The seed drives the app over CDP, so on macOS it can keep the
			// main window hidden instead of taking focus (see keepInBackground).
			args: [
				...launchArgs(),
				...(process.platform === "darwin" && process.env.E2E_FOREGROUND !== "1"
					? ["--background"]
					: []),
			],
			userDataDir,
		});
	} finally {
		rmSync(userDataDir, { recursive: true, force: true });
	}
}

// A fresh NYLAS_HOME: a copy of the seeded template, or (seeded: false) an
// empty fixture home with no account, which opens onboarding.
function freshHome({ seeded }) {
	mkdirSync(tmpRoot, { recursive: true });
	const dir = mkdtempSync(path.join(tmpRoot, "run-"));
	const home = path.join(dir, "home");
	if (seeded) {
		if (!existsSync(path.join(templateHome, MARKER))) {
			throw new Error(
				`No seeded template at ${templateHome}; the global setup seeds it.`,
			);
		}
		cpSync(templateHome, home, { recursive: true });
	} else {
		prepareHome(home);
		writeConfig(home, fixtureConfig());
	}
	return { dir, home, userDataDir: path.join(dir, "profile") };
}

function writeConfig(home, config) {
	writeFileSync(
		path.join(home, "config.json"),
		`${JSON.stringify(config, null, 2)}\n`,
	);
}

// Nylas windows replace window.eval with a function that throws (static/
// index.js), and Playwright's page.evaluate compiles through the page's eval,
// so it can't run there. evaluate() goes through the DevTools protocol
// instead, which compiles the expression itself and leaves the app as built.
// `fn` must be free of closures; `arg` must be JSON-serialisable.
const sessions = new WeakMap();
export async function evaluate(page, fn, arg) {
	let session = sessions.get(page);
	if (!session) {
		session = await page.context().newCDPSession(page);
		sessions.set(page, session);
	}
	const expression = `(${fn.toString()})(${arg === undefined ? "" : JSON.stringify(arg)})`;
	const { result, exceptionDetails } = await session.send("Runtime.evaluate", {
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

// Lets Playwright's own page.evaluate (and so @axe-core/playwright) run in a
// Nylas window, by putting back a working global eval. Call it only after
// the window's error check, since it changes the page under test.
export async function allowPlaywrightEvaluate(page) {
	await evaluate(page, () => {
		if (typeof require !== "function") return;
		const vm = require("node:vm");
		window.eval = globalThis.eval = (source) => vm.runInThisContext(source);
	});
}

// Collects page errors and console.error from every window of `app`, each
// tagged with the window it came from.
class ErrorCollector {
	constructor() {
		this.errors = [];
		this.labels = new Map();
	}

	watch(page) {
		page.on("pageerror", (err) =>
			this.errors.push({
				page,
				kind: "pageerror",
				text: String(err?.stack || err),
			}),
		);
		page.on("console", (msg) => {
			if (msg.type() !== "error") return;
			// Chromium's resource errors only name the URL in the location.
			const url = msg.location()?.url;
			const text = msg.text();
			this.errors.push({
				page,
				kind: "console.error",
				text: url && !text.includes(url) ? `${text} (${url})` : text,
			});
		});
	}

	label(page, name) {
		this.labels.set(page, name);
	}

	// Errors not matched by e2e/known-errors.json, with their window's name.
	unexpected(known) {
		const named = [];
		for (const { page, kind, text } of this.errors) {
			named.push({ window: this.nameOf(page), kind, text });
		}
		return unexpectedErrors(named, known);
	}

	nameOf(page) {
		return this.labels.get(page) || page.url() || "unknown window";
	}
}

// On macOS the app's windows would take focus from whatever the person
// running the harness is doing. Run it as an accessory app (no dock icon) and
// open windows without activating them; E2E_FOREGROUND=1 skips this to watch
// a run. Linux runs are under xvfb and need neither.
async function keepInBackground(app) {
	await app.evaluate(({ app: electronApp, BrowserWindow }) => {
		electronApp.setActivationPolicy("accessory");
		BrowserWindow.prototype.show = BrowserWindow.prototype.showInactive;
		BrowserWindow.prototype.focus = () => {};
		electronApp.focus = () => {};
	});
}

// Launches the built app on a fresh temporary NYLAS_HOME. Returns the
// Playwright ElectronApplication plus the error collector and a close() that
// quits the app and deletes the home.
export async function launchApp({ seeded = true } = {}) {
	const executable = builtAppPath();
	// Each attempt gets its own home, so a half-started first attempt can't
	// hold the second's database.
	const attempt = async () => {
		const paths = freshHome({ seeded });
		try {
			const app = await electron.launch({
				executablePath: executable,
				args: [`--user-data-dir=${paths.userDataDir}`, ...launchArgs()],
				env: { ...process.env, NYLAS_HOME: paths.home },
				timeout: 120_000,
			});
			return { app, ...paths };
		} catch (err) {
			rmSync(paths.dir, { recursive: true, force: true });
			throw err;
		}
	};
	let launched;
	try {
		launched = await attempt();
	} catch (err) {
		// Under qemu emulation Playwright's inspector connection sometimes drops
		// while the app boots. Retry that once; any other launch failure, or a
		// second drop, fails the test.
		if (!/socket hang up/.test(err.message)) throw err;
		launched = await attempt();
	}
	const { app, dir, home } = launched;
	if (process.platform === "darwin" && process.env.E2E_FOREGROUND !== "1") {
		await keepInBackground(app);
	}
	const errors = new ErrorCollector();
	const run = { app, home, errors, known: loadKnownErrors() };
	const watch = (page) => {
		errors.watch(page);
		// Name each Nylas window by its type as soon as it has one; hot
		// windows are renamed when they become a composer or popout.
		labelLater(run, page);
	};
	for (const page of app.windows()) watch(page);
	app.on("window", watch);

	let log = "";
	const proc = app.process();
	proc.stdout?.on("data", (chunk) => {
		log += chunk;
	});
	proc.stderr?.on("data", (chunk) => {
		log += chunk;
	});

	return Object.assign(run, {
		log: () => log,
		async close() {
			const exited = new Promise((resolve) => {
				if (proc.exitCode !== null || proc.signalCode !== null) resolve();
				else proc.once("exit", resolve);
			});
			// app.close() quits through the main process, which can wait on a
			// window that won't close (an open draft, say). Kill it after 15 s.
			const timer = setTimeout(() => proc.kill("SIGKILL"), 15_000);
			await Promise.race([app.close().catch(() => {}), exited]);
			await exited;
			clearTimeout(timer);
			rmSync(dir, { recursive: true, force: true });
		},
	});
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const windowTypeOf = (page) =>
	evaluate(page, () =>
		typeof NylasEnv === "undefined" ? null : NylasEnv.getWindowType(),
	).catch(() => null);

async function labelLater(run, page) {
	for (let i = 0; i < 120 && !page.isClosed(); i++) {
		const type = await windowTypeOf(page);
		if (type && type !== "emptyWindow") {
			if (!run.errors.labels.has(page)) run.errors.label(page, type);
			return;
		}
		await sleep(500);
	}
}

// Waits for a Nylas window of `windowType` whose `ready` function (run in the
// page, closure-free) returns truthy. Hot windows change type in place, so
// this polls every window rather than waiting for a new one.
export async function waitForWindowType(
	run,
	windowType,
	{ ready = () => true, timeout = 60_000 } = {},
) {
	const deadline = Date.now() + timeout;
	const check = `(type) => typeof NylasEnv !== "undefined" && NylasEnv.getWindowType() === type && !!(${ready.toString()})()`;
	while (Date.now() < deadline) {
		for (const page of run.app.windows()) {
			if (page.isClosed()) continue;
			const ok = await evaluate(page, check, windowType).catch(() => false);
			if (ok) {
				run.errors.label(page, windowType);
				return page;
			}
		}
		await sleep(250);
	}
	throw new Error(`timed out waiting for the ${windowType} window`);
}

// Waits for a window that isn't a Nylas window (the print window), by URL.
export async function waitForUrl(run, pattern, label, timeout = 30_000) {
	const deadline = Date.now() + timeout;
	while (Date.now() < deadline) {
		const page = run.app.windows().find((p) => pattern.test(p.url()));
		if (page) {
			await page.waitForLoadState("load");
			run.errors.label(page, label);
			return page;
		}
		await sleep(250);
	}
	throw new Error(`timed out waiting for the ${label} window`);
}

// Sets the window under `page` to WINDOW_SIZE (content size) and waits for
// layout to settle.
export async function fixWindowSize(run, page) {
	const win = await run.app.browserWindow(page);
	await win.evaluate((w, size) => {
		w.setContentSize(size.width, size.height);
		w.center();
		// The work window is never shown, and a hidden window paints no frames
		// to screenshot. Show it without focus.
		if (!w.isVisible()) w.showInactive();
	}, WINDOW_SIZE);
	await evaluate(
		page,
		() =>
			new Promise((resolve) =>
				requestAnimationFrame(() => setTimeout(resolve, 300)),
			),
	);
}
