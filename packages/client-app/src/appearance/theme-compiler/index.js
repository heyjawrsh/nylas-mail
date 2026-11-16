const Ajv = require("ajv");
const addFormats = require("ajv-formats");
const { wcagContrast } = require("culori");
const {
	parseTree,
	getNodeValue,
	printParseErrorCode,
} = require("jsonc-parser");
const schema = require("./vendor/dtcg-2025.10-format.json");
const { VARIANTS, ROLES, CONTRAST_PAIRS } = require("./contract");
const { serialize } = require("./serialize");

const ajv = new Ajv({ strict: false, allErrors: true });
addFormats(ajv);
const validateTheme = ajv.compile(schema);
const valueValidators = Object.fromEntries(
	[...new Set(Object.values(ROLES))].map((type) => [
		type,
		ajv.getSchema(
			`https://www.designtokens.org/schemas/2025.10/format/values/${type}.json`,
		),
	]),
);
// Require the actual end of the string, including for trailing newlines.
const NAME = /^[a-z0-9]+(-[a-z0-9]+)*(?![\s\S])/;
const ALIAS = /^\{([^${}.][^{}.]*(?:\.[^${}.][^{}.]*)*)\}(?![\s\S])/;
const isObject = (value) =>
	value !== null && typeof value === "object" && !Array.isArray(value);
const pathKey = (parts) => JSON.stringify(parts);

function tokensIn(root) {
	const tokens = [];
	function walk(node, parts, inheritedType) {
		if (!isObject(node)) return;
		const type = node.$type ?? inheritedType;
		if (Object.hasOwn(node, "$value")) {
			tokens.push({ node, parts, type });
			return;
		}
		for (const key of Object.keys(node).sort()) {
			if (!key.startsWith("$")) walk(node[key], [...parts, key], type);
		}
	}
	walk(root, [], undefined);
	return tokens;
}

