// @vitest-environment node
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { compileTheme } = require("../src/appearance/theme-compiler/index.js");
const {
	ROLES,
	COLOR_ROLES,
	TYPE_ROLES,
	VARIANTS,
	CONTRAST_PAIRS,
} = require("../src/appearance/theme-compiler/contract.js");
const color = (hex = "#ffffff", alpha = 1) => ({
	colorSpace: "srgb",
	components: [1, 1, 1],
	hex,
	alpha,
});
const dimension = (value = 0, unit = "px") => ({ value, unit });
const shadow = (extra = {}) => ({
	color: color("#000000", 0.15),
	offsetX: dimension(),
	offsetY: dimension(1),
	blur: dimension(4),
	spread: dimension(),
	...extra,
});
const token = ($type, $value) => ({ $type, $value });
const theme = (groups = {}, id = "test") => ({
	$schema: "https://www.designtokens.org/schemas/2025.10/format.json",
	$extensions: {
		"org.nylas.theme": {
			id,
			name: "Test",
			author: "Nylas",
			version: "1.0.0",
			license: "GPL-3.0",
		},
	},
	...groups,
});
const textOf = (value) => JSON.stringify(value, null, 2);
const compile = (groups, options) =>
	compileTheme(textOf(theme(groups)), options);
const errors = (result) =>
	result.report.filter((entry) => entry.level === "error");
const lineOf = (text, key) =>
	text.slice(0, text.indexOf(JSON.stringify(key))).split("\n").length;
function complete(variants = VARIANTS) {
	return theme(
		Object.fromEntries(
			variants.map((variant) => [
				variant,
				Object.fromEntries(
					Object.entries(ROLES).map(([role, type]) => [
						role,
						token(
							type,
							{
								color: color(role === "text-strong" ? "#000000" : "#ffffff"),
								shadow: shadow(),
								fontFamily: ["Example Sans"],
								dimension: dimension(14),
								fontWeight: 400,
								number: role.endsWith("-line-height") ? 1.5 : 0.01,
							}[type],
						),
					]),
				),
			]),
		),
	);
}
function single(role, type, value, options) {
	const input = textOf(theme({ light: { [role]: token(type, value) } }));
	return { ...compileTheme(input, options), input, line: lineOf(input, role) };
}

