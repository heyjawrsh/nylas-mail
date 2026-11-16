import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import defaults from "../../src/appearance/look-runtime/defaults";
import resolver from "../../src/appearance/look-runtime/resolve-look";

const require = createRequire(import.meta.url);
const schema = require("../../src/config-schema");

const { DEFAULTS, DEFAULT_SIGNALS, DEFAULT_THEME, DEFAULT_STYLE, TEXT_SIZES } =
	defaults;
const { resolveLook } = resolver;
const library = {
	themes: {
		classic: { variants: ["light", "dark"], status: "ok" },
		hc: { variants: ["light", "dark", "light-hc", "dark-hc"], status: "ok" },
		partial: { variants: ["light", "dark", "light-hc"], status: "ok" },
		gone: { variants: ["light", "dark"], status: "unavailable" },
		cached: { variants: ["light", "dark"], status: "last-valid" },
	},
	styles: ["classic", "other"],
};
const resolve = (applied, overrides, signals) =>
	resolveLook(applied, overrides, { ...DEFAULT_SIGNALS, ...signals }, library);
const fresh = {
	"data-look": "",
	"data-theme": "classic",
	"data-variant": "light",
	"data-style": "classic",
	"data-density": "comfortable",
	"data-text-size": "100",
	"data-font": "theme",
};

function freeze(value) {
	for (const child of Object.values(value)) {
		if (child && typeof child === "object") freeze(child);
	}
	return Object.freeze(value);
}

describe("look defaults", () => {
	it("shares defaults with the schema without an enumerable default export", () => {
		expect(DEFAULTS).toEqual({
			style: "classic",
			theme: "classic",
			mode: "auto",
			increaseContrast: "system",
			density: "comfortable",
			textSize: 1,
			font: "theme",
		});
		expect(DEFAULT_THEME).toBe("classic");
		expect(DEFAULT_STYLE).toBe("classic");
		for (const [key, value] of Object.entries(DEFAULTS)) {
			expect(schema.core.properties.appearance.properties[key].default).toBe(
				value,
			);
		}
		expect(Object.keys(schema)).not.toContain("default");
		expect(schema.default).toBe(schema);
		expect(schema.core.properties.appearance.properties.textSize).toEqual({
			type: "number",
			default: 1,
			minimum: 0.875,
			maximum: 1.5,
		});
	});
	it("starts with a light, revision-zero OS snapshot", () => {
		expect(DEFAULT_SIGNALS).toEqual({
			revision: 0,
			platform:
				process.platform === "darwin"
					? "mac"
					: process.platform === "win32"
						? "windows"
						: "linux",
			colorScheme: "light",
			contrast: "no-preference",
			forcedColors: false,
			reducedMotion: false,
			reducedTransparency: false,
		});
	});
});

