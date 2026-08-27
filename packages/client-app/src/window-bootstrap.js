// biome-ignore lint/correctness/noUnusedImports: createRequire IS used in the file:file branch below
import { createRequire } from "node:module";

const nodeRequire =
	typeof import.meta.url === "string" && import.meta.url.startsWith("file:")
		? createRequire(import.meta.url)
		: require;

/* eslint import/first: 0 */

// Swap out Node's native Promise for Bluebird, which allows us to
// do fancy things like handle exceptions inside promise blocks
// biome-ignore lint/correctness/noInvalidUseBeforeDeclaration: nodeRequire is declared at the top of this module
global.Promise = nodeRequire("bluebird");
const timeout = global.setTimeout;
Promise.setScheduler((fn) => timeout(fn, 0));

// Like sands through the hourglass, so are the days of our lives.
import "./bootstrap-assign-env.js";
import "./window";

NylasEnv.initialize();
NylasEnv.startRootWindow();

// Workaround for focus getting cleared upon window creation
const windowFocused = () => {
	window.removeEventListener("focus", windowFocused);
	return setTimeout(() => {
		const elt = document.getElementById("sheet-container");
		if (elt) elt.focus();
	}, 0);
};
window.addEventListener("focus", windowFocused);
