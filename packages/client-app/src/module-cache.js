/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__, or convert again using --optional-chaining
 * DS104: Avoid inline assignments
 * DS204: Change includes calls to have a more natural evaluation order
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
let isAbsolute;
const Module = require("module");
const path = require("path");
const semver = require("semver");

// Extend semver.Range to memoize matched versions for speed
class Range extends semver.Range {
	constructor() {
		super(...arguments);
		this.matchedVersions = new Set();
		this.unmatchedVersions = new Set();
	}

	test(version) {
		if (this.matchedVersions.has(version)) {
			return true;
		}
		if (this.unmatchedVersions.has(version)) {
			return false;
		}

		const matches = super.test(...arguments);
		if (matches) {
			this.matchedVersions.add(version);
		} else {
			this.unmatchedVersions.add(version);
		}
		return matches;
	}
}

const nativeModules = process.binding("natives");

const cache = {
	builtins: {},
	debug: false,
	dependencies: {},
	extensions: {},
	folders: {},
	ranges: {},
	registered: false,
	resourcePath: null,
	resourcePathWithTrailingSlash: null,
};

// isAbsolute is inlined from fs-plus so that fs-plus itself can be required
// from this cache.
if (process.platform === "win32") {
	isAbsolute = (pathToCheck) =>
		pathToCheck &&
		(pathToCheck[1] === ":" ||
			(pathToCheck[0] === "\\" && pathToCheck[1] === "\\"));
} else {
	isAbsolute = (pathToCheck) => pathToCheck && pathToCheck[0] === "/";
}

const isCorePath = (pathToCheck) =>
	pathToCheck.startsWith(cache.resourcePathWithTrailingSlash);

var loadDependencies = (modulePath, rootPath, rootMetadata, moduleCache) => {
	const fs = require("fs-plus");

	for (var childPath of Array.from(
		fs.listSync(path.join(modulePath, "node_modules")),
	)) {
		if (path.basename(childPath) === ".bin") {
			continue;
		}
		if (
			rootPath === modulePath &&
			(rootMetadata.packageDependencies != null
				? Object.hasOwn(
						rootMetadata.packageDependencies,
						path.basename(childPath),
					)
				: undefined)
		) {
			continue;
		}

		var childMetadataPath = path.join(childPath, "package.json");
		if (!fs.isFileSync(childMetadataPath)) {
			continue;
		}

		var childMetadata = JSON.parse(fs.readFileSync(childMetadataPath));
		if (childMetadata != null ? childMetadata.version : undefined) {
			var mainPath;
			try {
				mainPath = require.resolve(childPath);
			} catch (error) {
				mainPath = null;
			}

			if (mainPath) {
				moduleCache.dependencies.push({
					name: childMetadata.name,
					version: childMetadata.version,
					path: path.relative(rootPath, mainPath),
				});
			}

			loadDependencies(childPath, rootPath, rootMetadata, moduleCache);
		}
	}
};

var loadFolderCompatibility = (
	modulePath,
	rootPath,
	rootMetadata,
	moduleCache,
) => {
	let left;
	const fs = require("fs-plus");

	const metadataPath = path.join(modulePath, "package.json");
	if (!fs.isFileSync(metadataPath)) {
		return;
	}

	const dependencies =
		(left = __guard__(
			JSON.parse(fs.readFileSync(metadataPath)),
			(x) => x.dependencies,
		)) != null
			? left
			: {};

	for (var name in dependencies) {
		var version = dependencies[name];
		try {
			new Range(version);
		} catch (error) {
			delete dependencies[name];
		}
	}

	const onDirectory = (childPath) =>
		path.basename(childPath) !== "node_modules";

	const extensions = [".js", ".coffee", ".json", ".node"];
	let paths = {};
	const onFile = (childPath) => {
		let needle;
		if (
			((needle = path.extname(childPath)),
			Array.from(extensions).includes(needle))
		) {
			const relativePath = path.relative(rootPath, path.dirname(childPath));
			return (paths[relativePath] = true);
		}
	};
	fs.traverseTreeSync(modulePath, onFile, onDirectory);

	paths = Object.keys(paths);
	if (paths.length > 0 && Object.keys(dependencies).length > 0) {
		moduleCache.folders.push({ paths, dependencies });
	}

	for (var childPath of Array.from(
		fs.listSync(path.join(modulePath, "node_modules")),
	)) {
		if (path.basename(childPath) === ".bin") {
			continue;
		}
		if (
			rootPath === modulePath &&
			(rootMetadata.packageDependencies != null
				? Object.hasOwn(
						rootMetadata.packageDependencies,
						path.basename(childPath),
					)
				: undefined)
		) {
			continue;
		}

		loadFolderCompatibility(childPath, rootPath, rootMetadata, moduleCache);
	}
};

