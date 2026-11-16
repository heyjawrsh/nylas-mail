import { beforeEach, describe, expect, it, vi } from "vitest";
import StyleManager from "../src/style-manager.js";

describe("StyleManager layers", () => {
	let manager;
	beforeEach(() => { manager = new StyleManager(); });

	it("wraps sheets and stores layer metadata alongside existing attributes", () => {
		manager.addStyleSheet(".a {}", { sourcePath: "/a.css", context: "composer", priority: 2, layer: "baseline" });
		const [element] = manager.getStyleElements();
		expect(element.textContent).toBe("@layer baseline {\n.a {}\n}");
		expect(element.getAttribute("layer")).toBe("baseline");
		expect(element.getAttribute("source-path")).toBe("/a.css");
		expect(element.getAttribute("context")).toBe("composer");
		expect(element.getAttribute("priority")).toBe("2");
	});

	it("preserves sheets without a layer", () => {
		manager.addStyleSheet(".a {}");
		const [element] = manager.getStyleElements();
		expect(element.textContent).toBe(".a {}");
		expect(element.hasAttribute("layer")).toBe(false);
	});

	it("rewraps updates in place and emits the updated element", () => {
		const updated = vi.fn();
		manager.onDidUpdateStyleElement(updated);
		manager.addStyleSheet(".a {}", { sourcePath: "/a.css", layer: "baseline" });
		const [element] = manager.getStyleElements();
		manager.addStyleSheet('@import "font.css";\n.b {}', { sourcePath: "/a.css", layer: "style" });
		expect(manager.getStyleElements()).toEqual([element]);
		expect(element.textContent).toBe('@import "font.css" layer(style);\n@layer style {\n\n.b {}\n}');
		expect(element.getAttribute("layer")).toBe("style");
		expect(updated).toHaveBeenCalledWith(element);
	});

	it("removes stale layer metadata when an update is unwrapped", () => {
		manager.addStyleSheet(".a {}", { sourcePath: "/a.css", layer: "baseline" });
		manager.addStyleSheet(".b {}", { sourcePath: "/a.css" });
		const [element] = manager.getStyleElements();
		expect(element.textContent).toBe(".b {}");
		expect(element.hasAttribute("layer")).toBe(false);
	});

	it("retains disposal behavior for layered sheets", () => {
		const disposable = manager.addStyleSheet(".a {}", { layer: "plugin" });
		disposable.dispose();
		expect(manager.getStyleElements()).toEqual([]);
	});
});
