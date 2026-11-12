// Renderer only, and must be the first import of each window bootstrap.
//
// The bootstrap bundle already holds the flux layer, the component kit and
// React. Unbundled code (internal packages, and the bundle's own runtime
// requires) asks for them by name. Without this, Node would resolve those
// names through src/global and node_modules and load a second copy of every
// store, component and library. Point the names at the bundle's instances.
const Module = require("node:module");

const PREFIX = "nylas-bundled:";

const providers = {
	"nylas-exports": () => {
		require("nylas-exports");
		return globalThis.$n;
	},
	// The bundle's own kit instance (src/global/nylas-component-kit-bundle.cjs),
	// so bundled code and packages read the same components.
	"nylas-component-kit": () => require("nylas-component-kit"),
	"nylas-store": () => require("nylas-store"),
	"nylas-observables": () => require("nylas-observables"),
	// One React for the bundle and the packages: hooks and the JSX runtime
	// only work against the renderer that mounted the tree.
	react: () => require("react"),
	"react/jsx-runtime": () => require("react/jsx-runtime"),
	"react-dom": () => require("react-dom"),
	"react-dom/client": () => require("react-dom/client"),
	// NylasEnv adds Observable.fromQuery & co. to the bundled copy.
	"rx-lite": () => require("rx-lite"),
};

function cachedModuleFor(name) {
	const id = `${PREFIX}${name}`;
	if (!Module._cache[id]) {
		const mod = new Module(id, null);
		mod.filename = id;
		mod.exports = providers[name]();
		mod.loaded = true;
		Module._cache[id] = mod;
	}
	return id;
}

if (typeof window !== "undefined" && !Module._nylasBundledModules) {
	Module._nylasBundledModules = true;
	const originalResolveFilename = Module._resolveFilename;
	Module._resolveFilename = function resolveBundled(request, ...rest) {
		if (Object.hasOwn(providers, request)) {
			return cachedModuleFor(request);
		}
		return originalResolveFilename.call(this, request, ...rest);
	};
}
