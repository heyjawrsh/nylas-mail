const { converter, formatHex, formatHex8, getMode, parse } = require("culori");

const SANS =
	'system-ui, -apple-system, "Segoe UI", "Noto Sans", "Noto Sans CJK SC", "Noto Sans Arabic", "Noto Sans Hebrew", sans-serif';
const MONO =
	'ui-monospace, "SF Mono", Menlo, Consolas, "Noto Sans Mono", monospace';
// biome-ignore lint/suspicious/noControlCharactersInRegex: Escape control characters inside CSS strings.
const CONTROL_CHARACTERS = /[\x00-\x1f\x7f]/g;
const WEIGHTS = {
	thin: 100,
	hairline: 100,
	"extra-light": 200,
	"ultra-light": 200,
	light: 300,
	normal: 400,
	regular: 400,
	book: 400,
	medium: 500,
	"semi-bold": 600,
	"demi-bold": 600,
	bold: 700,
	"extra-bold": 800,
	"ultra-bold": 800,
	black: 900,
	heavy: 900,
	"extra-black": 950,
	"ultra-black": 950,
};
const COLOR_MODES = {
	srgb: "rgb",
	"srgb-linear": "lrgb",
	hsl: "hsl",
	hwb: "hwb",
	lab: "lab",
	lch: "lch",
	oklab: "oklab",
	oklch: "oklch",
	"display-p3": "p3",
	"a98-rgb": "a98",
	"prophoto-rgb": "prophoto",
	rec2020: "rec2020",
	"xyz-d65": "xyz65",
	"xyz-d50": "xyz50",
};

function forbidden(value) {
	if (typeof value === "string")
		return /url\s*\(|@import|var\s*\(|[;{}]/i.test(value);
	if (typeof value === "number") return !Number.isFinite(value);
	return (
		value !== null &&
		typeof value === "object" &&
		(Object.hasOwn(value, "$ref") || Object.values(value).some(forbidden))
	);
}

function color(value) {
	const mode = COLOR_MODES[value?.colorSpace];
	if (
		!mode ||
		!Array.isArray(value.components) ||
		value.components.length !== 3
	)
		throw new Error("Expected colour components.");
	const channels = getMode(mode).channels.slice(0, 3);
	const parts = value.components.map((part) => (part === "none" ? 0 : part));
	if (!parts.every(Number.isFinite))
		throw new Error("Expected numeric colour components.");
	// DTCG HSL/HWB use percentages; culori uses fractions for these channels.
	if (mode === "hsl" || mode === "hwb") {
		parts[1] /= 100;
		parts[2] /= 100;
	}
	const source = value.hex
		? parse(value.hex)
		: {
				mode,
				...Object.fromEntries(
					channels.map((channel, i) => [channel, parts[i]]),
				),
			};
	const rgb = converter("rgb")({ ...source, alpha: value.alpha ?? 1 });
	if (!rgb || ![rgb.r, rgb.g, rgb.b, rgb.alpha].every(Number.isFinite))
		throw new Error("Invalid colour.");
	return rgb.alpha < 1 ? formatHex8(rgb) : formatHex(rgb);
}

function dimension(value, zero = false) {
	if (
		!value ||
		!Number.isFinite(value.value) ||
		!["px", "rem"].includes(value.unit)
	)
		throw new Error("Expected a px or rem dimension.");
	return zero && value.value === 0 ? "0" : `${value.value}${value.unit}`;
}

function family(value) {
	const list = Array.isArray(value) ? value : [value];
	if (
		!list.length ||
		!list.every((item) => typeof item === "string" && item.trim())
	)
		throw new Error("Expected font family names.");
	const names = list.map((item) =>
		["system-ui", "sans-serif", "monospace"].includes(item)
			? item
			: `"${item.replace(/[\\"]/g, "\\$&").replace(CONTROL_CHARACTERS, (ch) => `\\${ch.charCodeAt(0).toString(16)} `)}"`,
	);
	return `${names.join(", ")}, ${list.at(-1) === "monospace" ? MONO : SANS}`;
}

function shadow(value) {
	const list = Array.isArray(value) ? value : [value];
	if (!list.length) throw new Error("Expected at least one shadow.");
	const parts = list.map((item) => {
		const dimensions = [item.offsetX, item.offsetY, item.blur, item.spread];
		const lengths = dimensions.map((part) => dimension(part, true));
		if (item.blur.value < 0)
			throw new Error("Shadow blur must not be negative.");
		const paint = color(item.color);
		if (
			list.length === 1 &&
			dimensions.every((part) => part.value === 0) &&
			(item.color.alpha ?? 1) === 0
		)
			return "none";
		return `${item.inset ? "inset " : ""}${lengths.join(" ")} ${paint}`;
	});
	return parts.join(", ");
}

function serialize(type, value, role) {
	if (forbidden(value))
		throw new Error(
			"Value contains forbidden CSS syntax, an unresolved reference, or a non-finite number.",
		);
	switch (type) {
		case "color":
			return color(value);
		case "dimension": {
			const length = dimension(value);
			if (!role.startsWith("type-") || !role.endsWith("-size")) return length;
			const pixels = value.value * (value.unit === "rem" ? 16 : 1);
			if (!Number.isFinite(pixels)) throw new Error("Font size is too large.");
			return `calc(${pixels}px * var(--text-scale))`;
		}
		case "fontFamily":
			return family(value);
		case "fontWeight":
			return String(typeof value === "number" ? value : WEIGHTS[value]);
		case "number":
			return `${value}${role.endsWith("-letter-spacing") ? "em" : ""}`;
		case "shadow":
			return shadow(value);
		default:
			throw new Error(`Unsupported token type: ${type}.`);
	}
}

module.exports = { serialize };