const loadExtensions = (modulePath, rootPath, rootMetadata, moduleCache) => {
	const fs = require("fs-plus");
	const extensions = [".js", ".coffee", ".json", ".node"];
	const nodeModulesPath = path.join(rootPath, "node_modules");

	const onFile = (filePath) => {
		filePath = path.relative(rootPath, filePath);
		const segments = filePath.split(path.sep);
		if (Array.from(segments).includes("test")) {
			return;
		}
		if (Array.from(segments).includes("tests")) {
			return;
		}
		if (Array.from(segments).includes("spec")) {
			return;
		}
		if (Array.from(segments).includes("specs")) {
			return;
		}
		if (
			segments.length > 1 &&
			!["lib", "node_modules", "src", "static", "vendor"].includes(segments[0])
		) {
			return;
		}

		const extension = path.extname(filePath);
		if (Array.from(extensions).includes(extension)) {
			if (moduleCache.extensions[extension] == null) {
				moduleCache.extensions[extension] = [];
			}
			return moduleCache.extensions[extension].push(filePath);
		}
	};

	const onDirectory = (childPath) => {
		// Don't include extensions from bundled packages
		// These are generated and stored in the package's own metadata cache
		if (rootMetadata.name === "nylas") {
			const parentPath = path.dirname(childPath);
			if (parentPath === nodeModulesPath) {
				const packageName = path.basename(childPath);
				if (
					rootMetadata.packageDependencies != null
						? Object.hasOwn(rootMetadata.packageDependencies, packageName)
						: undefined
				) {
					return false;
				}
			}
		}

		return true;
	};

	fs.traverseTreeSync(rootPath, onFile, onDirectory);
};

const satisfies = (version, rawRange) => {
	let parsedRange;
	if (!(parsedRange = cache.ranges[rawRange])) {
		parsedRange = new Range(rawRange);
		cache.ranges[rawRange] = parsedRange;
	}
	return parsedRange.test(version);
};

const resolveFilePath = (relativePath, parentModule) => {
	if (!relativePath) {
		return;
	}
	if (!(parentModule != null ? parentModule.filename : undefined)) {
		return;
	}
	if (relativePath[0] !== "." && !isAbsolute(relativePath)) {
		return;
	}

	const resolvedPath = path.resolve(
		path.dirname(parentModule.filename),
		relativePath,
	);
	if (!isCorePath(resolvedPath)) {
		return;
	}

	let extension = path.extname(resolvedPath);
	if (extension) {
		if (
			cache.extensions[extension] != null
				? cache.extensions[extension].has(resolvedPath)
				: undefined
		) {
			return resolvedPath;
		}
	} else {
		for (extension in cache.extensions) {
			var paths = cache.extensions[extension];
			var resolvedPathWithExtension = `${resolvedPath}${extension}`;
			if (paths.has(resolvedPathWithExtension)) {
				return resolvedPathWithExtension;
			}
		}
	}
};

const resolveModulePath = (relativePath, parentModule) => {
	if (!relativePath) {
		return;
	}
	if (!(parentModule != null ? parentModule.filename : undefined)) {
		return;
	}

	if (Object.hasOwn(nativeModules, relativePath)) {
		return;
	}
	if (relativePath[0] === ".") {
		return;
	}
	if (isAbsolute(relativePath)) {
		return;
	}

	const folderPath = path.dirname(parentModule.filename);

	const range =
		cache.folders[folderPath] != null
			? cache.folders[folderPath][relativePath]
			: undefined;
	if (range == null) {
		let builtinPath;
		if ((builtinPath = cache.builtins[relativePath])) {
			return builtinPath;
		} else {
			return;
		}
	}

	const candidates = cache.dependencies[relativePath];
	if (candidates == null) {
		return;
	}

	for (var version in candidates) {
		var resolvedPath = candidates[version];
		if (
			Object.hasOwn(Module._cache, resolvedPath) ||
			isCorePath(resolvedPath)
		) {
			if (satisfies(version, range)) {
				return resolvedPath;
			}
		}
	}
};

const registerBuiltins = (devMode) => {
	let builtin;
	const electronRoot = path.join(process.resourcesPath, "atom.asar");

	const commonRoot = path.join(electronRoot, "common", "api", "lib");
	const commonBuiltins = [
		"callbacks-registry",
		"clipboard",
		"crash-reporter",
		"screen",
		"shell",
	];
	for (builtin of Array.from(commonBuiltins)) {
		cache.builtins[builtin] = path.join(commonRoot, `${builtin}.js`);
	}

	const rendererRoot = path.join(electronRoot, "renderer", "api", "lib");
	const rendererBuiltins = ["ipc", "remote"];
	return (() => {
		const result = [];
		for (builtin of Array.from(rendererBuiltins)) {
			result.push(
				(cache.builtins[builtin] = path.join(rendererRoot, `${builtin}.js`)),
			);
		}
		return result;
	})();
};

