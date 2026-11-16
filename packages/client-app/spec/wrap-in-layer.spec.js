import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { wrapInLayer } = require("../src/appearance/wrap-in-layer.js");

describe("wrapInLayer", () => {
	it.each([undefined, null, false, ""])("preserves source for layer %s", (layer) => {
		const source = '/* untouched */\n@import "mail.css";\n.a { color: red; }';
		expect(wrapInLayer(source, layer)).toBe(source);
	});

	it("wraps ordinary rules and empty sheets", () => {
		expect(wrapInLayer(".a { color: red; }", "plugin")).toBe("@layer plugin {\n.a { color: red; }\n}");
		expect(wrapInLayer("", "baseline")).toBe("@layer baseline {\n\n}");
	});

	it("hoists charset and imports before the layer", () => {
		const source = '@charset "utf-8";\n@import url("font-awesome.min.css");\n.a { color: red; }';
		expect(wrapInLayer(source, "baseline")).toBe('@charset "utf-8";\n@import url("font-awesome.min.css") layer(baseline);\n@layer baseline {\n\n.a { color: red; }\n}');
	});

	it.each(['@import"x.css";', '@import url(x.css);', '@import/**/"x.css";'])("layers the import %s", (source) => {
		expect(wrapInLayer(source, "baseline")).toBe(`${source.slice(0, -1)} layer(baseline);\n@layer baseline {\n\n}`);
	});

	it("hoists multiple imports through comments and whitespace", () => {
		const source = '/* license */\n@charset "utf-8";\n/* fonts */\n@import "fonts.css" screen;\n\t@import url(colors.css) print;\n/* rules */\n.a {}';
		const output = wrapInLayer(source, "style");
		expect(output).toContain('/* license */\n@charset "utf-8";\n/* fonts */\n@import "fonts.css" layer(style) screen;\n\t@import url(colors.css) layer(style) print;');
		expect(output).toContain('@layer style {\n\n/* rules */\n.a {}');
	});

	it("inserts the layer before supports and media conditions", () => {
		expect(wrapInLayer("@import 'fonts.css' supports(display: grid) screen and (min-width: 600px);", "font")).toContain("@import 'fonts.css' layer(font) supports(display: grid) screen and (min-width: 600px);");
	});

	it.each(['layer(font)', 'layer (font)', 'layer'])('preserves an existing %s import', (layer) => {
		const source = `@import url("fonts.css") ${layer} screen;`;
		expect(wrapInLayer(source, "baseline")).toBe(`${source}\n@layer baseline {\n\n}`);
	});

	it("does not mistake punctuation inside strings, URLs, or comments for statement ends", () => {
		const source = '@import url("font;with)paren.css") /* ; */ screen;\n@import url(data:text/css;base64,YXt9);\n.a { content: ";"; }';
		const output = wrapInLayer(source, "font");
		expect(output).toContain('@import url("font;with)paren.css") layer(font) /* ; */ screen;');
		expect(output).toContain('@import url(data:text/css;base64,YXt9) layer(font);');
		expect(output).toContain('.a { content: ";"; }');
	});

	it("preserves escaped quotes and does not mistake layer text in a URL for a layer modifier", () => {
		const source = String.raw`@import "a\"layer(font).css";`;
		expect(wrapInLayer(source, "font")).toContain(String.raw`@import "a\"layer(font).css" layer(font);`);
	});

	it("stops hoisting at the first ordinary rule", () => {
		const source = '.a {}\n@import "late.css";';
		expect(wrapInLayer(source, "plugin")).toBe(`@layer plugin {\n${source}\n}`);
	});

	it("keeps an unterminated prelude intact", () => {
		const source = '@import "broken.css"';
		expect(wrapInLayer(source, "plugin")).toBe(`@layer plugin {\n${source}\n}`);
	});
});