describe("source validation and reports", () => {
	it.each([
		['{\n "a":\n}', 3],
		["{\n // comment\n}", 2],
		['{\n "a": 1,\n}', 3],
		["", 1],
		['{\r\n"a":\r\n}', 3],
		['{\r"a":\r}', 3],
	])("rejects strict JSON failures at their source line", (input, line) => {
		const result = compileTheme(input);
		expect(result.css).toBe("");
		expect(result.report).toContainEqual(
			expect.objectContaining({
				code: "parse",
				level: "error",
				line,
				path: "",
			}),
		);
		expect(result.report.every((entry) => entry.code === "parse")).toBe(true);
		expect(result.report.filledRoles).toEqual([]);
	});

	it("rejects oversized text before parsing, including multi-byte characters", () => {
		const result = compileTheme("é".repeat(256 * 1024 + 1));
		expect([...result.report]).toEqual([
			{
				code: "too-large",
				level: "error",
				path: "",
				line: 1,
				message: expect.any(String),
			},
		]);
		expect(result.css).toBe("");
		expect(compileTheme(" ".repeat(256 * 1024)).report[0].code).toBe("parse");
	});

	it("maps every Ajv failure to an instance path and nearest token line", () => {
		const result = single("surface-app", "color", color("#ffffff80"));
		const entries = result.report.filter((entry) => entry.code === "schema");
		expect(entries.length).toBeGreaterThan(0);
		for (const entry of entries) {
			expect(entry.line).toBe(
				entry.path.startsWith("light.surface-app")
					? result.line
					: lineOf(result.input, "light"),
			);
			expect(entry).toMatchObject({
				level: "error",
				path: expect.any(String),
				message: expect.any(String),
			});
		}
		expect(result.report).toContainEqual(
			expect.objectContaining({ code: "forbidden-value", line: result.line }),
		);
		expect(result.css).not.toContain("--surface-app:");
	});

	it("validates schema formats and inherited typed values", () => {
		const input = theme({
			light: { $type: "color", "surface-app": { $value: "#ffffff" } },
		});
		input.$schema = "not a uri with spaces";
		const result = compileTheme(textOf(input));
		expect(result.report).toContainEqual(
			expect.objectContaining({ code: "schema", line: 2, path: "$schema" }),
		);
		expect(result.report).toContainEqual(
			expect.objectContaining({
				code: "forbidden-value",
				line: lineOf(textOf(input), "surface-app"),
			}),
		);
	});

	it.each([
		"../escape",
		'x"] {}',
		"Classic",
		"a_b",
		"a--b",
		"-a",
		"a-",
		"a\n",
		"",
		12,
		null,
	])("rejects unsafe ids %j", (id) => {
		const input = textOf(theme({}, id));
		const result = compileTheme(input);
		expect(result.css).toBe("");
		expect(result.report).toContainEqual(
			expect.objectContaining({
				code: "invalid-id",
				level: "error",
				line: lineOf(input, "id"),
			}),
		);
	});
	it.each(["{}", "null", "[]"])("rejects missing ids in %s", (input) => {
		expect(compileTheme(input).report).toContainEqual(
			expect.objectContaining({ code: "invalid-id", line: 1 }),
		);
	});

	it.each(["Upper", "x; color: red", "a_b", "a--b", "-a", "a-", "", "a\n"])(
		"validates role names: %j",
		(role) => {
			const result = single(role, "color", color());
			expect(result.report).toContainEqual(
				expect.objectContaining({
					code: "schema",
					line: result.line,
					message: "Invalid role name.",
				}),
			);
			expect(result.css).not.toContain(`--${role}:`);
		},
	);

	it("reports flattening collisions at the second token's line", () => {
		const input = textOf(
			theme({
				light: {
					surface: { app: token("color", color("#000000")) },
					"surface-app": token("color", color()),
				},
			}),
		);
		const result = compileTheme(input);
		expect(result.report).toContainEqual(
			expect.objectContaining({
				code: "schema",
				line: lineOf(input, "surface-app"),
				message: "Duplicate role: surface-app.",
			}),
		);
		expect(result.css.match(/--surface-app:/g)).toHaveLength(1);
		expect(result.css).toContain("--surface-app: #000000;");
	});
	it("rejects duplicate JSON keys instead of silently overwriting", () => {
		const input =
			'{\n"$extensions":{"org.nylas.theme":{"id":"test"}},\n"light":{},\n"light":{}\n}';
		expect(compileTheme(input).report).toContainEqual(
			expect.objectContaining({
				code: "schema",
				line: 4,
				message: "Duplicate key: light.",
			}),
		);
	});
	it("warns and ignores unknown tokens", () => {
		const result = single("custom", "number", 5);
		expect([...result.report]).toEqual([
			{
				code: "unknown-token",
				level: "warning",
				line: result.line,
				path: "light.custom",
				message: expect.any(String),
			},
		]);
		expect(result.css).not.toContain("--custom:");
	});
	it.each([undefined, "number", { toString: null }])(
		"requires the contract type, received %s",
		(type) => {
			const result = single("surface-app", type, color());
			expect(result.report).toContainEqual(
				expect.objectContaining({
					code: "schema",
					line: result.line,
					message: expect.stringContaining("requires type color"),
				}),
			);
			expect(result.css).not.toContain("--surface-app:");
		},
	);
});

