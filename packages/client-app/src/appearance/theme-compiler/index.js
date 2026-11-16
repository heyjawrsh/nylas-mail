const VARIANTS = ["light", "dark", "light-hc", "dark-hc"];

function isObject(value) {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isComponent(value) {
	return (
		typeof value === "number" &&
		Number.isFinite(value) &&
		value >= 0 &&
		value <= 1
	);
}

function colorValue(value) {
	if (
		!isObject(value) ||
		value.colorSpace !== "srgb" ||
		!Array.isArray(value.components) ||
		value.components.length !== 3 ||
		!value.components.every(isComponent) ||
		(value.alpha !== undefined && !isComponent(value.alpha)) ||
		(value.hex !== undefined &&
			(typeof value.hex !== "string" ||
				!/^#[\da-f]{6}([\da-f]{2})?$/i.test(value.hex)))
	) {
		return null;
	}
	if (value.hex !== undefined) return value.hex.toLowerCase();
	const components = [...value.components];
	if (value.alpha !== undefined && value.alpha < 1)
		components.push(value.alpha);
	return `#${components
		.map((part) =>
			Math.round(part * 255)
				.toString(16)
				.padStart(2, "0"),
		)
		.join("")}`;
}

function compileTheme(text) {
	const report = [];
	let theme;
	try {
		theme = JSON.parse(text);
	} catch (error) {
		return {
			css: "",
			report: [{ level: "error", path: "", message: error.message }],
		};
	}
	const id = theme?.$extensions?.["org.nylas.theme"]?.id;
	if (typeof id !== "string" || !id.trim()) {
		return {
			css: "",
			report: [
				{
					level: "error",
					path: "$extensions.org.nylas.theme.id",
					message: "Theme id is required.",
				},
			],
		};
	}
	const selectorId = id.replace(
		// biome-ignore lint/suspicious/noControlCharactersInRegex: Escape control characters in CSS strings.
		/["\\\x00-\x1f\x7f]/g,
		(char) => `\\${char.charCodeAt(0).toString(16)} `,
	);
	const lines = ["@layer theme {"];
	for (const variant of VARIANTS) {
		if (!Object.hasOwn(theme, variant)) continue;
		const tokens = [];
		function walk(node, parts, inheritedType) {
			if (!isObject(node)) return;
			const type = node.$type ?? inheritedType;
			if (Object.hasOwn(node, "$value")) {
				const path = [variant, ...parts].join(".");
				if (type !== "color") {
					report.push({
						level: "warning",
						path,
						message: "Non-colour token ignored.",
					});
					return;
				}
				const value = colorValue(node.$value);
				if (value === null) {
					report.push({
						level: "error",
						path,
						message:
							"Expected a DTCG sRGB colour with three components in 0..1.",
					});
					return;
				}
				tokens.push([parts.join("-"), value]);
				return;
			}
			for (const key of Object.keys(node).sort()) {
				if (!key.startsWith("$")) walk(node[key], [...parts, key], type);
			}
		}
		walk(theme[variant], [], theme.$type);
		lines.push(
			`\t[data-look][data-theme="${selectorId}"][data-variant="${variant}"] {`,
		);
		lines.push(
			`\t\tcolor-scheme: ${variant.startsWith("dark") ? "dark" : "light"};`,
		);
		tokens.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
		for (const [role, value] of tokens) lines.push(`\t\t--${role}: ${value};`);
		lines.push("\t}");
	}
	lines.push("}", "");
	return { css: lines.join("\n"), report };
}

module.exports = { compileTheme };
