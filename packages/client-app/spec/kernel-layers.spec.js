import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { LAYERS, layerStatement } = require("../src/appearance/layers.js");

describe("window kernel layer declaration", () => {
	it("exports the fixed cascade order through native require", () => {
		expect(LAYERS).toEqual(["reset", "kernel", "theme", "font", "baseline", "style", "plugin"]);
		expect(layerStatement()).toBe("@layer reset, kernel, theme, font, baseline, style, plugin;");
	});

	it("declares the shared layer order in the first stylesheet of index.html", () => {
		const html = readFileSync(require.resolve("../static/index.html"), "utf8");
		const doc = new DOMParser().parseFromString(html, "text/html");
		const styles = doc.head.querySelectorAll('style, link[rel="stylesheet"]');
		expect(styles[0].id).toBe("nylas-kernel");
		expect(styles[0].textContent).toBe(layerStatement());
		expect(doc.querySelectorAll("#nylas-kernel")).toHaveLength(1);
		expect(styles[1].textContent).toContain(".application-loading-cover");
	});
});
