import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import StyleManager from "../src/style-manager.js";
import "../src/styles-element.js";

describe("StylesElement layer metadata", () => {
	let manager;
	let host;
	beforeEach(() => {
		manager = new StyleManager();
		vi.stubGlobal("NylasEnv", { styles: manager });
		host = document.createElement("nylas-styles");
		document.head.appendChild(host);
	});
	afterEach(() => {
		host.remove();
		vi.unstubAllGlobals();
	});

	it("copies layer metadata when a sheet is added", () => {
		manager.addStyleSheet(".a {}", { sourcePath: "/a.css", layer: "baseline" });
		const clone = host.querySelector("style");
		expect(clone).not.toBe(manager.getStyleElements()[0]);
		expect(clone.getAttribute("layer")).toBe("baseline");
		expect(clone.textContent).toBe("@layer baseline {\n.a {}\n}");
	});

	it.each([
		[undefined, "baseline"],
		["baseline", "plugin"],
		["baseline", undefined],
	])("updates the mounted clone from %s to %s", (before, after) => {
		manager.addStyleSheet(".a {}", { sourcePath: "/a.css", layer: before });
		const clone = host.querySelector("style");
		const updated = vi.fn();
		host.onDidUpdateStyleElement(updated);
		manager.addStyleSheet(".b {}", { sourcePath: "/a.css", layer: after });
		expect(host.querySelector("style")).toBe(clone);
		expect(clone.getAttribute("layer")).toBe(after ?? null);
		expect(clone.textContent).toBe(after ? `@layer ${after} {\n.b {}\n}` : ".b {}");
		expect(updated).toHaveBeenCalledWith(clone);
	});
});