function compileTheme(
	text,
	{ builtIn = false, classicTokens, allowMissingVariants = [] } = {},
) {
	const report = [];
	report.filledRoles = [];
	const result = (css) => ({ css, report });
	const lineMap = new Map();
	const tokenPaths = new Set();
	function lineAt(parts) {
		for (let i = parts.length; i >= 0; i--) {
			const key = pathKey(parts.slice(0, i));
			if (tokenPaths.has(key)) return lineMap.get(key) ?? 1;
		}
		for (let i = parts.length; i >= 0; i--) {
			const line = lineMap.get(pathKey(parts.slice(0, i)));
			if (line !== undefined) return line;
		}
		return 1;
	}
	function add(code, level, parts, message, line = lineAt(parts)) {
		report.push({ code, level, path: parts.join("."), line, message });
	}
	if (text.length > 256 * 1024) {
		add("too-large", "error", [], "Theme exceeds 256 KiB of text.");
		return result("");
	}
	const lineStarts = [0];
	for (const match of text.matchAll(/\r\n|\r|\n/g))
		lineStarts.push(match.index + match[0].length);
	function offsetLine(offset) {
		let low = 0;
		let high = lineStarts.length;
		while (low + 1 < high) {
			const mid = (low + high) >>> 1;
			if (lineStarts[mid] <= offset) low = mid;
			else high = mid;
		}
		return low + 1;
	}
	const errors = [];
	const tree = parseTree(text, errors, {
		disallowComments: true,
		allowTrailingComma: false,
	});
	if (errors.length || !tree) {
		for (const error of errors)
			add(
				"parse",
				"error",
				[],
				printParseErrorCode(error.error),
				offsetLine(error.offset),
			);
		if (!errors.length) add("parse", "error", [], "Expected JSON input.");
		return result("");
	}
	function indexLines(node, parts, offset = node.offset) {
		lineMap.set(pathKey(parts), offsetLine(offset));
		if (node.type === "object") {
			if (
				node.children.some(
					(property) => property.children[0].value === "$value",
				)
			)
				tokenPaths.add(pathKey(parts));
			const keys = new Set();
			for (const property of node.children) {
				const [key, value] = property.children;
				if (keys.has(key.value))
					add(
						"schema",
						"error",
						[...parts, key.value],
						`Duplicate key: ${key.value}.`,
						offsetLine(key.offset),
					);
				keys.add(key.value);
				indexLines(value, [...parts, key.value], key.offset);
			}
		} else if (node.type === "array") {
			node.children.forEach((child, i) =>
				indexLines(child, [...parts, String(i)]),
			);
		}
	}
	indexLines(tree, []);
	const theme = getNodeValue(tree);
	if (!validateTheme(theme)) {
		for (const error of validateTheme.errors) {
			const parts = error.instancePath
				? error.instancePath
						.slice(1)
						.split("/")
						.map((part) => part.replace(/~1/g, "/").replace(/~0/g, "~"))
				: [];
			const property =
				error.params.additionalProperty ?? error.params.missingProperty;
			if (property !== undefined) parts.push(property);
			add("schema", "error", parts, `DTCG schema: ${error.message}.`);
		}
	}
	const idPath = ["$extensions", "org.nylas.theme", "id"];
	const id = theme?.$extensions?.["org.nylas.theme"]?.id;
	if (typeof id !== "string" || !NAME.test(id)) {
		add(
			"invalid-id",
			"error",
			idPath,
			"invalid-id: Expected lowercase letters and digits separated by single hyphens.",
		);
		return result("");
	}
	const authored = tokensIn(theme);
	const fallback = builtIn ? [] : tokensIn(classicTokens);
	for (const token of authored.filter(
		(token) => !VARIANTS.includes(token.parts[0]),
	)) {
		add(
			"unknown-token",
			"warning",
			token.parts,
			"Token outside the variant role contract is ignored.",
		);
	}

	function resolvedValue(token, root) {
		let value = token.node.$value;
		const seen = new Set([token.parts.join(".")]);
		while (typeof value === "string" && ALIAS.test(value)) {
			const target = value.match(ALIAS)[1];
			if (seen.has(target)) {
				add(
					"alias-cycle",
					"error",
					token.parts,
					`Alias cycle through ${target}.`,
				);
				return { failed: true };
			}
			seen.add(target);
			let node = root;
			for (const part of target.split("."))
				node =
					isObject(node) && Object.hasOwn(node, part) ? node[part] : undefined;
			if (!isObject(node) || !Object.hasOwn(node, "$value")) {
				add(
					"forbidden-value",
					"error",
					token.parts,
					`Alias target ${target} is not a token.`,
				);
				return { failed: true };
			}
			value = node.$value;
		}
		return { value };
	}

	// Check aliases even when their tokens are outside the emitted role contract.
	const resolvedAuthored = new Map(
		authored.map((token) => [
			pathKey(token.parts),
			resolvedValue(token, theme),
		]),
	);
	const lines = ["@layer theme {"];
	for (const variant of VARIANTS) {
		const present = Object.hasOwn(theme, variant);
		const canFill =
			!builtIn &&
			!variant.endsWith("-hc") &&
			isObject(classicTokens?.[variant]);
		if (!present && !canFill) {
			if (builtIn && !allowMissingVariants.includes(variant)) {
				for (const role of Object.keys(ROLES).sort())
					add(
						"gate",
						"error",
						[variant, role],
						`Missing ${variant}.${role}: variant ${variant} is absent.`,
					);
			}
			continue;
		}
		const roles = new Map();
		for (const token of authored.filter(
			(token) => token.parts[0] === variant,
		)) {
			const role = token.parts.slice(1).join("-");
			if (!NAME.test(role)) {
				add("schema", "error", token.parts, "Invalid role name.");
				continue;
			}
			if (roles.has(role)) {
				add("schema", "error", token.parts, `Duplicate role: ${role}.`);
				continue;
			}
			roles.set(role, { ...token, root: theme });
			if (!Object.hasOwn(ROLES, role))
				add(
					"unknown-token",
					"warning",
					token.parts,
					`Unknown token ${role} is ignored.`,
				);
		}
		const classicRoles = new Map(
			fallback
				.filter((token) => token.parts[0] === variant)
				.map((token) => [token.parts.slice(1).join("-"), token]),
		);
		const emitted = new Map();
		for (const role of Object.keys(ROLES).sort()) {
			let token = roles.get(role);
			let filled = false;
			if (!token) {
				if (builtIn) {
					if (!allowMissingVariants.includes(variant))
						add(
							"gate",
							"error",
							[variant, role],
							`Missing ${variant}.${role}.`,
						);
					continue;
				}
				const classic = classicRoles.get(role);
				if (!classic) continue;
				token = { ...classic, root: classicTokens };
				filled = true;
			}
			const type = ROLES[role];
			if (token.type !== type) {
				add(
					"schema",
					"error",
					token.parts,
					`Role ${role} requires type ${type}; received ${JSON.stringify(token.type) ?? "no type"}.`,
				);
				continue;
			}
			const resolved = filled
				? resolvedValue(token, token.root)
				: resolvedAuthored.get(pathKey(token.parts));
			if (resolved.failed) continue;
			try {
				if (!valueValidators[type](resolved.value))
					throw new Error(`Expected a DTCG ${type} value.`);
				const css = serialize(type, resolved.value, role);
				emitted.set(role, {
					css,
					parts: filled ? [variant, role] : token.parts,
				});
				if (filled) {
					report.filledRoles.push(`${variant}.${role}`);
					add(
						"filled-role",
						"info",
						[variant, role],
						`Filled ${variant}.${role} from Classic.`,
					);
				}
			} catch (error) {
				add("forbidden-value", "error", token.parts, error.message);
			}
		}
		for (const [fg, bg, minimum, scope] of CONTRAST_PAIRS) {
			if (scope === "hc" && !variant.endsWith("-hc")) continue;
			if (!emitted.has(fg) || !emitted.has(bg)) continue;
			const ratio = wcagContrast(emitted.get(fg).css, emitted.get(bg).css);
			if (ratio >= minimum) continue;
			const gate = builtIn && fg === "text-strong" && bg === "surface-panel";
			add(
				gate ? "gate" : "contrast",
				gate ? "error" : "warning",
				emitted.get(fg).parts,
				`${variant}: ${fg} on ${bg} is ${ratio.toFixed(2)}:1; requires ${minimum}:1.`,
			);
		}
		lines.push(
			`\t[data-look][data-theme="${id}"][data-variant="${variant}"] {`,
		);
		lines.push(
			`\t\tcolor-scheme: ${variant.startsWith("dark") ? "dark" : "light"};`,
		);
		for (const [role, value] of emitted)
			lines.push(`\t\t--${role}: ${value.css};`);
		lines.push("\t}");
	}
	lines.push("}", "");
	return result(lines.join("\n"));
}

module.exports = { compileTheme };
