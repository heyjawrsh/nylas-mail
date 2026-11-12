// Require-time compiler for app sources (the old babel JIT slot in
// compile-cache). Internal packages are not bundled: their `.jsx` files and
// ESM-syntax `.js` files are compiled to CommonJS with esbuild when they are
// required, so the CJS loader (and ModuleCache's resolution of the
// app-internal module names) applies to them. node_modules is never touched.
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const APP_ROOT = path.resolve(__dirname, "..", "..");
const NODE_MODULES = `${path.sep}node_modules${path.sep}`;

// Internal packages may be symlinks into the workspace (client-sync); Node
// hands the loader their real paths, so those targets count as app sources.
let appRoots = null;
function getAppRoots() {
	if (appRoots) return appRoots;
	appRoots = [APP_ROOT];
	const internal = path.join(APP_ROOT, "internal_packages");
	try {
		for (const name of fs.readdirSync(internal)) {
			const entry = path.join(internal, name);
			if (fs.lstatSync(entry).isSymbolicLink()) {
				appRoots.push(fs.realpathSync(entry));
			}
		}
	} catch (_err) {
		// no internal_packages (unit tests, trimmed builds)
	}
	return appRoots;
}

function isAppSource(filePath) {
	if (filePath.includes(NODE_MODULES)) return false;
	// esbuild output (the renderer bootstrap bundles) is already CommonJS
	if (filePath.endsWith(".bundle.js")) return false;
	return getAppRoots().some((root) => filePath.startsWith(root + path.sep));
}

// Static import/export statements at the start of a line, or import.meta
// anywhere. `import(` is CommonJS-legal and does not count.
const ESM_STATEMENT =
	/^[ \t]*(?:import(?:[ \t]+[\w$]|[ \t]*[{*"'\n])|export(?:[ \t]+[\w$]|[ \t]*[{*]))/m;
const IMPORT_META = /\bimport\.meta\b/;

function hasModuleSyntax(sourceCode) {
	return ESM_STATEMENT.test(sourceCode) || IMPORT_META.test(sourceCode);
}

// In a packaged app esbuild's JS lives in app.asar, but its native binary
// can only be spawned from app.asar.unpacked (electron-builder asarUnpack).
function useUnpackedBinaryInAsar() {
	if (process.env.ESBUILD_BINARY_PATH) return;
	const asar = `${path.sep}app.asar${path.sep}`;
	let binary;
	try {
		const esbuildDir = path.dirname(require.resolve("esbuild/package.json"));
		const pkg = `@esbuild/${process.platform}-${process.arch}`;
		const file = process.platform === "win32" ? "esbuild.exe" : "bin/esbuild";
		binary = require.resolve(`${pkg}/${file}`, { paths: [esbuildDir] });
	} catch (_err) {
		return; // let esbuild report its own install error
	}
	if (binary.includes(asar)) {
		process.env.ESBUILD_BINARY_PATH = binary.replace(
			asar,
			`${path.sep}app.asar.unpacked${path.sep}`,
		);
	}
}

let esbuild = null;
function getEsbuild() {
	if (!esbuild) {
		// Electron's renderer can't start Node worker threads, which esbuild's
		// sync API uses by default; fall back to its child-process service.
		if (
			process.type === "renderer" &&
			process.env.ESBUILD_WORKER_THREADS === undefined
		) {
			process.env.ESBUILD_WORKER_THREADS = "0";
		}
		useUnpackedBinaryInAsar();
		esbuild = require("esbuild");
	}
	return esbuild;
}

function transformOptions(filePath) {
	return {
		loader: "jsx",
		format: "cjs",
		jsx: "automatic",
		target: "node24",
		platform: "node",
		sourcemap: "inline",
		sourcefile: filePath,
		logLevel: "silent",
	};
}

exports.shouldCompile = (sourceCode, filePath) => {
	if (!isAppSource(filePath)) return false;
	if (path.extname(filePath) === ".js") return hasModuleSyntax(sourceCode);
	return true;
};

exports.getCachePath = (sourceCode, filePath) => {
	const hash = crypto
		.createHash("sha1")
		.update(getEsbuild().version, "utf8")
		.update("\0", "utf8")
		.update(JSON.stringify(transformOptions(filePath)), "utf8")
		.update("\0", "utf8")
		.update(sourceCode, "utf8")
		.digest("hex");
	return path.join("esbuild", `${hash}.js`);
};

exports.compile = (sourceCode, filePath) => {
	try {
		return getEsbuild().transformSync(sourceCode, transformOptions(filePath))
			.code;
	} catch (err) {
		const first = err.errors?.[0];
		if (!first) throw err;
		const loc = first.location;
		const where = loc ? `${filePath}:${loc.line}:${loc.column}` : filePath;
		const syntaxError = new SyntaxError(`${where}: ${first.text}`);
		syntaxError.filePath = filePath;
		syntaxError.line = loc?.line;
		syntaxError.column = loc?.column;
		throw syntaxError;
	}
};

exports.isAppSource = isAppSource;
exports.hasModuleSyntax = hasModuleSyntax;
