// Loads an internal-package module written with CommonJS `require`s of
// extensionless .jsx siblings (thread-list, message-list), which neither vite
// nor Node can import. Each file is compiled to CommonJS with esbuild, the way
// the app's compile cache loads packages at runtime. `provided` answers
// requests by name first (bare names like "react" or "nylas-exports", or a
// relative request exactly as written, like "./thread-list-store"), so a spec
// hands in its own React, stubs and mocks; other relative requests load the
// real sibling through the same loader.
import fs from "node:fs";
import Module, { createRequire } from "node:module";
import path from "node:path";
import { execFileSync } from "node:child_process";

// esbuild won't load under jsdom (it checks that TextEncoder yields this
// realm's Uint8Array), so compile in a plain Node child. Compiled code is
// cached per file for the whole run.
const COMPILE = `
const { transformSync } = require("esbuild");
const file = process.argv[1];
const source = require("fs").readFileSync(file, "utf8");
process.stdout.write(transformSync(source, { loader: "jsx", jsx: "automatic", format: "cjs", sourcefile: file }).code);
`;
const compiled = new Map();
function compile(absPath) {
	if (!compiled.has(absPath)) {
		compiled.set(
			absPath,
			execFileSync(process.execPath, ["-e", COMPILE, absPath], {
				cwd: path.join(path.dirname(new URL(import.meta.url).pathname), ".."),
				encoding: "utf8",
			}),
		);
	}
	return compiled.get(absPath);
}

const EXTENSIONS = ["", ".js", ".jsx", "/index.js"];

function resolveRelative(fromFile, request) {
	const base = path.resolve(path.dirname(fromFile), request);
	for (const ext of EXTENSIONS) {
		const candidate = `${base}${ext}`;
		if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
			return candidate;
		}
	}
	throw new Error(`load-package-module: can't resolve ${request} from ${fromFile}`);
}

export function createPackageLoader(provided = {}) {
	const cache = new Map();

	const load = (absPath) => {
		if (cache.has(absPath)) {
			return cache.get(absPath).exports;
		}
		const code = compile(absPath);
		const mod = new Module(absPath, null);
		mod.filename = absPath;
		mod.paths = Module._nodeModulePaths(path.dirname(absPath));
		const nativeRequire = createRequire(absPath);
		mod.require = (request) => {
			if (Object.hasOwn(provided, request)) {
				const value = provided[request];
				// A stub given as { default: X } stands in for an ES module.
				return value && typeof value === "object" && "default" in value && !value.__esModule
					? { __esModule: true, ...value }
					: value;
			}
			if (request.startsWith(".")) {
				const resolved = resolveRelative(absPath, request);
				if (/\.jsx?$/.test(resolved)) {
					return load(resolved);
				}
				return nativeRequire(resolved);
			}
			return nativeRequire(request);
		};
		cache.set(absPath, mod);
		mod._compile(code, absPath);
		return mod.exports;
	};

	return load;
}
