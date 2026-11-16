// A prelude can contain semicolons in URLs, strings, and comments.
function statementEnd(source, start) {
	let quote = null;
	let depth = 0;
	for (let i = start; i < source.length; i++) {
		const char = source[i];
		if (char === "\\") {
			i++;
		} else if (quote) {
			if (char === quote) quote = null;
		} else if (char === '"' || char === "'") {
			quote = char;
		} else if (source.startsWith("/*", i)) {
			const end = source.indexOf("*/", i + 2);
			if (end === -1) return -1;
			i = end + 1;
		} else if (char === "(") {
			depth++;
		} else if (char === ")") {
			depth--;
		} else if (char === ";" && depth === 0) {
			return i + 1;
		}
	}
	return -1;
}

function layerImport(statement, layer) {
	const target =
		/^@import(?:\s|\/\*[\s\S]*?\*\/)+(?:url\((?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\\.|[^)"'\\])*\)|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/i.exec(
			statement,
		);
	if (!target) return statement;
	const suffix = statement.slice(target[0].length);
	// Preserve imports that already choose a named or anonymous layer.
	if (/^(?:\s|\/\*[\s\S]*?\*\/)*layer\b/i.test(suffix)) return statement;
	return `${target[0]} layer(${layer})${suffix}`;
}

function wrapInLayer(source, layer) {
	if (!layer) return source;
	let offset = 0;
	let hoisted = "";
	while (offset < source.length) {
		const leading = /^(?:\s|\/\*[\s\S]*?\*\/)*@(charset|import)\b/i.exec(
			source.slice(offset),
		);
		if (!leading) break;
		const start = offset + leading[0].lastIndexOf("@");
		const end = statementEnd(source, start);
		if (end === -1) break;
		const statement = source.slice(start, end);
		hoisted += source.slice(offset, start);
		hoisted +=
			leading[1].toLowerCase() === "import"
				? layerImport(statement, layer)
				: statement;
		offset = end;
	}
	return `${hoisted ? `${hoisted}\n` : ""}@layer ${layer} {\n${source.slice(offset)}\n}`;
}

module.exports = { wrapInLayer };