describe("typed serialization", () => {
	it("contains exactly the 48 colour, 3 shadow, and 95 type tokens", () => {
		expect(COLOR_ROLES).toHaveLength(48);
		expect(TYPE_ROLES).toEqual([
			"wordmark",
			"heading-reading",
			"heading-view",
			"heading-rail",
			"heading-section",
			"title-row",
			"title-row-read",
			"title-row-unread",
			"body-reading",
			"label-nav",
			"label-control",
			"input",
			"input-search-overlay",
			"body-sm",
			"name-sm",
			"meta",
			"badge",
			"label-search-section",
			"caption",
		]);
		expect(Object.keys(ROLES)).toHaveLength(146);
		expect(ROLES["shadow-card"]).toBe("shadow");
		expect(ROLES["shadow-soft"]).toBe("shadow");
		expect(ROLES["shadow-accent"]).toBe("shadow");
		for (const role of TYPE_ROLES)
			expect(
				["family", "size", "weight", "line-height", "letter-spacing"].map(
					(prop) => ROLES[`type-${role}-${prop}`],
				),
			).toEqual(["fontFamily", "dimension", "fontWeight", "number", "number"]);
	});
	it.each([
		[color("#ABCDEF"), "#abcdef"],
		[color("#1e283c", 0.35), "#1e283c59"],
		[color("#04070c", 0.7), "#04070cb3"],
		[color("#ABCDEF", 0), "#abcdef00"],
		[{ colorSpace: "srgb", components: [1, 0.5, 0] }, "#ff8000"],
		[{ colorSpace: "srgb", components: [0, 0, 0], alpha: 0.5 }, "#00000080"],
		[{ colorSpace: "srgb", components: ["none", 0, 0] }, "#000000"],
		[{ colorSpace: "hsl", components: [0, 100, 50] }, "#ff0000"],
		[{ colorSpace: "hwb", components: [120, 0, 0] }, "#00ff00"],
		[{ colorSpace: "display-p3", components: [1, 0, 0] }, "#ff0000"],
		[{ colorSpace: "oklch", components: [0, 0, 0] }, "#000000"],
	])("normalizes colour %j", (value, expected) => {
		const result = single("surface-app", "color", value);
		expect(errors(result)).toEqual([]);
		expect(result.css).toContain(`--surface-app: ${expected};`);
	});
	it.each([
		"srgb-linear",
		"lab",
		"lch",
		"oklab",
		"a98-rgb",
		"prophoto-rgb",
		"rec2020",
		"xyz-d65",
		"xyz-d50",
	])("supports DTCG colour space %s", (colorSpace) => {
		const result = single("surface-app", "color", {
			colorSpace,
			components: [0, 0, 0],
		});
		expect(errors(result)).toEqual([]);
		expect(result.css).toContain("--surface-app: #000000;");
	});
	it.each([
		"#ffffff",
		null,
		[1, 1, 1],
		{ colorSpace: "srgb", components: [1, 2, 0] },
		{ colorSpace: "srgb", components: [0, 0] },
		color("#ffffff", 2),
		color("#ffffff80"),
		color("red"),
	])("rejects invalid colours %j", (value) => {
		const result = single("surface-app", "color", value);
		expect(result.report).toContainEqual(
			expect.objectContaining({ code: "forbidden-value", line: result.line }),
		);
		expect(result.css).not.toContain("--surface-app:");
	});
	it("inherits token types through groups and root", () => {
		const result = compile({
			$type: "color",
			light: {
				surface: { app: { $value: color("#123456") } },
				type: { meta: { $type: "number", "line-height": { $value: 1.4 } } },
			},
		});
		expect(errors(result)).toEqual([]);
		expect(result.css).toContain("--surface-app: #123456;");
		expect(result.css).toContain("--type-meta-line-height: 1.4;");
	});
	it.each([
		[14, "px", 14],
		[1.25, "rem", 20],
		[0, "rem", 0],
	])("scales type size %s%s", (value, unit, px) => {
		const result = single(
			"type-body-reading-size",
			"dimension",
			dimension(value, unit),
		);
		expect(errors(result)).toEqual([]);
		expect(result.css).toContain(
			`--type-body-reading-size: calc(${px}px * var(--text-scale));`,
		);
	});
	it.each([
		dimension(1, "em"),
		dimension(1, "vh"),
		"12px",
		{ value: "12", unit: "px" },
		dimension(1e308, "rem"),
	])("rejects invalid size %j", (value) => {
		const result = single("type-meta-size", "dimension", value);
		expect(result.report).toContainEqual(
			expect.objectContaining({ code: "forbidden-value", line: result.line }),
		);
		expect(result.css).not.toContain("--type-meta-size:");
	});
	it("escapes font names and appends the exact sans fallback stack", () => {
		const result = single("type-meta-family", "fontFamily", [
			'A "Quote" \\ Font',
			"system-ui",
			"sans-serif",
		]);
		expect(errors(result)).toEqual([]);
		expect(result.css).toContain(
			'--type-meta-family: "A \\"Quote\\" \\\\ Font", system-ui, sans-serif, system-ui, -apple-system, "Segoe UI", "Noto Sans", "Noto Sans CJK SC", "Noto Sans Arabic", "Noto Sans Hebrew", sans-serif;',
		);
	});
	it("accepts a single family and escapes control characters", () => {
		const result = single("type-meta-family", "fontFamily", "Font\nName");
		expect(errors(result)).toEqual([]);
		expect(result.css).toContain('"Font\\a Name", system-ui');
	});
	it("uses mono fallbacks only when monospace is the last family", () => {
		expect(
			single("type-meta-family", "fontFamily", ["Example Mono", "monospace"])
				.css,
		).toContain(
			'"Example Mono", monospace, ui-monospace, "SF Mono", Menlo, Consolas, "Noto Sans Mono", monospace;',
		);
		expect(
			single("type-meta-family", "fontFamily", ["monospace", "Example"]).css,
		).toContain('monospace, "Example", system-ui');
	});
	it.each([[], "", [""]])("rejects empty font lists or names %j", (value) => {
		expect(
			single("type-meta-family", "fontFamily", value).report,
		).toContainEqual(expect.objectContaining({ code: "forbidden-value" }));
	});
	it.each([
		"url(x)",
		"URL (x)",
		"@import x",
		"var(--x)",
		"a;b",
		"a{b",
		"a}b",
		"{light.bad}suffix",
	])("rejects CSS syntax %s", (value) => {
		const result = single("type-meta-family", "fontFamily", ["Safe", value]);
		expect(result.report).toContainEqual(
			expect.objectContaining({ code: "forbidden-value", line: result.line }),
		);
		expect(result.css).not.toContain("--type-meta-family:");
	});
	it.each([
		["thin", 100],
		["hairline", 100],
		["extra-light", 200],
		["ultra-light", 200],
		["light", 300],
		["normal", 400],
		["regular", 400],
		["book", 400],
		["medium", 500],
		["semi-bold", 600],
		["demi-bold", 600],
		["bold", 700],
		["extra-bold", 800],
		["ultra-bold", 800],
		["black", 900],
		["heavy", 900],
		["extra-black", 950],
		["ultra-black", 950],
		[650, 650],
		[1, 1],
		[1000, 1000],
	])("serializes weight %s", (value, expected) => {
		const result = single("type-title-row-weight", "fontWeight", value);
		expect(errors(result)).toEqual([]);
		expect(result.css).toContain(`--type-title-row-weight: ${expected};`);
	});
	it.each([0, 1001, "bolder", "400"])("rejects weight %j", (value) => {
		expect(
			single("type-meta-weight", "fontWeight", value).report,
		).toContainEqual(expect.objectContaining({ code: "forbidden-value" }));
	});
	it("serializes line height as unitless and tracking as em", () => {
		expect(single("type-meta-line-height", "number", 1.5).css).toContain(
			"--type-meta-line-height: 1.5;",
		);
		expect(single("type-meta-letter-spacing", "number", -0.02).css).toContain(
			"--type-meta-letter-spacing: -0.02em;",
		);
		expect(
			single("type-meta-line-height", "number", "1.5").report,
		).toContainEqual(expect.objectContaining({ code: "forbidden-value" }));
	});
	it("rejects non-finite numbers from JSON exponents", () => {
		const input = textOf(
			theme({
				light: { "type-meta-line-height": token("number", "PLACEHOLDER") },
			}),
		).replace('"PLACEHOLDER"', "1e400");
		expect(compileTheme(input).report).toContainEqual(
			expect.objectContaining({
				code: "forbidden-value",
				line: lineOf(input, "type-meta-line-height"),
			}),
		);
	});
	it("serializes single, inset and multiple shadows with unitless zeros", () => {
		expect(single("shadow-card", "shadow", shadow()).css).toContain(
			"--shadow-card: 0 1px 4px 0 #00000026;",
		);
		const value = [
			shadow({
				inset: true,
				offsetX: dimension(-1),
				blur: dimension(0.25, "rem"),
				spread: dimension(0, "rem"),
			}),
			shadow(),
		];
		const result = single("shadow-soft", "shadow", value);
		expect(errors(result)).toEqual([]);
		expect(result.css).toContain(
			"--shadow-soft: inset -1px 1px 0.25rem 0 #00000026, 0 1px 4px 0 #00000026;",
		);
	});
	it("serializes only a single transparent zero shadow as none", () => {
		const none = shadow({
			color: color("#000000", 0),
			offsetY: dimension(),
			blur: dimension(),
		});
		for (const value of [none, [none]])
			expect(single("shadow-accent", "shadow", value).css).toContain(
				"--shadow-accent: none;",
			);
		expect(single("shadow-accent", "shadow", [none, none]).css).toContain(
			"--shadow-accent: 0 0 0 0 #00000000, 0 0 0 0 #00000000;",
		);
		expect(
			single("shadow-accent", "shadow", {
				...none,
				color: color("#000000", 0.001),
			}).css,
		).not.toContain("none;");
	});
	it.each([
		[],
		"none",
		shadow({ blur: dimension(-1) }),
		shadow({ offsetX: "1px" }),
		shadow({ color: "var(--bad)" }),
		shadow({ inset: { $ref: "#/light/inset" } }),
		shadow({ offsetX: { $ref: "#/light/offset" } }),
	])("rejects invalid shadow %j", (value) => {
		const result = single("shadow-card", "shadow", value);
		expect(result.report).toContainEqual(
			expect.objectContaining({ code: "forbidden-value", line: result.line }),
		);
		expect(result.css).not.toContain("--shadow-card:");
	});
});

