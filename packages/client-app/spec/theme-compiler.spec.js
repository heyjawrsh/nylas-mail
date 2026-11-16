// @vitest-environment node
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { compileTheme } = require("../src/appearance/theme-compiler/index.js");
const classic = readFileSync(
	new URL("../static/themes/classic.tokens.json", import.meta.url),
	"utf8",
);
const color = (components, extra = {}) => ({
	$type: "color",
	$value: { colorSpace: "srgb", components, ...extra },
});
const compile = (groups) =>
	compileTheme(
		JSON.stringify({
			$extensions: { "org.nylas.theme": { id: "test" } },
			...groups,
		}),
	);

describe("theme compiler", () => {
	it("compiles Classic into a scoped theme layer", () => {
		expect(compileTheme(classic)).toEqual({
			css: '@layer theme {\n\t[data-look][data-theme="classic"][data-variant="light"] {\n\t\tcolor-scheme: light;\n\t\t--surface-app: #f6f6f6;\n\t}\n}\n',
			report: [],
		});
	});

	it("is deterministic", () => {
		expect(compileTheme(classic)).toEqual(compileTheme(classic));
	});

	it("reports malformed JSON without throwing", () => {
		expect(compileTheme("{")).toEqual({
			css: "",
			report: [{ level: "error", path: "", message: expect.any(String) }],
		});
	});

	it.each(["{}", "null", '{"$extensions":{"org.nylas.theme":{"id":""}}}'])(
		"requires a theme id: %s",
		(text) => {
			expect(compileTheme(text)).toEqual({
				css: "",
				report: [
					{
						level: "error",
						path: "$extensions.org.nylas.theme.id",
						message: expect.any(String),
					},
				],
			});
		},
	);

	it.each([
		"#ffffff",
		null,
		[1, 1, 1],
		{ colorSpace: "srgb", components: [1, 2, 0] },
		{ colorSpace: "srgb", components: [1, 0] },
		{ colorSpace: "display-p3", components: [1, 0, 0] },
		{ colorSpace: "srgb", components: [1, 0, 0], alpha: 2 },
		{ colorSpace: "srgb", components: [1, 0, 0], hex: "red" },
	])("reports and skips a bad colour: %j", ($value) => {
		const { css, report } = compile({
			light: {
				surface: { app: { $type: "color", $value } },
				good: color([0, 0, 0]),
			},
		});
		expect(report).toEqual([
			{
				level: "error",
				path: "light.surface.app",
				message: expect.any(String),
			},
		]);
		expect(css).not.toContain("--surface-app:");
		expect(css).toContain("--good: #000000;");
	});

	it("rounds components without hex and preserves alpha", () => {
		const { css } = compile({
			light: {
				opaque: color([1, 0.5, 0]),
				translucent: color([0, 0, 0], { alpha: 0.5 }),
			},
		});
		expect(css).toContain("--opaque: #ff8000;");
		expect(css).toContain("--translucent: #00000080;");
	});

	it("prefers supplied hex and lowercases it", () => {
		expect(
			compile({ light: { accent: color([0, 0, 0], { hex: "#ABCDEF" }) } }).css,
		).toContain("--accent: #abcdef;");
	});

	it("emits variants in order with the appropriate colour scheme", () => {
		const { css } = compile({
			"dark-hc": {},
			"light-hc": {},
			dark: {},
			light: {},
		});
		expect(
			[
				...css.matchAll(
					/data-variant="([^"]+)"\] \{\n\t\tcolor-scheme: (\w+);/g,
				),
			].map((match) => match.slice(1)),
		).toEqual([
			["light", "light"],
			["dark", "dark"],
			["light-hc", "light"],
			["dark-hc", "dark"],
		]);
	});

	it("sorts flattened roles and inherits group types while skipping metadata", () => {
		const token = { $value: { colorSpace: "srgb", components: [1, 1, 1] } };
		const { css, report } = compile({
			light: {
				$type: "color",
				z: token,
				a: { z: token },
				"a-a": token,
				$extensions: { ignored: token },
			},
		});
		expect(css.match(/--[\w-]+:/g)).toEqual(["--a-a:", "--a-z:", "--z:"]);
		expect(report).toEqual([]);
	});

	it("warns and ignores non-colour tokens", () => {
		const { css, report } = compile({
			light: { size: { $type: "number", $value: 12 } },
		});
		expect(css).not.toContain("--size:");
		expect(report).toEqual([
			{ level: "warning", path: "light.size", message: expect.any(String) },
		]);
	});
});
