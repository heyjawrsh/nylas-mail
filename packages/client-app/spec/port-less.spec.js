import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { appRoot, compileFile, outputPath } from "../scripts/port-less.mjs";
import {
	colourFunction,
	fontUnit,
	logicalDeclaration,
	motionCompanion,
	placeholders,
	referenceImports,
	substitute,
	valueParts,
} from "../scripts/port-less/transforms.mjs";

const fixtures = path.join(
	path.dirname(fileURLToPath(import.meta.url)),
	"fixtures/port-less",
);
const cli = path.join(appRoot, "scripts/port-less.mjs");
const temporary = await mkdtemp(path.join(os.tmpdir(), "port-less-spec-"));
afterAll(() => rm(temporary, { recursive: true, force: true }));

function normalizeReport(report) {
	return Object.fromEntries(
		Object.entries(report).map(([key, entries]) => [
			key,
			entries.map((entry) => ({
				...entry,
				file: path.relative(appRoot, entry.file),
			})),
		]),
	);
}

describe("port-less CLI", () => {
	for (const name of ["static-excerpt", "package-excerpt"]) {
		it(`compiles ${name} with exact CSS and source report`, async () => {
			const input = path.join(fixtures, `${name}.less`);
			const reportFile = path.join(temporary, `${name}.json`);
			execFileSync(
				process.execPath,
				[cli, input, "--out-dir", temporary, "--report", reportFile],
				{ cwd: temporary },
			);
			expect(await readFile(outputPath(input, temporary), "utf8")).toBe(
				await readFile(path.join(fixtures, `${name}.css`), "utf8"),
			);
			const report = JSON.parse(await readFile(reportFile, "utf8"));
			expect(normalizeReport(report)).toEqual(
				JSON.parse(await readFile(path.join(fixtures, `${name}.json`), "utf8")),
			);
		});
	}

	it("tries remaining inputs after a LESS failure and names the failed source", async () => {
		const broken = path.join(temporary, "broken.less");
		const valid = path.join(temporary, "valid.less");
		await writeFile(broken, ".broken { color: @missing; }");
		await writeFile(valid, ".valid { color: @text-color; }");
		const result = spawnSync(
			process.execPath,
			[
				cli,
				broken,
				valid,
				"--out-dir",
				path.join(temporary, "batch"),
				"--report",
				path.join(temporary, "batch.json"),
			],
			{ encoding: "utf8", cwd: temporary },
		);
		expect(result.status).toBe(1);
		expect(result.stderr).toContain(`${broken}:`);
		expect(result.stderr).toContain("variable @missing is undefined");
		expect(
			await readFile(path.join(temporary, "batch/valid.css"), "utf8"),
		).toContain("color: var(--text-default)");
	});

	it("maps internal paths and outside basenames without escaping the output directory", () => {
		expect(
			outputPath(path.join(appRoot, "static/buttons.less"), "/tmp/out"),
		).toBe("/tmp/out/static/buttons.css");
		expect(outputPath("/tmp/other.less", "/tmp/out")).toBe(
			"/tmp/out/other.css",
		);
	});
});

async function compile(source, name = "inline") {
	const file = path.join(temporary, `${name}.less`);
	await writeFile(file, source);
	return compileFile(file);
}

