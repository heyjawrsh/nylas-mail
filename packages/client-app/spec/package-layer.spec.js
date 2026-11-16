import { beforeEach, describe, expect, it, vi } from "vitest";
import Package from "../src/package.js";

describe("Package stylesheet layers", () => {
	beforeEach(() => {
		globalThis.NylasEnv = { styles: { addStyleSheet: vi.fn(() => ({ dispose: vi.fn() })) } };
	});

	const activate = ({ bundled = false, type = "nylas", sourcePath = "/package/main.less" } = {}) => {
		const pkg = Object.create(Package.prototype);
		pkg.bundledPackage = bundled;
		pkg.getType = () => type;
		pkg.stylesheets = [[sourcePath, ".a {}"]];
		pkg.activateStylesheets();
		return pkg;
	};

	it.each([
		[true, "nylas", "baseline"],
		[false, "nylas", "plugin"],
		[true, "theme", "style"],
		[false, "theme", "style"],
	])("assigns bundled=%s type=%s to %s", (bundled, type, layer) => {
		activate({ bundled, type });
		expect(NylasEnv.styles.addStyleSheet).toHaveBeenCalledWith(".a {}", { sourcePath: "/package/main.less", context: undefined, priority: 0, layer });
	});

	it.each(["/package/main.email-frame.less", "/package/email-frame/main.less", "/package/email-frame.less"])("leaves %s unwrapped for every package type", (sourcePath) => {
		for (const [bundled, type] of [[true, "nylas"], [false, "nylas"], [true, "theme"], [false, "theme"]]) {
			activate({ bundled, type, sourcePath });
			expect(NylasEnv.styles.addStyleSheet).toHaveBeenLastCalledWith(".a {}", expect.objectContaining({ sourcePath, layer: undefined }));
		}
	});

	it("keeps non-email contexts layered and only activates once", () => {
		const pkg = activate({ sourcePath: "/package/main.composer.less" });
		pkg.activateStylesheets();
		expect(NylasEnv.styles.addStyleSheet).toHaveBeenCalledOnce();
		expect(NylasEnv.styles.addStyleSheet).toHaveBeenCalledWith(".a {}", expect.objectContaining({ context: "composer", layer: "plugin" }));
	});
});