describe("aliases, fills, gates and determinism", () => {
	it("detects cycles among unknown tokens without emitting them", () => {
		const input = textOf(theme({ light: {
			aa: token("color", "{light.bb}"),
			bb: token("color", "{light.aa}"),
		} }));
		const result = compileTheme(input);
		for (const role of ["aa", "bb"]) {
			expect(result.report).toContainEqual(expect.objectContaining({
				code: "alias-cycle", level: "error", path: `light.${role}`,
				line: lineOf(input, role),
			}));
			expect(result.report).toContainEqual(expect.objectContaining({
				code: "unknown-token", level: "warning", path: `light.${role}`,
			}));
			expect(result.css).not.toContain(`--${role}:`);
		}
	});
	it("keeps fill diagnostics in JSON-serialized reports", () => {
		const input = textOf(theme({ light: {} }));
		const result = compileTheme(input, { classicTokens: complete(["light"]) });
		const entries = JSON.parse(JSON.stringify(result.report));
		expect(result.report.filledRoles).toHaveLength(146);
		expect(entries.filter((entry) => entry.code === "filled-role")).toHaveLength(146);
		expect(entries).toContainEqual({
			code: "filled-role", level: "info", path: "light.text-faint",
			line: lineOf(input, "light"), message: "Filled light.text-faint from Classic.",
		});
		expect(result.css).toContain("--text-faint: #ffffff;");
	});
	it("resolves root-relative alias chains across variants", () => {
		const result = compile({
			light: {
				"surface-app": token("color", "{dark.surface.panel}"),
				"surface-panel": token("color", color("#123456")),
			},
			dark: { surface: { panel: token("color", "{light.surface-panel}") } },
		});
		expect(errors(result)).toEqual([]);
		expect(result.css).toContain("--surface-app: #123456;");
	});
	it.each(["self", "chain"])(
		"reports %s alias cycles with source lines",
		(kind) => {
			const input = textOf(
				theme({
					light: {
						"surface-app": token(
							"color",
							kind === "self" ? "{light.surface-app}" : "{light.surface-panel}",
						),
						"surface-panel": token("color", "{light.surface-app}"),
					},
				}),
			);
			const result = compileTheme(input);
			expect(result.report).toContainEqual(
				expect.objectContaining({
					code: "alias-cycle",
					line: lineOf(input, "surface-app"),
					path: "light.surface-app",
				}),
			);
			expect(result.css).not.toContain("--surface-");
		},
	);
	it.each(["{light.missing}", "{light}", "{constructor}"])(
		"rejects unresolved aliases %s",
		(value) => {
			const result = single("surface-app", "color", value);
			expect(result.report).toContainEqual(
				expect.objectContaining({ code: "forbidden-value", line: result.line }),
			);
		},
	);
	it("rejects unsupported JSON pointer values rather than emitting objects", () => {
		for (const [role, type] of Object.entries(ROLES)) {
			const result = single(role, type, { $ref: "#/light/other/$value" });
			expect(result.report).toContainEqual(
				expect.objectContaining({ code: "forbidden-value", line: result.line }),
			);
			expect(result.css).not.toContain(`--${role}:`);
		}
	});
	it("type-checks alias targets and rejects unsafe resolved values", () => {
		const result = compile({
			light: {
				"surface-app": token("color", "{light.type-meta-family}"),
				"type-meta-family": token("fontFamily", "url(evil)"),
			},
		});
		expect(
			result.report.filter((entry) => entry.code === "forbidden-value"),
		).toHaveLength(2);
		expect(result.css).not.toContain("url(");
	});
	it("fills absent roles by variant, preserves authored values, and does not mutate inputs", () => {
		const classicTokens = complete();
		classicTokens.dark["surface-app"].$value = color("#121212");
		classicTokens.light["surface-app"].$value = "{light.surface-panel}";
		const before = textOf(classicTokens);
		const result = compile(
			{
				light: { "accent-default": token("color", color("#abcdef")) },
				dark: {},
			},
			{ classicTokens },
		);
		expect(errors(result)).toEqual([]);
		expect(result.css).toContain("--accent-default: #abcdef;");
		expect(result.css).toContain("--surface-app: #121212;");
		expect(result.report.filledRoles).toHaveLength(291);
		expect(result.report.filledRoles).toContain("light.surface-app");
		expect(result.report.filledRoles).not.toContain("light.accent-default");
		expect(result.css).not.toContain('data-variant="light-hc"');
		expect(textOf(classicTokens)).toBe(before);
	});
	it("fills missing standard modes and present HC roles from their matching Classic group", () => {
		const result = compile({ "light-hc": {} }, { classicTokens: complete() });
		expect(result.report.filledRoles).toHaveLength(438);
		expect(result.css).toContain('data-variant="dark"');
		expect(result.css).not.toContain('data-variant="dark-hc"');
		expect(errors(result)).toEqual([]);
	});
	it("never hides invalid authored tokens by filling them", () => {
		const result = single("surface-app", "color", "invalid", {
			classicTokens: complete(),
		});
		expect(result.report.filledRoles).not.toContain("light.surface-app");
		expect(
			result.report.some((entry) => entry.code === "forbidden-value"),
		).toBe(true);
	});
	it("accepts every complete built-in variant without fills", () => {
		const result = compileTheme(textOf(complete()), { builtIn: true });
		expect(errors(result)).toEqual([]);
		expect(result.report.filledRoles).toEqual([]);
		expect(result.css.match(/\t\t--/g)).toHaveLength(584);
	});
	it("gates every missing role in every variant without Classic filling", () => {
		const result = compile(
			{ light: {}, dark: {}, "light-hc": {}, "dark-hc": {} },
			{ builtIn: true, classicTokens: complete() },
		);
		expect(errors(result)).toHaveLength(584);
		for (const variant of VARIANTS)
			for (const role of Object.keys(ROLES))
				expect(result.report).toContainEqual(
					expect.objectContaining({
						code: "gate",
						level: "error",
						path: `${variant}.${role}`,
						message: `Missing ${variant}.${role}.`,
						line: expect.any(Number),
					}),
				);
		expect(result.report.filledRoles).toEqual([]);
	});
	it("gates absent groups with variant and role names", () => {
		const result = compileTheme(textOf(complete(["light", "dark"])), {
			builtIn: true,
		});
		expect(errors(result)).toHaveLength(292);
		expect(result.report).toContainEqual(
			expect.objectContaining({
				code: "gate",
				line: 1,
				path: "light-hc.surface-panel",
				message: expect.stringContaining("light-hc.surface-panel"),
			}),
		);
	});
	it("allows only explicitly listed missing variants or roles", () => {
		const result = compileTheme(textOf(complete(["light", "dark"])), {
			builtIn: true,
			allowMissingVariants: ["light-hc", "dark-hc"],
		});
		expect(errors(result)).toEqual([]);
		const partial = complete(["light", "dark"]);
		partial["light-hc"] = {};
		delete partial.light["surface-app"];
		const partialResult = compileTheme(textOf(partial), {
			builtIn: true,
			allowMissingVariants: ["light-hc", "dark-hc"],
		});
		expect(errors(partialResult)).toHaveLength(1);
		expect(errors(partialResult)[0].path).toBe("light.surface-app");
	});
	it.each(VARIANTS)(
		"gates the label pair in %s, even with a missing-role allowance",
		(variant) => {
			const input = complete();
			input[variant]["text-strong"].$value = color();
			const result = compileTheme(textOf(input), {
				builtIn: true,
				allowMissingVariants: [variant],
			});
			expect(errors(result)).toEqual([
				expect.objectContaining({
					code: "gate",
					path: `${variant}.text-strong`,
					line: expect.any(Number),
					message: `${variant}: text-strong on surface-panel is 1.00:1; requires 4.5:1.`,
				}),
			]);
			if (variant === "light")
				expect(errors(result)[0].line).toBe(
					lineOf(textOf(input), "text-strong"),
				);
		},
	);
	it.each(
		CONTRAST_PAIRS.filter(
			([fg, bg]) => !(fg === "text-strong" && bg === "surface-panel"),
		),
	)(
		"reports %s on %s below %s as a warning, including HC",
		(fg, bg, min, scope) => {
			const group = {
				[fg]: token("color", color()),
				[bg]: token("color", color()),
			};
			const result = compile(
				{ "light-hc": group },
				{ builtIn: true, allowMissingVariants: VARIANTS },
			);
			expect(errors(result)).toEqual([]);
			expect(result.report).toContainEqual(
				expect.objectContaining({
					code: "contrast",
					level: "warning",
					path: `light-hc.${fg}`,
					message: `light-hc: ${fg} on ${bg} is 1.00:1; requires ${min}:1.`,
				}),
			);
			expect(result.css).toContain(`--${fg}: #ffffff;`);
			if (!scope)
				expect(compile({ light: group }).report).toContainEqual(
					expect.objectContaining({ code: "contrast", level: "warning" }),
				);
		},
	);
	it("checks contrast using emitted rounded hex and exact thresholds", () => {
		const value = { colorSpace: "srgb", components: [0.4667, 0.4667, 0.4667] };
		const result = compile(
			{
				light: {
					"text-strong": token("color", value),
					"surface-panel": token("color", color()),
				},
			},
			{ builtIn: true, allowMissingVariants: VARIANTS },
		);
		expect(result.css).toContain("--text-strong: #777777;");
		expect(result.report).toContainEqual(
			expect.objectContaining({
				code: "gate",
				message: expect.stringContaining("4.48:1"),
			}),
		);
		expect(
			errors(
				compile(
					{
						light: {
							"text-strong": token("color", color("#767676")),
							"surface-panel": token("color", color()),
						},
					},
					{ builtIn: true, allowMissingVariants: VARIANTS },
				),
			),
		).toEqual([]);
	});
	it("keeps scrollbar contrast HC-only and never gates third-party label pairs", () => {
		const result = compile({
			light: {
				"scrollbar-thumb": token("color", color()),
				"surface-sunken": token("color", color()),
				"surface-panel": token("color", color()),
				"text-strong": token("color", color()),
			},
		});
		expect(errors(result)).toEqual([]);
		expect(result.report.some((entry) => entry.code === "gate")).toBe(false);
		expect(
			result.report.some((entry) => entry.message.includes("scrollbar-thumb")),
		).toBe(false);
		expect(result.report).toContainEqual(
			expect.objectContaining({ code: "contrast", path: "light.text-strong" }),
		);
	});
	it("emits byte-identical CSS with sorted roles and fixed variant order", () => {
		const input = complete();
		const text = textOf(input);
		const first = compileTheme(text, { builtIn: true });
		expect(compileTheme(text, { builtIn: true })).toEqual(first);
		const shuffled = theme(
			Object.fromEntries(
				[...VARIANTS]
					.reverse()
					.map((v) => [
						v,
						Object.fromEntries(Object.entries(input[v]).reverse()),
					]),
			),
		);
		expect(compileTheme(textOf(shuffled), { builtIn: true }).css).toBe(
			first.css,
		);
		expect(
			[
				...first.css.matchAll(
					/data-variant="([^"]+)"\] \{\n\t\tcolor-scheme: (\w+);/g,
				),
			].map((match) => match.slice(1)),
		).toEqual([
			["light", "light"],
			["dark", "dark"],
			["light-hc", "light"],
			["dark-hc", "dark"],
		]);
		expect(
			first.css.startsWith('@layer theme {\n\t[data-look][data-theme="test"]'),
		).toBe(true);
		expect(first.css.match(/--[\w-]+:/g).slice(0, 146)).toEqual(
			Object.keys(ROLES)
				.sort()
				.map((role) => `--${role}:`),
		);
	});
});