describe("LESS integration", () => {
	it.each(["ui-dark", "ui-ubuntu"])(
		"preserves %s's ui-variables rules",
		async (theme) => {
			const { css } = await compileFile(
				path.join(
					appRoot,
					`internal_packages/${theme}/styles/ui-variables.less`,
				),
			);
			expect(css).toContain(".sheet-toolbar");
			if (theme === "ui-dark") expect(css).toContain(".mail-label");
			else expect(css).toContain(".sheet-toolbar-container");
		},
	);

	it("preserves same-named variable sheets and their local alias overrides", async () => {
		const directory = await mkdtemp(path.join(temporary, "variables-"));
		const filename = path.join(directory, "ui-variables.less");
		await writeFile(
			filename,
			"@text-color: #112233;\n.x { color: @btn-default-text-color; }",
		);
		const { css } = await compileFile(filename);
		expect(css).toContain(".x {\n  color: #112233;");
	});

	it("keeps shared classes out of ordinary sheets", async () => {
		const { css } = await compile(
			'@import "ui-mixins";\n@import "buttons";\n.x { color: @text-color; }',
		);
		expect(css).toBe(".x {\n  color: var(--text-default);\n}\n");
	});

	it.each([
		[
			"font-family-monospace",
			"font-family",
			'Menlo, Monaco, Consolas, "Courier New", monospace',
		],
		[
			"font-family-serif",
			"font-family",
			'Georgia, "Times New Roman", Times, serif',
		],
		["font-weight-thin", "font-weight", "200"],
		["font-weight-blond", "font-weight", "300"],
		["font-weight-normal", "font-weight", "400"],
		["font-weight-medium", "font-weight", "500"],
		["font-weight-semi-bold", "font-weight", "600"],
		["headings-font-weight", "font-weight", "600"],
	])("ports and reports literal @%s", async (variable, property, value) => {
		const { css, report } = await compile(
			`@import "ui-variables";\n.x { ${property}: @${variable}; }`,
		);
		expect(css).toContain(`${property}: ${value};`);
		expect(report.literals).toEqual([
			{
				file: path.join(temporary, "inline.less"),
				line: 2,
				variable: `@${variable}`,
			},
		]);
	});

	it.each([
		["translateX(-50%)", true],
		["translate(-50%, 0)", true],
		["translate3d(-50%, 0, 0)", true],
		["translateY(-50%)", false],
		["translate(0px, -50%)", false],
		["translate3d(0, 0, 0)", false],
	])(
		"uses horizontal transforms for centring: %s",
		async (transform, horizontal) => {
			const { css, report } = await compile(
				`.x {\nleft: 50%;\ntransform: ${transform};\nright: auto;\n}`,
			);
			expect(css).toContain(
				`${horizontal ? "left" : "inset-inline-start"}: 50%;`,
			);
			expect(css).toContain("inset-inline-end: auto;");
			expect(
				report.unconvertible.map(({ line, kind }) => [line, kind]),
			).toEqual(
				horizontal
					? [
							[2, "centring"],
							[3, "translate"],
						]
					: [],
			);
		},
	);

	it("reports asymmetric radii with source locations", async () => {
		const { css, report } = await compile(
			".x {\nborder-radius: 3px 0 0 3px;\nleft: 0;\nright: 2px;\n}",
		);
		expect(css).toContain("border-radius: 3px 0 0 3px;");
		expect(css).toContain("inset-inline-start: 0;");
		expect(css).toContain("inset-inline-end: 2px;");
		expect(report.unconvertible).toEqual([
			{
				file: path.join(temporary, "inline.less"),
				line: 2,
				kind: "asymmetric-radius",
				text: "border-radius: 3px 0 0 3px;",
			},
		]);
	});

	it("nests every colour function while literal maths uses LESS", async () => {
		const { css } = await compile(`@import "ui-variables";
.x { color: fade(saturate(desaturate(lighten(darken(@text-color, 10%), 5%), 20%), 3%), 70%);
background: fadeout(mix(#fff, @text-color, 25%), 10%); border-color: mix(@text-color, #000);
outline-color: darken(#ffffff, 20%); }`);
		expect(css).toContain(
			"color-mix(in srgb, hsl(from hsl(from hsl(from hsl(from var(--text-default) h s calc(l - 10)) h s calc(l + 5)) h calc(s - 20) l) h calc(s + 3) l) 70%, transparent)",
		);
		expect(css).toContain(
			"color-mix(in srgb, color-mix(in srgb, #fff 25%, var(--text-default)) 90%, transparent)",
		);
		expect(css).toContain("color-mix(in srgb, var(--text-default) 50%, #000)");
		expect(css).toContain("outline-color: #cccccc");
	});

	it("preserves local overrides through ui-mixins and lazy derived aliases", async () => {
		const { css, report } = await compile(
			'@import "ui-variables";\n@text-color: #112233;\n@import "ui-mixins";\n.x { color: @text-color; border-color: @btn-default-text-color; }',
		);
		expect(css).toContain("color: #112233");
		expect(css).toContain("border-color: #112233");
		expect(css).not.toContain("var(");
		expect(report.literals).toEqual([]);
	});

	it("keeps caller-scoped overrides separate and supports no-import partials", async () => {
		const { css } = await compile(
			".m() { color: @action-bar-bg; }\n.local { @action-bar-bg: #123456; .m(); }\n.mapped { @action-bar-bg: @text-color; .m(); }",
		);
		expect(css).toContain(".local {\n  color: #123456;");
		expect(css).toContain(".mapped {\n  color: var(--text-default);");
	});

	it("converts physical !important declarations and records their source line", async () => {
		const { css, report } = await compile(
			".x {\ntext-align: left !important;\nfloat: right !important;\nmargin: 1px 2px 3px 4px !important;\n}",
		);
		expect(css).toContain("text-align: start !important");
		expect(css).toContain("float: inline-end !important");
		expect(report.important.map((entry) => entry.line)).toEqual([2, 3, 4]);
		expect(report.unconvertible.map((entry) => entry.line)).toEqual([4]);
	});

	it("ignores commented imports and reports repeated literal uses", async () => {
		const { css, report } = await compile(
			'// @import "ui-variables";\n.x { border-color: @black @black; }',
		);
		expect(css).toContain("border-color: #231f20 #231f20;");
		expect(
			report.literals.map((entry) => [entry.line, entry.variable]),
		).toEqual([
			[2, "@black"],
			[2, "@black"],
		]);
	});

	it("scopes companions inside media rules and never writes layers or scopes keyframe steps", async () => {
		const { css } = await compile(
			"@media (min-width: 1px) { .x, .y { transition: all 1s; animation: pulse 1s; } }\n@keyframes pulse { from { animation-timing-function: ease; } to { opacity: 1; } }",
		);
		expect(css.match(/@scope/g)).toHaveLength(1);
		expect(css).toContain(":scope[data-reduced-motion] .x,");
		expect(css).toContain(":scope[data-reduced-motion] .y");
		expect(css.indexOf("@scope")).toBeLessThan(css.indexOf("@keyframes"));
		expect(css).not.toContain("@layer");
	});
});

