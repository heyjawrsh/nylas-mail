import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { LAYERS, layerStatement, kernelSheet } = require("../src/appearance/layers.js");

describe("window kernel layer declaration", () => {
	it("exports the fixed cascade order through native require", () => {
		expect(LAYERS).toEqual(["reset", "kernel", "theme", "font", "baseline", "style", "plugin"]);
		expect(layerStatement()).toBe("@layer reset, kernel, theme, font, baseline, style, plugin;");
	});

	it("defines the default text scale on look roots in the kernel layer", () => {
		expect(kernelSheet()).toBe(`${layerStatement()}\n@layer kernel { [data-look] { --text-scale: 1; } }`);
	});

	it("declares the shared kernel in the first stylesheet of index.html", () => {
		const html = readFileSync(require.resolve("../static/index.html"), "utf8");
		const doc = new DOMParser().parseFromString(html, "text/html");
		const styles = doc.head.querySelectorAll('style, link[rel="stylesheet"]');
		expect(styles[0].id).toBe("nylas-kernel");
		expect(styles[0].textContent).toBe(kernelSheet());
		expect(doc.querySelectorAll("#nylas-kernel")).toHaveLength(1);
		expect(styles[1].textContent).toContain(".application-loading-cover");
	});
});

describe("Classic type provenance", () => {
	it.each(["light", "dark"])("documents every %s type role at group level", (variant) => {
		const classic = JSON.parse(readFileSync(require.resolve("../static/themes/classic.tokens.json"), "utf8"));
		for (const role of Object.values(classic[variant].type)) {
			expect(role.$description).toBe(role.size.$description);
			expect(role.$description).toMatch(/\.less\s+\S+/);
		}
	});
});
