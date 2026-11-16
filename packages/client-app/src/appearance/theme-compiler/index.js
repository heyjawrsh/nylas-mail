const VARIANTS = ["light", "dark", "light-hc", "dark-hc"];
// Require the actual end of the string, including for trailing newlines.
const NAME = /^[a-z0-9]+(-[a-z0-9]+)*(?![\s\S])/;

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
	if (value.hex !== undefined) {
		const hex = value.hex.toLowerCase();
		if (value.alpha === undefined) return hex;
		const alpha = Math.round(value.alpha * 255)
			.toString(16)
			.padStart(2, "0");
		return hex.slice(0, 7) + (value.alpha < 1 ? alpha : "");
	}
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
	if (typeof id !== "string" || !NAME.test(id)) {
		return {
			css: "",
			report: [
				{
					level: "error",
					path: "$extensions.org.nylas.theme.id",
					message:
						"invalid-id: Expected lowercase letters and digits separated by single hyphens.",
				},
			],
		};
	}
	const lines = ["@layer theme {"];
	for (const variant of VARIANTS) {
		if (!Object.hasOwn(theme, variant)) continue;
		const tokens = [];
		const roles = new Set();
		function walk(node, parts, inheritedType) {
			if (!isObject(node)) return;
			const type = node.$type ?? inheritedType;
			if (Object.hasOwn(node, "$value")) {
				const path = [variant, ...parts].join(".");
				const role = parts.join("-");
				if (!NAME.test(role)) {
					report.push({ level: "error", path, message: "Invalid role name." });
					return;
				}
				if (roles.has(role)) {
					report.push({
						level: "error",
						code: "schema",
						path,
						message: `Duplicate role: ${role}.`,
					});
					return;
				}
				roles.add(role);
				if (type === undefined) {
					report.push({
						level: "error",
						path,
						message: "Token type could not be resolved.",
					});
					return;
				}
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
				tokens.push([role, value]);
				return;
			}
			for (const key of Object.keys(node).sort()) {
				if (!key.startsWith("$")) walk(node[key], [...parts, key], type);
			}
		}
		walk(theme[variant], [], theme.$type);
		lines.push(
			`\t[data-look][data-theme="${id}"][data-variant="${variant}"] {`,
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