describe("pure transforms", () => {
	const map = {
		"@text-color": { kind: "colour", css: "var(--text-default)" },
		"@black": { kind: "literal", css: "#231f20" },
		"@font-size-h1": { kind: "font", css: "var(--type-heading-view-size)" },
		"@font-size-small": {
			kind: "font",
			css: "calc(13.02px * var(--text-scale))",
		},
		"@spacing": { kind: "dimension", css: "14px" },
	};
	it("encodes digit-free font units and substitutes factors and floor markers", () => {
		expect(fontUnit("@font-size-h1")).toBe("fzfont_size_hb");
		expect(placeholders(map)).toContain("@spacing: 14px;");
		expect(placeholders(map)).toContain("@font-size-h1: 1fzfont_size_hb;");
		expect(
			substitute("var(--L-black) var(--L-text-color) -0.8fzfont_size_hb", map),
		).toEqual({
			css: "#231f20 var(--text-default) calc(var(--type-heading-view-size) * -0.8)",
			literals: ["@black"],
			fontSizeFloor: false,
		});
		expect(substitute("1fzfont_size_small", map).css).toBe(
			"calc(13.02px * var(--text-scale))",
		);
		expect(
			substitute("__port_floor_16_px__ __port_floor_93_percent__", map),
		).toEqual({
			css: "calc(16px * var(--text-scale)) 93%",
			literals: [],
			fontSizeFloor: true,
		});
		expect(() => substitute("var(--L-missing)", map)).toThrow(
			"Unknown legacy placeholder",
		);
	});

	it.each([
		["margin-left", "margin-inline-start"],
		["padding-right", "padding-inline-end"],
		["border-left", "border-inline-start"],
		["border-right-width", "border-inline-end-width"],
		["border-top-left-radius", "border-start-start-radius"],
		["border-top-right-radius", "border-start-end-radius"],
		["border-bottom-left-radius", "border-end-start-radius"],
		["border-bottom-right-radius", "border-end-end-radius"],
		["left", "inset-inline-start"],
		["right", "inset-inline-end"],
	])("converts %s to %s", (before, after) => {
		expect(logicalDeclaration(before, "2px").name).toBe(after);
	});

	it.each(["0", "auto", "50%", "calc(100% - 2px)", "var(--offset)"])(
		"converts inset value %s",
		(value) => {
			for (const [name, side] of [
				["left", "start"],
				["right", "end"],
			]) {
				expect(logicalDeclaration(name, value)).toEqual({
					name: `inset-inline-${side}`,
					value,
					unconvertible: [],
				});
			}
		},
	);

	it.each([
		["translateX(0)", true],
		["translateX(-2px)", true],
		["translate(2px, 0)", true],
		["translate(0, 2px)", false],
		["translate(0px, 2px)", false],
		["translate(0%, 2px)", false],
		["translate3d(0, 0, 0)", false],
		["translate3d(0%, 2px, 0)", false],
		["translate3d(2px, 0, 0)", true],
		["translateY(2px)", false],
		["translateZ(2px)", false],
		["translateY(2px) translate(3px, 0)", true],
		["translate(calc(100% - 2px), 0)", true],
	])("reports only horizontal transforms: %s", (value, horizontal) => {
		expect(logicalDeclaration("transform", value)).toEqual({
			name: "transform",
			value,
			unconvertible: horizontal ? ["translate"] : [],
		});
	});

	it.each([
		["3px", false],
		["3px 3px", false],
		["3px 0", true],
		["3px 3px 0", true],
		["3px 0 0 3px", true],
		["0 0 0 3px", true],
		["3px 3px 0 0", false],
		["3px 3px 0 0 / 1px 1px 2px 2px", false],
		["3px / 1px 0", true],
		["3px 0 0 3px !important", true],
	])("reports asymmetric border-radius: %s", (value, asymmetric) => {
		expect(logicalDeclaration("border-radius", value)).toEqual({
			name: "border-radius",
			value,
			unconvertible: asymmetric ? ["asymmetric-radius"] : [],
		});
	});

	it.each([
		["text-align", "left", "start"],
		["text-align", "right", "end"],
		["float", "left", "inline-start"],
		["clear", "right", "inline-end"],
	])("converts %s: %s", (name, value, expected) => {
		expect(logicalDeclaration(name, value).value).toBe(expected);
	});

	it("reports directional cases while preserving their values", () => {
		for (const [name, value, kind] of [
			["left", "50%", "centring"],
			["transform", "translateX(-50%)", "translate"],
			[
				"background",
				"linear-gradient(to right, red, blue)",
				"gradient-direction",
			],
			["background-position", "left top", "background-position"],
			["padding", "1px calc(2px + 3px) 4px 5px", "asymmetric-shorthand"],
		])
			expect(logicalDeclaration(name, value, true)).toEqual({
				name,
				value,
				unconvertible: [kind],
			});
		expect(logicalDeclaration("left", "50%").unconvertible).toEqual([]);
		expect(
			logicalDeclaration("margin", "1px 2px 3px 2px").unconvertible,
		).toEqual([]);
		expect(valueParts("1px calc(2px + 3px) 4px 5px")).toHaveLength(4);
	});

	it("rewrites only mixin imports, preserving comments, options, and source lines", () => {
		const source =
			'// @import "buttons";\n@import "ui-mixins";\n@import (less) "../buttons.less";\n@import "../mixins/windows";\n@import "type";\n.x { content: \'@import "buttons"\'; }';
		const result = referenceImports(source);
		expect(result).toContain('@import (reference) "ui-mixins"');
		expect(result).toContain('@import (reference, less) "../buttons.less"');
		expect(result).toContain('@import (reference) "../mixins/windows"');
		expect(result).toContain('// @import "buttons";');
		expect(result).toContain("content: '@import \"buttons\"'");
		expect(result.split("\n")).toHaveLength(source.split("\n").length);
	});

	it("emits the bounded scope form and colour function defaults", () => {
		expect(motionCompanion([".a", ".b"])).toContain(
			"@scope ([data-look]) to ([data-look])",
		);
		expect(motionCompanion([".a", ".b"])).toContain(
			":scope[data-reduced-motion] .b",
		);
		expect(colourFunction("mix", ["var(--x)", "#fff"])).toBe(
			"color-mix(in srgb, var(--x) 50%, #fff)",
		);
	});
});
