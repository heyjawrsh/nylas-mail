// Pure transformations shared by the LESS visitor and its specs.
export const isFontSize = (name) =>
	/^@(font-size(?:-|$)|input-font-size$)/.test(name);

export function fontUnit(name) {
	return `fz${name
		.slice(1)
		.replaceAll("-", "_")
		.replace(/\d/g, (n) => String.fromCharCode(97 + Number(n)))}`;
}

export function placeholders(map) {
	return Object.entries(map)
		.map(([name, entry]) => {
			if (isFontSize(name)) return `${name}: 1${fontUnit(name)};`;
			if (
				entry.kind === "dimension" ||
				(entry.kind === "font" && /^\d+$/.test(entry.css))
			) {
				return `${name}: ${entry.css};`;
			}
			return `${name}: ~"var(--L-${name.slice(1)})";`;
		})
		.join("");
}

export function substitute(value, map) {
	const literals = [];
	let css = value.replace(/var\(--L-([\w-]+)\)/g, (_, name) => {
		const entry = map[`@${name}`];
		if (!entry) throw new Error(`Unknown legacy placeholder: @${name}`);
		if (entry.kind === "literal") literals.push(`@${name}`);
		return entry.css;
	});
	for (const [name, entry] of Object.entries(map)) {
		if (!isFontSize(name)) continue;
		css = css.replace(
			new RegExp(`(-?(?:\\d*\\.)?\\d+)${fontUnit(name)}\\b`, "g"),
			(_, factor) => {
				if (entry.kind === "literal") literals.push(name);
				return Number(factor) === 1
					? entry.css
					: `calc(${entry.css} * ${Number(factor)})`;
			},
		);
	}
	const fontSizeFloor = /__port_floor_/.test(css);
	css = css.replace(
		/__port_floor_(-?[\d.]+)_(px|percent)__/g,
		(_, value, unit) =>
			unit === "px" ? `calc(${value}px * var(--text-scale))` : `${value}%`,
	);
	return { css, literals, fontSizeFloor };
}

export function colourFunction(name, args) {
	const [colour, amount = "50%", second] = args;
	const n = Number.parseFloat(amount);
	switch (name) {
		case "darken":
			return `hsl(from ${colour} h s calc(l - ${n}))`;
		case "lighten":
			return `hsl(from ${colour} h s calc(l + ${n}))`;
		case "desaturate":
			return `hsl(from ${colour} h calc(s - ${n}) l)`;
		case "saturate":
			return `hsl(from ${colour} h calc(s + ${n}) l)`;
		case "fade":
			return `color-mix(in srgb, ${colour} ${n}%, transparent)`;
		case "fadeout":
			return `color-mix(in srgb, ${colour} ${100 - n}%, transparent)`;
		case "mix":
			return `color-mix(in srgb, ${colour} ${second === undefined ? 50 : Number.parseFloat(second)}%, ${amount})`;
		default:
			throw new Error(`Unsupported colour function: ${name}`);
	}
}

// Split only top-level whitespace, preserving calc(), strings, and URLs.
export function valueParts(value) {
	return (
		value.match(
			/(?:[^\s()"']+|\((?:[^()]|\([^()]*\))*\)|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')+/g,
		) || []
	);
}

export function hasHorizontalTranslate(value) {
	return [...value.matchAll(/\btranslate(X|3d)?\(\s*([^,\s)]+)/gi)].some(
		([, axis, first]) =>
			axis?.toLowerCase() === "x" || !/^0(?:px|%)?$/i.test(first),
	);
}

export function logicalDeclaration(name, value, hasTranslate = false) {
	const unconvertible = [];
	const important = value.match(/\s*!important\s*$/i)?.[0] || "";
	if (important) value = value.slice(0, -important.length);
	if (name === "left" && value === "50%" && hasTranslate)
		unconvertible.push("centring");
	else if (/^(left|right)$/.test(name))
		name = `inset-inline-${name === "left" ? "start" : "end"}`;
	if (hasHorizontalTranslate(value)) unconvertible.push("translate");
	if (/gradient\(/i.test(value) && /\b(left|right)\b/.test(value))
		unconvertible.push("gradient-direction");
	if (
		/^background(?:-position(?:-x)?)?$/.test(name) &&
		!/gradient\(/i.test(value) &&
		/\b(left|right)\b/.test(value)
	)
		unconvertible.push("background-position");
	if (/^(margin|padding)$/.test(name)) {
		const parts = valueParts(value);
		if (parts.length === 4 && parts[1] !== parts[3])
			unconvertible.push("asymmetric-shorthand");
	}
	if (name === "border-radius") {
		const parts = valueParts(value.replaceAll("/", " / "));
		const slash = parts.indexOf("/");
		const axes =
			slash < 0 ? [parts] : [parts.slice(0, slash), parts.slice(slash + 1)];
		if (
			axes.some(
				([
					topLeft,
					topRight = topLeft,
					bottomRight = topLeft,
					bottomLeft = topRight,
				]) => topLeft !== topRight || bottomLeft !== bottomRight,
			)
		)
			unconvertible.push("asymmetric-radius");
	}
	name = name.replace(
		/^border-(top|bottom)-(left|right)-radius$/,
		(_, vertical, horizontal) =>
			`border-${vertical === "top" ? "start" : "end"}-${horizontal === "left" ? "start" : "end"}-radius`,
	);
	name = name.replace(
		/^(margin|padding|border)-(left|right)(?=-|$)/,
		(_, prefix, side) =>
			`${prefix}-inline-${side === "left" ? "start" : "end"}`,
	);
	if (/^(text-align|float|clear)$/.test(name) && /^(left|right)$/.test(value)) {
		value = `${name === "text-align" ? "" : "inline-"}${value === "left" ? "start" : "end"}`;
	}
	return { name, value: value + important, unconvertible };
}

export function motionCompanion(selectors) {
	return `@scope ([data-look]) to ([data-look]) {\n${selectors.map((selector) => `  :scope[data-reduced-motion] ${selector}`).join(",\n")} {\n    transition: none;\n    animation: none;\n  }\n}\n`;
}

const importTokens =
	/\/\*[\s\S]*?\*\/|\/\/[^\n]*|@import\s*(?:\(([^)]*)\)\s*)?(["'])([^"']+)\2|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g;

export function hasVariableImport(source) {
	return [...source.matchAll(importTokens)].some((match) =>
		/(?:^|\/)ui-variables(?:\.less)?$/.test(match[3] || ""),
	);
}

export function referenceImports(source) {
	// Match comments and strings first so examples and data URLs stay untouched.
	return source.replace(importTokens, (text, options, quote, target) => {
		if (
			!target ||
			!/(?:^|\/)(?:ui-mixins|buttons)(?:\.less)?$|(?:^|\/)mixins\//.test(target)
		)
			return text;
		const flags = (options || "")
			.split(",")
			.map((flag) => flag.trim())
			.filter(Boolean);
		if (flags.includes("css") || flags.includes("reference")) return text;
		// Added text contains no newlines, preserving source line numbers.
		return options === undefined
			? text.replace("@import", "@import (reference)")
			: text.replace("(", "(reference, ");
	});
}
