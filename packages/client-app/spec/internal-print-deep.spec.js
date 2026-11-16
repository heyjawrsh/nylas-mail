import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
	getPath: vi.fn(() => "/tmp/nylas-print"),
	writeFileSync: vi.fn(),
	loadURL: vi.fn(),
	browserOptions: [],
	accountForId: vi.fn(),
	listen: vi.fn(() => vi.fn()),
}));

vi.mock("node:fs", () => ({ default: { writeFileSync: m.writeFileSync } }));
vi.mock("electron", () => {
	class BrowserWindow {
		constructor(options) { m.browserOptions.push(options); }
		loadURL = m.loadURL;
	}
	return { remote: { app: { getPath: m.getPath }, BrowserWindow } };
});
// The code reads the remote surface from @electron/remote; reuse the electron
// mock's remote so both stay in step.
vi.mock("@electron/remote", async () => {
	const electron = await import("electron");
	const remote = electron.remote ?? electron.default?.remote;
	return { default: remote, ...remote, remote };
});
vi.mock("nylas-exports", () => ({
	default: { AccountStore: { accountForId: m.accountForId }, Actions: { printThread: { listen: m.listen } } },
	AccountStore: { accountForId: m.accountForId }, Actions: { printThread: { listen: m.listen } },
}));
import PrintWindow from "../internal_packages/print/lib/print-window.js";
import Printer from "../internal_packages/print/lib/printer.js";
import { kernelSheet } from "../src/appearance/layers.js";

describe("print window", () => {
	beforeEach(() => { vi.clearAllMocks(); m.browserOptions.length = 0; });
	afterEach(() => {
		for (const name of ["data-look", "data-theme", "data-variant"]) {
			document.documentElement.removeAttribute(name);
		}
	});

	const build = (overrides = {}) => new PrintWindow({
		subject: "Quarterly update", account: { name: "Ada", email: "ada@example.com" },
		participants: [{ name: "Grace", email: "grace@example.com" }],
		styleTags: "<style>.message { color: red }</style>", htmlContent: "<main>Body</main>",
		printMessages: '["message"]', ...overrides,
	});

	it("writes the generated document to the app temp directory", () => {
		build();
		expect(m.writeFileSync).toHaveBeenCalledWith("/tmp/nylas-print/print.html", expect.any(String));
	});

	it("declares the shared kernel before copied styles", () => {
		const styleTags = "<style>@layer baseline { .message { color: red } }</style>";
		build({ styleTags });
		const html = m.writeFileSync.mock.calls[0][1];
		const doc = new DOMParser().parseFromString(html, "text/html");
		const styles = doc.head.querySelectorAll('style, link[rel="stylesheet"]');
		expect(styles[0].id).toBe("nylas-kernel");
		expect(styles[0].textContent).toBe(kernelSheet());
		expect(html.indexOf('id="nylas-kernel"')).toBeLessThan(html.indexOf(styleTags));
	});

	it("copies the opener's current look attributes each time it builds", () => {
		document.documentElement.setAttribute("data-look", "");
		document.documentElement.setAttribute("data-theme", "classic");
		document.documentElement.setAttribute("data-variant", "light");
		build();
		expect(m.writeFileSync.mock.calls[0][1]).toContain('<html data-look="" data-theme="classic" data-variant="light">');
		document.documentElement.setAttribute("data-variant", "dark");
		build();
		expect(m.writeFileSync.mock.calls[1][1]).toContain('data-variant="dark"');
	});

	it.each([null, "data-look", "data-theme", "data-variant"])("omits absent look attributes with %s present", (present) => {
		if (present) document.documentElement.setAttribute(present, "");
		build();
		const root = new DOMParser().parseFromString(m.writeFileSync.mock.calls[0][1], "text/html").documentElement;
		for (const name of ["data-look", "data-theme", "data-variant"]) {
			expect(root.hasAttribute(name)).toBe(name === present);
		}
	});

	it("escapes look attribute values without adding markup", () => {
		const value = `" data-injected="yes"><script>&amp;'</script>`;
		for (const name of ["data-look", "data-theme", "data-variant"]) {
			document.documentElement.setAttribute(name, value);
		}
		build();
		const html = m.writeFileSync.mock.calls[0][1];
		expect(html).toContain("&quot; data-injected=&quot;yes&quot;&gt;&lt;script&gt;&amp;amp;&#39;&lt;/script&gt;");
		const root = new DOMParser().parseFromString(html, "text/html").documentElement;
		expect(root.getAttributeNames()).toEqual(["data-look", "data-theme", "data-variant"]);
		for (const name of root.getAttributeNames()) expect(root.getAttribute(name)).toBe(value);
	});

	it("includes thread, account, participant, and message data", () => {
		build();
		const html = m.writeFileSync.mock.calls[0][1];
		expect(html).toContain("Quarterly update");
		expect(html).toContain("Ada &lt;ada@example.com&gt;");
		expect(html).toContain("Grace &lt;grace@example.com&gt;");
		expect(html).toContain("window.printMessages = [\"message\"]");
	});

	it("joins multiple participants without comma text", () => {
		build({ participants: [{ name: "A", email: "a@x" }, { name: "B", email: "b@x" }] });
		const html = m.writeFileSync.mock.calls[0][1];
		expect(html.match(/class="participant"/g)).toHaveLength(2);
	});

	it("creates a sandboxed browser window with a subject title", () => {
		build();
		expect(m.browserOptions[0]).toEqual(expect.objectContaining({ width: 800, height: 600, title: "Print - Quarterly update", webPreferences: { nodeIntegration: false } }));
	});

	it("loads the generated file URL", () => {
		build().load();
		expect(m.loadURL).toHaveBeenCalledWith("file:///tmp/nylas-print/print.html");
	});
});

describe("printer", () => {
	beforeEach(() => { vi.clearAllMocks(); m.browserOptions.length = 0; document.body.innerHTML = "<nylas-styles><style>.x{}</style></nylas-styles>"; });

	it("subscribes to the print action when constructed", () => {
		new Printer();
		expect(m.listen).toHaveBeenCalledWith(expect.any(Function));
	});

	it("rejects a missing active thread", () => {
		expect(() => new Printer()._printThread(null, "")).toThrow("No thread active");
	});

	it("passes normalized thread data to the print window", () => {
		m.accountForId.mockReturnValue({ name: "Ada", emailAddress: "ada@example.com" });
		const thread = { accountId: "a1", subject: "Subject", participants: [{ email: "g@x" }] };
		new Printer()._printThread(thread, "<main>thread</main>");
		const html = m.writeFileSync.mock.calls[0][1];
		expect(html).toContain("Subject"); expect(html).toContain("Ada &lt;ada@example.com&gt;"); expect(html).toContain("<main>thread</main>");
		expect(m.loadURL).toHaveBeenCalledOnce();
	});

	it("serializes each message iframe document", () => {
		m.accountForId.mockReturnValue({ name: "Ada", emailAddress: "a@x" });
		const iframe = document.createElement("iframe"); document.body.appendChild(iframe);
		iframe.contentDocument.documentElement.innerHTML = "<head></head><body>Mail</body>";
		new Printer()._printThread({ accountId: "a", subject: "S", participants: [] }, "");
		expect(m.writeFileSync.mock.calls[0][1]).toContain("Mail");
	});

	it("unsubscribes on deactivate", () => {
		const unsubscribe = vi.fn(); m.listen.mockReturnValueOnce(unsubscribe);
		new Printer().deactivate();
		expect(unsubscribe).toHaveBeenCalledOnce();
	});
});
