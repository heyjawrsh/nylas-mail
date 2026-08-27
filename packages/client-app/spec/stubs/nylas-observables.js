// Test-resolution shim: materializes the lazy getter exports of the
// runtime bridge so vitest static named-import analysis sees them.
// Each read is guarded: the app module graph has intentional
// model<->store cycles that only resolve lazily; a read that lands
// mid-cycle yields undefined rather than aborting the whole suite.
import bridge from "../../src/global/nylas-observables.js";

const safe = (name) => {
	try {
		return bridge[name];
	} catch (_e) {
		return undefined;
	}
};

export const Categories = safe("Categories");
