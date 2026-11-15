// Electron needs libgbm and libasound on stock Ubuntu 22.04 (#21).
// Explicit deb dependencies replace electron-builder's defaults, so retain them.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const text = readFileSync(path.join(app, "electron-builder.yml"), "utf8");
const deb = text.match(/^deb:[ \t]*\r?\n((?:[ \t]+[^\n]*(?:\n|$)|\r?\n)*)/m)?.[1] ?? "";
const depends = deb.match(/^  depends:[ \t]*\r?\n((?:    -[^\n]*(?:\n|$))*)/m)?.[1] ?? "";
const packages = [...depends.matchAll(/^    - ([\w.-]+)[ \t]*\r?$/gm)].map(
	(match) => match[1],
);

describe("Debian package dependencies", () => {
	it.each([
		"libgtk-3-0",
		"libnotify4",
		"libnss3",
		"libxss1",
		"libxtst6",
		"xdg-utils",
		"libatspi2.0-0",
		"libuuid1",
		"libsecret-1-0",
		"libgbm1",
		"libasound2",
	])("includes %s in deb.depends", (dependency) => {
		expect(packages).toContain(dependency);
	});
});