if (cache.debug) {
	cache.findPathCount = 0;
	cache.findPathTime = 0;
	cache.loadCount = 0;
	cache.requireTime = 0;
	global.moduleCache = cache;

	const originalLoad = Module.prototype.load;
	Module.prototype.load = function () {
		cache.loadCount++;
		return originalLoad.apply(this, arguments);
	};

	const originalRequire = Module.prototype.require;
	Module.prototype.require = function () {
		const startTime = Date.now();
		const exports = originalRequire.apply(this, arguments);
		cache.requireTime += Date.now() - startTime;
		return exports;
	};

	const originalFindPath = Module._findPath;
	Module._findPath = function (request, paths) {
		const cacheKey = JSON.stringify({ request, paths });
		if (!Module._pathCache[cacheKey]) {
			cache.findPathCount++;
		}

		const startTime = Date.now();
		const foundPath = originalFindPath.apply(global, arguments);
		cache.findPathTime += Date.now() - startTime;
		return foundPath;
	};
}

exports.create = (modulePath) => {
	const fs = require("fs-plus");

	modulePath = fs.realpathSync(modulePath);
	const metadataPath = path.join(modulePath, "package.json");
	const metadata = JSON.parse(fs.readFileSync(metadataPath));

	const moduleCache = {
		version: 1,
		dependencies: [],
		extensions: {},
		folders: [],
	};

	loadDependencies(modulePath, modulePath, metadata, moduleCache);
	loadFolderCompatibility(modulePath, modulePath, metadata, moduleCache);
	loadExtensions(modulePath, modulePath, metadata, moduleCache);

	metadata._nylasModuleCache = moduleCache;
	fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
};

exports.register = (param) => {
	if (param == null) {
		param = {};
	}
	const { resourcePath, devMode } = param;
	if (cache.registered) {
		return;
	}

	const originalResolveFilename = Module._resolveFilename;
	Module._resolveFilename = (relativePath, parentModule) => {
		let resolvedPath = resolveModulePath(relativePath, parentModule);
		if (resolvedPath == null) {
			resolvedPath = resolveFilePath(relativePath, parentModule);
		}
		return resolvedPath != null
			? resolvedPath
			: originalResolveFilename(relativePath, parentModule);
	};

	cache.registered = true;
	cache.resourcePath = resourcePath;
	cache.resourcePathWithTrailingSlash = `${resourcePath}${path.sep}`;
	registerBuiltins(devMode);
};

exports.add = (directoryPath, metadata) => {
	// path.join isn't used in this function for speed since path.join calls
	// path.normalize and all the paths are already normalized here.

	if (metadata == null) {
		try {
			metadata = require(`${directoryPath}${path.sep}package.json`);
		} catch (error) {
			return;
		}
	}

	const cacheToAdd = metadata != null ? metadata._nylasModuleCache : undefined;
	if (cacheToAdd == null) {
		return;
	}

	for (var dependency of Array.from(
		cacheToAdd.dependencies != null ? cacheToAdd.dependencies : [],
	)) {
		if (cache.dependencies[dependency.name] == null) {
			cache.dependencies[dependency.name] = {};
		}
		if (cache.dependencies[dependency.name][dependency.version] == null) {
			cache.dependencies[dependency.name][dependency.version] =
				`${directoryPath}${path.sep}${dependency.path}`;
		}
	}

	for (var entry of Array.from(
		cacheToAdd.folders != null ? cacheToAdd.folders : [],
	)) {
		for (var folderPath of Array.from(entry.paths)) {
			if (folderPath) {
				cache.folders[`${directoryPath}${path.sep}${folderPath}`] =
					entry.dependencies;
			} else {
				cache.folders[directoryPath] = entry.dependencies;
			}
		}
	}

	for (var extension in cacheToAdd.extensions) {
		var paths = cacheToAdd.extensions[extension];
		if (cache.extensions[extension] == null) {
			cache.extensions[extension] = new Set();
		}
		for (var filePath of Array.from(paths)) {
			cache.extensions[extension].add(`${directoryPath}${path.sep}${filePath}`);
		}
	}
};

exports.cache = cache;

function __guard__(value, transform) {
	return typeof value !== "undefined" && value !== null
		? transform(value)
		: undefined;
}
