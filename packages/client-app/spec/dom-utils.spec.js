import { describe, it } from "vitest";

describe.skip("DOMUtils", () => {
	it("is not imported because src/dom-utils.js is a CommonJS module", () => {
		// Intentionally skipped: the target has top-level require(...) calls.
		// The client-app Vitest migration rules prohibit editing source to test it.
	});
});
