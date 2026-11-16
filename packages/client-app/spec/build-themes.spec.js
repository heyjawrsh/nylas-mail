// @vitest-environment node
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildThemes, HC_ALLOWANCE } from "../scripts/build-themes.mjs";

const require = createRequire(import.meta.url);
const {
	ROLES,
	VARIANTS,
} = require("../src/appearance/theme-compiler/contract.js");
const script = fileURLToPath(
	new URL("../scripts/build-themes.mjs", import.meta.url),
);
const execFileAsync = promisify(execFile);
const color = (hex) => ({ colorSpace: "srgb", components: [0, 0, 0], hex });
function fixture(id = "classic", variants = ["light", "dark"]) {
	return {
		$schema: "https://www.designtokens.org/schemas/2025.10/format.json",
		$extensions: {
			"org.nylas.theme": {
				id,
				name: id,
				author: "Nylas",
				version: "1.0.0",
				license: "GPL-3.0",
			},
		},
		...Object.fromEntries(
			variants.map((variant) => [
				variant,
				Object.fromEntries(
					Object.entries(ROLES).map(([role, type]) => [
						role,
						{
							$type: type,
							$value: {
								color: color(role === "text-strong" ? "#000000" : "#ffffff"),
								dimension: { value: 14, unit: "px" },
								fontFamily: "Example Sans",
								fontWeight: 400,
								number: 1.5,
								shadow: {
									color: { ...color("#000000"), alpha: 0 },
									offsetX: { value: 0, unit: "px" },
									offsetY: { value: 0, unit: "px" },
									blur: { value: 0, unit: "px" },
									spread: { value: 0, unit: "px" },
								},
							}[type],
						},
					]),
				),
			]),
		),
	};
}
let dir;
let logs;
const write = (name, value) =>
	fs.writeFile(
		path.join(dir, name),
		typeof value === "string" ? value : JSON.stringify(value, null, 2),
	);
