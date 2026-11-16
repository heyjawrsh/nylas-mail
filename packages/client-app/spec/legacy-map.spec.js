// @vitest-environment node
import { spawnSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
	buildLegacyMap,
	checkLegacyMap,
} from "../scripts/build-legacy-map.mjs";

const require = createRequire(import.meta.url);
const { ROLES } = require("../src/appearance/theme-compiler/contract.js");
const mapPath = new URL("../src/appearance/legacy-map.json", import.meta.url);
const committed = readFileSync(mapPath, "utf8");
const map = JSON.parse(committed);
const variables = readFileSync(
	new URL("../static/variables/ui-variables.less", import.meta.url),
	"utf8",
);
const heading = "### LESS variable → role mapping (legacy themes)";
const minimal = {
	design: `${heading}\n| \`@text-color\` | \`text-default\` |\n`,
	variables: "@text-color: #231f20;\n",
	source: "{}",
};

describe("legacy map", () => {
	it.each([
		[
			"@font-family-monospace",
			'Menlo, Monaco, Consolas, "Courier New", monospace',
		],
		["@font-family-serif", 'Georgia, "Times New Roman", Times, serif'],
		["@font-weight-thin", "200"],
		["@font-weight-blond", "300"],
		["@font-weight-normal", "400"],
		["@font-weight-medium", "500"],
		["@font-weight-semi-bold", "600"],
		["@headings-font-weight", "600"],
	])("keeps roleless %s as a documented literal", (name, css) => {
		expect(map[name]).toMatchObject({ kind: "literal", css });
		expect(map[name].note.trim().length).toBeGreaterThan(0);
	});

	it("matches the generator byte for byte and covers all 137 definitions", () => {
		const names = [...variables.matchAll(/^(@[\w-]+):/gm)]
			.map((match) => match[1])
			.sort();
		expect(names).toHaveLength(137);
		expect(Object.keys(map)).toEqual(names);
		expect(committed).toBe(`${JSON.stringify(buildLegacyMap(), null, "\t")}\n`);
	});

	it("checks from an unrelated cwd without writing", () => {
		const before = statSync(mapPath).mtimeMs;
		const result = spawnSync(
			process.execPath,
			[
				fileURLToPath(
					new URL("../scripts/build-legacy-map.mjs", import.meta.url),
				),
				"--check",
			],
			{ cwd: tmpdir(), encoding: "utf8" },
		);
		expect(result.stderr).toBe("");
		expect(result.status).toBe(0);
		expect(statSync(mapPath).mtimeMs).toBe(before);
		expect(readFileSync(mapPath, "utf8")).toBe(committed);
	});

	it("uses only contract roles and plain CSS, with notes for every literal", () => {
		for (const [name, entry] of Object.entries(map)) {
			expect(["colour", "dimension", "font", "literal"], name).toContain(
				entry.kind,
			);
			expect(entry.css, name).not.toMatch(
				/@[\w-]+|~["']|(?<![\w-])(?:darken|lighten|fade|fadeout|desaturate|saturate|mix|floor)\s*\(/,
			);
			for (const [, role] of entry.css.matchAll(/var\(\s*--([\w-]+)/g)) {
				expect(
					role === "text-scale" || Object.hasOwn(ROLES, role),
					`${name}: ${role}`,
				).toBe(true);
			}
			if (entry.kind === "literal")
				expect(entry.note?.trim().length, name).toBeGreaterThan(0);
		}
	});

	it.each([
		["@text-color", "var(--text-default)"],
		["@background-secondary", "var(--surface-app)"],
		["@background-primary", "var(--surface-panel)"],
		["@font-size-tiny", "var(--type-badge-size)"],
		["@font-size-small", "calc(13.02px * var(--text-scale))"],
		["@font-size-h3", "calc(20.02px * var(--text-scale))"],
		["@standard-shadow", "var(--shadow-card)"],
		["@btn-shadow", "var(--shadow-card)"],
		[
			"@border-color-tertiary",
			"hsl(from var(--control-border) h s calc(l - 10))",
		],
	])("maps %s to %s", (name, css) => expect(map[name].css).toBe(css));

	it("preserves the Classic emphasis colour as a documented literal", () => {
		expect(map["@btn-emphasis-bg-color"]).toMatchObject({
			kind: "literal",
			css: "#5b90fb",
			note: expect.any(String),
		});
	});
});

describe("generator validation", () => {
	it("takes only the base variable and skips expressions, theme sources, and multi-role rows", () => {
		const design = `${heading}
| \`@text-color\`; Darkside \`@accent\` | \`text-default\` |
| Taiga border \`@taiga-light\` | \`border-strong\` |
| \`lighten(@gray, 40%)\` | \`scrollbar-thumb\` |
| (none: \`@color-warning\`) | \`status-warning-on\` |
| \`@standard-shadow\` | \`shadow-soft\`, \`shadow-card\` |
| \`@font-family\` | typography \`fontFamily\` |
### Next section
| \`@extra\` | \`text-strong\` |`;
		expect(buildLegacyMap({ ...minimal, design })).toEqual({
			"@text-color": { kind: "colour", css: "var(--text-default)" },
		});
	});

	it("requires a documented supplement to resolve context-specific DESIGN duplicates", () => {
		const design = `${minimal.design}| \`@text-color\` on toolbar | \`text-on-toolbar\` |`;
		expect(() => buildLegacyMap({ ...minimal, design })).toThrow(
			/Doubled.*@text-color/,
		);
		const entry = {
			kind: "colour",
			css: "var(--text-default)",
			note: "General text default.",
		};
		expect(
			buildLegacyMap({
				...minimal,
				design,
				source: JSON.stringify({ "@text-color": entry }),
			}),
		).toEqual({ "@text-color": entry });
	});

	it.each([
		[{ variables: "@text-color: red;\n@missing: red;" }, /Missing.*@missing/],
		[{ variables: "" }, /Extra.*@text-color/],
		[
			{ variables: "@text-color: red;\n@text-color: blue;" },
			/Doubled.*@text-color/,
		],
		[{ source: '{"@text-color":{},"@text-color":{}}' }, /Doubled.*@text-color/],
		[
			{ source: '{"@text-color":{"css":"red","css":"blue"}}' },
			/Doubled.*@text-color/,
		],
		[
			{ source: '{"@text-color":{"kind":"literal","css":"red"}}' },
			/Missing note.*@text-color/,
		],
		[
			{
				source:
					'{"@text-color":{"kind":"literal","css":"@black","note":"test"}}',
			},
			/LESS syntax.*@text-color/,
		],
		[
			{ design: `${heading}\n| \`@text-color\` | \`not-a-role\` |` },
			/Unknown role.*@text-color/,
		],
	])("rejects invalid inputs with the variable name: %j", (changes, error) => {
		expect(() => buildLegacyMap({ ...minimal, ...changes })).toThrow(error);
	});

	it("reports every changed, missing, and extra variable and rejects formatting drift", () => {
		const changed = {
			...map,
			"@extra": map["@text-color"],
			"@text-color": { kind: "literal", css: "red", note: "changed" },
		};
		delete changed["@background-primary"];
		expect(checkLegacyMap(JSON.stringify(changed), map)).toEqual([
			"@background-primary",
			"@extra",
			"@text-color",
		]);
		expect(checkLegacyMap(committed, map)).toEqual([]);
		expect(checkLegacyMap(committed.trimEnd(), map)).toEqual(Object.keys(map));
		expect(() =>
			checkLegacyMap('{"@text-color":{},"@text-color":{}}', map),
		).toThrow(/Doubled.*@text-color/);
	});
});