describe("resolveLook", () => {
	it("resolves absent and empty config to the full Classic look without flags", () => {
		expect(resolve()).toEqual(fresh);
		expect(resolve({}, {})).toEqual(fresh);
		expect(resolveLook()).toEqual(fresh);
	});
	it.each([
		["auto", "light", "light"],
		["auto", "dark", "dark"],
		["light", "dark", "light"],
		["dark", "light", "dark"],
	])("resolves mode %s with OS %s to %s", (mode, colorScheme, expected) => {
		expect(resolve({ mode }, {}, { colorScheme })["data-variant"]).toBe(
			expected,
		);
	});
	it("changes only the resolved variant for a mode change", () => {
		expect(resolve({ mode: "dark" })).toEqual({
			...fresh,
			"data-variant": "dark",
		});
	});
	it.each(["light", "dark"])(
		"keeps the %s variant and contrast flag without an HC group",
		(mode) => {
			expect(resolve({ mode, increaseContrast: "on" })).toEqual({
				...fresh,
				"data-variant": mode,
				"data-increased-contrast": "",
			});
			expect(
				resolve({ theme: "hc", mode, increaseContrast: "on" })["data-variant"],
			).toBe(`${mode}-hc`);
		},
	);
	it("requires the matching HC group", () => {
		expect(
			resolve({ theme: "partial", mode: "dark", increaseContrast: "on" })[
				"data-variant"
			],
		).toBe("dark");
	});
	it.each(["no-preference", "unknown", "more"])(
		"follows system contrast %s",
		(contrast) => {
			const attrs = resolve({ theme: "hc" }, {}, { contrast });
			expect(attrs["data-variant"]).toBe(
				contrast === "more" ? "light-hc" : "light",
			);
			expect(Object.hasOwn(attrs, "data-increased-contrast")).toBe(
				contrast === "more",
			);
		},
	);
	it("honours contrast off even when the OS requests more", () => {
		expect(
			resolve({ increaseContrast: "off" }, {}, { contrast: "more" }),
		).toEqual(fresh);
	});
	it.each(["light", "dark"])(
		"lets forced colours beat %s HC and its flag",
		(mode) => {
			expect(
				resolve(
					{ theme: "hc", mode, increaseContrast: "on" },
					{},
					{ forcedColors: true, contrast: "more" },
				),
			).toEqual({
				...fresh,
				"data-theme": "hc",
				"data-variant": mode,
				"data-forced-colors": "",
			});
		},
	);
	it.each(["missing", "gone", "toString", "__proto__"])(
		"falls back for theme %s",
		(theme) => {
			expect(resolve({ theme })).toEqual(fresh);
		},
	);
	it("uses available and last-valid themes and registered styles", () => {
		expect(
			resolve({
				theme: "cached",
				style: "other",
				font: "inter",
				density: "compact",
			}),
		).toEqual({
			...fresh,
			"data-theme": "cached",
			"data-style": "other",
			"data-font": "inter",
			"data-density": "compact",
		});
		expect(resolve({ style: "missing" })).toEqual(fresh);
		expect(resolve({ density: "spacious" })["data-density"]).toBe("spacious");
	});
	it.each([undefined, null, 7, true, {}, [], ""])(
		"defaults invalid values %j",
		(value) => {
			const applied = Object.fromEntries(
				Object.keys(DEFAULTS).map((key) => [key, value]),
			);
			expect(resolve(applied)).toEqual(fresh);
		},
	);
	it("defaults unknown enums and invalid numeric steps after merging overrides", () => {
		expect(
			resolve(
				{ mode: "dark", textSize: 1.5 },
				{
					mode: "invalid",
					textSize: 3,
					density: "huge",
					increaseContrast: "invalid",
				},
				{ colorScheme: "dark" },
			),
		).toEqual({ ...fresh, "data-variant": "dark" });
		for (const textSize of [0.5, 1.01, 3, NaN, Infinity, "1.125"]) {
			expect(resolve({ textSize })["data-text-size"]).toBe("100");
		}
	});
	it.each([
		[0.875, "87.5"],
		[1, "100"],
		[1.125, "112.5"],
		[1.25, "125"],
		[1.375, "137.5"],
		[1.5, "150"],
	])("formats text size %s as %s", (textSize, expected) => {
		expect(TEXT_SIZES).toContain(textSize);
		expect(resolve({ textSize })["data-text-size"]).toBe(expected);
	});
	it("merges overrides over applied values while retaining other settings", () => {
		expect(
			resolve(
				{ mode: "light", font: "inter", density: "compact", theme: "hc" },
				{ mode: "dark", density: "spacious" },
			),
		).toEqual({
			...fresh,
			"data-theme": "hc",
			"data-variant": "dark",
			"data-font": "inter",
			"data-density": "spacious",
		});
	});
	it.each([
		[true, false],
		[false, true],
		[true, true],
		[false, false],
	])(
		"mirrors motion=%s and transparency=%s as present-or-absent flags",
		(reducedMotion, reducedTransparency) => {
			const attrs = resolve({}, {}, { reducedMotion, reducedTransparency });
			expect(Object.hasOwn(attrs, "data-reduced-motion")).toBe(reducedMotion);
			expect(Object.hasOwn(attrs, "data-reduced-transparency")).toBe(
				reducedTransparency,
			);
			if (reducedMotion) expect(attrs["data-reduced-motion"]).toBe("");
			if (reducedTransparency)
				expect(attrs["data-reduced-transparency"]).toBe("");
		},
	);
	it("is deterministic and does not mutate any inputs", () => {
		const inputs = freeze([
			{ theme: "gone", mode: "light" },
			{ mode: "dark" },
			{ ...DEFAULT_SIGNALS, reducedMotion: true },
			library,
		]);
		const before = JSON.stringify(inputs);
		const first = resolveLook(...inputs);
		expect(resolveLook(...inputs)).toEqual(first);
		expect(JSON.stringify(inputs)).toBe(before);
		expect(Object.getPrototypeOf(first)).toBe(Object.prototype);
		expect(
			Object.values(first).every((value) => typeof value === "string"),
		).toBe(true);
		first["data-theme"] = "changed";
		expect(resolveLook(...inputs)["data-theme"]).toBe("classic");
	});
});
