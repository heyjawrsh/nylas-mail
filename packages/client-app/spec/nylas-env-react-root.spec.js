import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Real React and react-dom/client: this spec checks that the workspace root
// mounts through createRoot (React 19 removed ReactDOM.render) and can be
// unmounted again. Everything else NylasEnv pulls in is stubbed.
const m = vi.hoisted(() => ({
	rendered: [],
}));

vi.mock("node:module", () => {
	const required = vi.fn(() => ({}));
	const createRequire = () => required;
	return { default: { createRequire, globalPaths: [] }, createRequire, globalPaths: [] };
});
vi.mock("electron", () => ({
	default: { ipcRenderer: { on: vi.fn(), send: vi.fn() }, shell: {} },
	ipcRenderer: { on: vi.fn(), send: vi.fn() },
	shell: {},
}));
vi.mock("@electron/remote", () => {
	const remote = { getCurrentWindow: vi.fn(), getGlobal: vi.fn(), app: {}, screen: {}, dialog: {} };
	return { default: remote, ...remote };
});
vi.mock("coffeestack", () => ({ default: {}, convertStackTrace: vi.fn((stack) => stack) }));
vi.mock("source-map-support", () => ({ default: {}, mapSourcePosition: vi.fn((position) => position) }));
vi.mock("../src/window-event-handler.js", () => ({ default: class WindowEventHandler {} }));
vi.mock("../src/styles-element.js", () => ({ default: class StylesElement {} }));
vi.mock("../src/registries/store-registry.js", () => ({ default: { activateAllStores: vi.fn() } }));
vi.mock("../src/config.js", () => ({ default: class Config {} }));
vi.mock("../src/theme-manager.js", () => ({ default: class ThemeManager {} }));
vi.mock("../src/style-manager.js", () => ({ default: class StyleManager {} }));
vi.mock("../src/error-logger.js", () => ({ default: class ErrorLogger {} }));
vi.mock("../src/flux/stores/workspace-store.js", () => ({ default: { Sheet: {}, defineSheet: vi.fn() } }));
vi.mock("../src/sheet-container.jsx", async () => {
	const { createElement, useEffect } = await import("react");
	function SheetContainer() {
		useEffect(() => {
			m.rendered.push("mounted");
			return () => m.rendered.push("unmounted");
		}, []);
		return createElement("div", { className: "sheet-probe" }, "workspace");
	}
	return { default: SheetContainer };
});
vi.mock("nylas-exports", () => ({ default: {}, Actions: {} }));
vi.mock("nylas-component-kit", () => ({ default: {}, CodeSnippet: () => null }));

import { act } from "react";
import NylasEnv from "../src/nylas-env.js";

describe("NylasEnv workspace React root", () => {
	let host;
	let env;

	beforeEach(() => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true;
		m.rendered.length = 0;
		host = document.createElement("section");
		host.id = "workspace-host";
		document.body.appendChild(host);
		env = Object.create(NylasEnv.prototype);
		env.workspaceViewParentSelector = "#workspace-host";
	});

	afterEach(() => {
		act(() => env.unmountReactRoot());
		host.remove();
	});

	it("mounts the sheet container through createRoot", () => {
		let item;
		act(() => {
			item = env.initializeReactRoot();
		});
		expect(item.id).toBe("sheet-container");
		expect(host.lastChild).toBe(item);
		expect(item.querySelector(".sheet-probe").textContent).toBe("workspace");
		expect(env.reactRoot).toBeTruthy();
		expect(m.rendered).toEqual(["mounted"]);
	});

	it("unmounts the tree and removes the container", () => {
		let item;
		act(() => {
			item = env.initializeReactRoot();
		});
		act(() => env.unmountReactRoot());
		expect(m.rendered).toEqual(["mounted", "unmounted"]);
		expect(item.childNodes).toHaveLength(0);
		expect(item.isConnected).toBe(false);
		expect(env.reactRoot).toBeNull();
		expect(env.item).toBeNull();
	});

	it("treats unmounting without a root as a no-op", () => {
		expect(() => env.unmountReactRoot()).not.toThrow();
		expect(env.reactRoot).toBeUndefined();
	});
});