beforeEach(async () => {
	dir = await fs.mkdtemp(path.join(os.tmpdir(), "build-themes-spec-"));
	logs = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(async () => {
	vi.restoreAllMocks();
	await fs.rm(dir, { recursive: true, force: true });
});

describe("theme build", () => {
	it("writes CSS by id for every token file and ignores unrelated files", async () => {
		await write("source.tokens.json", fixture());
		await write("another.tokens.json", fixture("another", VARIANTS));
		await write("ignored.json", "{");
		await buildThemes(dir);
		expect(await fs.readFile(path.join(dir, "classic.css"), "utf8")).toContain(
			"--surface-app: #ffffff;",
		);
		expect(await fs.readFile(path.join(dir, "another.css"), "utf8")).toContain(
			'data-theme="another"',
		);
		expect(await fs.readdir(dir)).not.toContain("ignored.css");
	});
	it("names the Classic missing-HC allowance and its expiry once per build", async () => {
		expect(HC_ALLOWANCE).toEqual({
			classic: { missing: ["light-hc", "dark-hc"], until: "story 12" },
		});
		await write("classic.tokens.json", fixture());
		await write("same-id.tokens.json", fixture());
		await buildThemes(dir);
		expect(
			logs.mock.calls.filter(([line]) => line.includes("story 12")),
		).toEqual([
			[
				"classic.tokens.json:1: warning: classic: missing light-hc, dark-hc allowed until story 12.",
			],
		]);
	});
	it("warns only about actually missing allowed groups", async () => {
		await write(
			"classic.tokens.json",
			fixture("classic", ["light", "dark", "light-hc"]),
		);
		await buildThemes(dir);
		expect(
			logs.mock.calls.filter(([line]) => line.includes("story 12")),
		).toEqual([
			[
				"classic.tokens.json:1: warning: classic: missing dark-hc allowed until story 12.",
			],
		]);
	});
	it("does not warn about an allowance when all Classic variants exist", async () => {
		await write("classic.tokens.json", fixture("classic", VARIANTS));
		await buildThemes(dir);
		expect(logs.mock.calls.some(([line]) => line.includes("story 12"))).toBe(
			false,
		);
	});
	it("does not extend the Classic allowance to another theme", async () => {
		await write("other.tokens.json", fixture("other"));
		await expect(buildThemes(dir)).rejects.toThrow("other.tokens.json");
		expect(await fs.readdir(dir)).not.toContain("other.css");
		expect(logs).toHaveBeenCalledWith(
			expect.stringContaining("other.tokens.json:1: error: gate: light-hc."),
		);
	});
	it("prints compiler reports with filename and source line", async () => {
		const input = fixture();
		input.light.unknown = { $type: "number", $value: 1 };
		const text = JSON.stringify(input, null, 2);
		const line = text.slice(0, text.indexOf('"unknown"')).split("\n").length;
		await write("warning.tokens.json", text);
		await buildThemes(dir);
		expect(logs).toHaveBeenCalledWith(
			expect.stringContaining(
				`warning.tokens.json:${line}: warning: unknown-token: light.unknown:`,
			),
		);
		expect(
			logs.mock.calls.every(([message]) =>
				/^warning.tokens.json:\d+: (warning|error):/.test(message),
			),
		).toBe(true);
	});
	it("reports malformed files while still building valid files", async () => {
		await write("broken.tokens.json", "{\n invalid\n}");
		await write("valid.tokens.json", fixture());
		await expect(buildThemes(dir)).rejects.toThrow("broken.tokens.json");
		expect(logs).toHaveBeenCalledWith(
			expect.stringContaining("broken.tokens.json:2: error: parse:"),
		);
		expect(await fs.readdir(dir)).not.toContain("broken.css");
		expect(await fs.readFile(path.join(dir, "classic.css"), "utf8")).toContain(
			"--surface-app:",
		);
	});
	it.each([
		undefined,
		"../escape",
		"Classic",
		"a--b",
		"a\n",
		{ toString: null },
	])("does not write CSS for invalid id %j", async (id) => {
		const input = fixture();
		input.$extensions["org.nylas.theme"].id = id;
		await write("unsafe.tokens.json", input);
		await expect(buildThemes(dir)).rejects.toThrow("unsafe.tokens.json");
		expect(await fs.readdir(dir)).toEqual(["unsafe.tokens.json"]);
	});
	it.each([
		"parse",
		"schema",
		"forbidden-value",
		"missing-role",
		"missing-variant",
		"label-pair",
		"alias-cycle",
		"too-large",
		"invalid-id",
	])("preserves existing CSS on %s and exits 1", async (failure) => {
		const input = fixture();
		if (failure === "schema") delete input.light["surface-app"].$type;
		if (failure === "forbidden-value")
			input.light["surface-app"].$value = "invalid";
		if (failure === "missing-role") delete input.light["surface-app"];
		if (failure === "missing-variant") delete input.dark;
		if (failure === "label-pair")
			input.light["text-strong"].$value = color("#ffffff");
		if (failure === "alias-cycle")
			input.light["surface-app"].$value = "{light.surface-app}";
		if (failure === "invalid-id")
			input.$extensions["org.nylas.theme"].id = "../escape";
		await write("classic.css", "previous valid output\n");
		await write(
			"classic.tokens.json",
			failure === "parse"
				? "{"
				: failure === "too-large"
					? "x".repeat(256 * 1024 + 1)
					: input,
		);
		await expect(
			execFileAsync(process.execPath, [script, dir], {
				maxBuffer: 1024 * 1024,
			}),
		).rejects.toMatchObject({
			code: 1,
			stderr: expect.stringContaining("classic.tokens.json:"),
		});
		expect(await fs.readFile(path.join(dir, "classic.css"), "utf8")).toBe(
			"previous valid output\n",
		);
	});
	it("exits zero for a complete Classic fixture with the allowance warning", async () => {
		await write("classic.tokens.json", fixture());
		const result = await execFileAsync(process.execPath, [script, dir]);
		expect(result.stderr).toContain(
			"classic: missing light-hc, dark-hc allowed until story 12",
		);
		expect(await fs.readdir(dir)).toContain("classic.css");
	});
});
