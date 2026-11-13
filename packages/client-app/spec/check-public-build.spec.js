// Runs the public-build check (scripts/check-public-build.mjs) on fixture
// source trees and fixture packages in a temp dir.
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import asar from "@electron/asar";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
	findPrivateFonts,
	findUploadSettings,
} from "../../../scripts/check-public-build.mjs";

const SRC = "packages/client-app/src";
const script = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"../../../scripts/check-public-build.mjs",
);

let root;
const write = (rel, text = "") => {
	const file = path.join(root, rel);
	mkdirSync(path.dirname(file), { recursive: true });
	writeFileSync(file, text);
};

beforeEach(() => {
	root = mkdtempSync(path.join(os.tmpdir(), "check-public-build-"));
	mkdirSync(path.join(root, SRC), { recursive: true });
});
afterEach(() => {
	rmSync(root, { recursive: true, force: true });
});

describe("check-public-build crash-upload settings", () => {
	it.each([
		["submitURL", '\tsubmitURL: "https://crash.example.test",\n'],
		["autoSubmit", "\tautoSubmit: true,\n"],
		["uploadToServer: true", "\tuploadToServer:true,\n"],
	])("flags %s with file:line", (label, line) => {
		const rel = `${SRC}/browser/probe.js`;
		write(rel, `crashReporter.start({\n${line}});\n`);
		const findings = findUploadSettings(root);
		expect(findings).toHaveLength(1);
		expect(findings[0]).toMatchObject({ file: rel, line: 2 });
		expect(findings[0].text.startsWith(label)).toBe(true);
	});

	it("passes uploads that are off", () => {
		write(
			`${SRC}/error-logger.js`,
			'crashReporter.start({ productName: "Nylas Mail", uploadToServer: false });\n',
		);
		expect(findUploadSettings(root)).toEqual([]);
	});

	it("passes the real source tree", () => {
		expect(findUploadSettings()).toEqual([]);
	});
});

// A built package: resources/app.asar from `files`, plus loose extras.
async function makePackage(resources, files, unpacked = {}) {
	const staging = path.join(root, "staging", path.basename(path.dirname(resources)));
	for (const [rel, text] of Object.entries(files)) {
		mkdirSync(path.dirname(path.join(staging, rel)), { recursive: true });
		writeFileSync(path.join(staging, rel), text);
	}
	mkdirSync(resources, { recursive: true });
	await asar.createPackage(staging, path.join(resources, "app.asar"));
	for (const [rel, text] of Object.entries(unpacked)) {
		const file = path.join(resources, "app.asar.unpacked", rel);
		mkdirSync(path.dirname(file), { recursive: true });
		writeFileSync(file, text);
	}
}

const CLEAN_APP = {
	"package.json": "{}",
	"src/browser/nylas-protocol-handler.js": "// not a font\n",
	"static/fonts/Nylas-Sans.otf": "",
};

describe("check-public-build packages", () => {
	it("flags nylas-private-fonts inside a mac app's asar", async () => {
		const dist = path.join(root, "dist");
		const app = path.join(dist, "mac-arm64", "Nylas Mail.app");
		await makePackage(path.join(app, "Contents", "Resources"), {
			...CLEAN_APP,
			"internal_packages/nylas-private-fonts/package.json": "{}",
		});
		const { findings, empty } = findPrivateFonts([dist]);
		expect(empty).toEqual([]);
		expect(findings).toContainEqual({
			package: app,
			path: "app.asar/internal_packages/nylas-private-fonts",
		});
		expect(findings.every((f) => f.package === app)).toBe(true);
	});

	it("flags a Nylas-Pro font copied elsewhere in an unpacked dir", async () => {
		const dist = path.join(root, "dist");
		const pkg = path.join(dist, "linux-unpacked");
		await makePackage(path.join(pkg, "resources"), CLEAN_APP, {
			"static/fonts/Nylas-Pro-Thin.otf": "",
		});
		const { findings } = findPrivateFonts([dist]);
		expect(findings).toEqual([
			{ package: pkg, path: "app.asar.unpacked/static/fonts/Nylas-Pro-Thin.otf" },
		]);
	});

	it("passes clean mac, Linux and Windows packages", async () => {
		const dist = path.join(root, "dist");
		await makePackage(
			path.join(dist, "mac", "Nylas Mail.app", "Contents", "Resources"),
			CLEAN_APP,
		);
		await makePackage(path.join(dist, "linux-unpacked", "resources"), CLEAN_APP);
		await makePackage(path.join(dist, "win-unpacked", "resources"), CLEAN_APP);
		expect(findPrivateFonts([dist])).toEqual({ findings: [], empty: [] });
	});

	it("reports a dist dir with no package in it", () => {
		const dist = path.join(root, "dist");
		mkdirSync(dist);
		expect(findPrivateFonts([dist]).empty).toEqual([dist]);
	});
});

describe("check-public-build CLI", () => {
	const run = (...dirs) =>
		spawnSync(process.execPath, [script, ...dirs], { encoding: "utf8" });

	it("exits 1 naming the package and path when fonts ship", async () => {
		const dist = path.join(root, "dist");
		const pkg = path.join(dist, "win-unpacked");
		await makePackage(path.join(pkg, "resources"), {
			...CLEAN_APP,
			"internal_packages/nylas-private-fonts/fonts/Nylas-Pro-Normal.otf": "",
		});
		const result = run(dist);
		expect(result.status).toBe(1);
		expect(result.stderr).toContain(
			`${pkg}: app.asar/internal_packages/nylas-private-fonts/fonts/Nylas-Pro-Normal.otf`,
		);
	});

	it("exits 0 on a clean package", async () => {
		const dist = path.join(root, "dist");
		await makePackage(path.join(dist, "linux-unpacked", "resources"), CLEAN_APP);
		const result = run(dist);
		expect(result.stderr).toBe("");
		expect(result.status).toBe(0);
	});
});
