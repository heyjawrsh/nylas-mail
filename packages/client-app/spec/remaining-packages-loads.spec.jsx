// The five packages that failed to load in the main window: the `request`
// users now use fetch (same URLs, query strings, User-Agent and body
// parsing, and the same callback or error path), phishing-detection uses
// tldts, and account-sidebar's createRequire is guarded for the CommonJS
// compile cache. Modules load through the package loader, which compiles them
// to CommonJS the way the compile cache does.
import path from "node:path";
import { render } from "@testing-library/react";
import PropTypes from "prop-types";
import React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import underscore from "underscore";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createPackageLoader } from "./helpers/load-package-module.js";

const pkg = (rel) => path.join(__dirname, "..", "internal_packages", rel);
const base = { react: React, "react/jsx-runtime": jsxRuntime, "prop-types": PropTypes, underscore };

// A fetch Response stand-in.
const response = (status, text) => ({ status, ok: status >= 200 && status < 300, text: async () => text });

let fetchMock;
beforeEach(() => {
	fetchMock = vi.fn();
	vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
	vi.unstubAllGlobals();
});

// Calls a callback-style API and resolves with the callback's arguments.
const callbackArgs = (call) => new Promise((resolve) => call((...args) => resolve(args)));

describe("keybase's API client", () => {
	const loadKeybase = () => createPackageLoader({ ...base })(pkg("keybase/lib/keybase.js"));
	const userAgent = (call) => fetchMock.mock.calls[call][1].headers["User-Agent"];

	it("loads without `request`", () => {
		expect(typeof loadKeybase().getKey).toBe("function");
	});

	it("getKey hands over the armored key, with the same URL and User-Agent", async () => {
		const key = "-----BEGIN PGP PUBLIC KEY BLOCK-----\nabc";
		fetchMock.mockResolvedValue(response(200, key));
		const [err, body] = await callbackArgs((cb) => loadKeybase().getKey("alice", cb));
		expect(fetchMock.mock.calls[0][0]).toBe("https://keybase.io/alice/key.asc");
		expect(userAgent(0)).toBe("request");
		expect(err).toBeNull();
		expect(body).toBe(key);
	});

	it("getKey reports a body that isn't a key, as for a 404 page", async () => {
		fetchMock.mockResolvedValue(response(404, "<html>Not found</html>"));
		const [err, body] = await callbackArgs((cb) => loadKeybase().getKey("nobody", cb));
		expect(err.message).toBe("No key returned from keybase for nobody");
		expect(body).toBeNull();
	});

	it("getKey hands a network failure to the callback", async () => {
		fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
		const [err, body] = await callbackArgs((cb) => loadKeybase().getKey("alice", cb));
		expect(err.message).toBe("Failed to fetch");
		expect(body).toBeNull();
	});

	it("getUser parses the JSON lookup", async () => {
		const them = [{ basics: { username: "alice" }, proofs_summary: { all: [] }, profile: { full_name: "Alice" } }];
		fetchMock.mockResolvedValue(response(200, JSON.stringify({ status: { name: "OK" }, them })));
		const [err, users] = await callbackArgs((cb) => loadKeybase().getUser("ABCD", "key_fingerprint", cb));
		expect(fetchMock.mock.calls[0][0]).toBe("https://keybase.io/_/api/1.0/user/lookup.json?key_fingerprint=ABCD");
		expect(userAgent(0)).toBe("request");
		expect(err).toBeNull();
		expect(users[0].components.username.val).toBe("alice");
	});

	it("getUser reports a non-OK status from a non-2xx JSON body", async () => {
		fetchMock.mockResolvedValue(
			response(404, JSON.stringify({ status: { name: "NOT_FOUND", desc: "user not found" }, them: [] })),
		);
		const [err] = await callbackArgs((cb) => loadKeybase().getUser("ZZZZ", "key_fingerprint", cb));
		expect(err.message).toBe("user not found");
	});

	it("getUser reports an empty body", async () => {
		fetchMock.mockResolvedValue(response(502, ""));
		const [err] = await callbackArgs((cb) => loadKeybase().getUser("ZZZZ", "key_fingerprint", cb));
		expect(err.message).toBe("Empty response!");
	});

	it("autocomplete sends q in the query string and hands over the completions", async () => {
		fetchMock.mockResolvedValue(response(200, JSON.stringify({ status: { name: "OK" }, completions: [1, 2] })));
		const [err, completions] = await callbackArgs((cb) => loadKeybase().autocomplete("ali ce", cb));
		expect(fetchMock.mock.calls[0][0]).toBe("https://keybase.io/_/api/1.0/user/autocomplete.json?q=ali+ce");
		expect(err).toBeNull();
		expect(completions).toEqual([1, 2]);
	});
});

describe("github-contact-card's store", () => {
	const loadStore = () => {
		class NylasStore {
			listenTo() {}
			trigger() {}
		}
		return createPackageLoader({
			...base,
			"nylas-store": { default: NylasStore },
			"nylas-exports": { FocusedContactsStore: {} },
		})(pkg("github-contact-card/lib/github-user-store.js")).default;
	};

	it("searches for the user, then their repos, with the User-Agent GitHub needs", async () => {
		const store = loadStore();
		fetchMock
			.mockResolvedValueOnce(response(200, JSON.stringify({ items: [{ login: "ada" }] })))
			.mockResolvedValueOnce(
				response(200, JSON.stringify({ items: [{ stargazers_count: 1 }, { stargazers_count: 5 }] })),
			);
		store._githubFetchProfile("ada@fixture.test");
		await vi.waitFor(() => expect(store.profileForFocusedContact()?.repos?.length).toBe(2));
		expect(fetchMock.mock.calls[0][0]).toBe("https://api.github.com/search/users?q=ada@fixture.test");
		expect(fetchMock.mock.calls[0][1].headers["User-Agent"]).toBe("request");
		expect(fetchMock.mock.calls[1][0]).toBe(
			"https://api.github.com/search/repositories?q=user:ada&sort=stars&order=desc",
		);
		expect(store.profileForFocusedContact().repos.map((r) => r.stargazers_count)).toEqual([5, 1]);
		expect(store.loading()).toBe(false);
	});

	it("caches no profile for a rate-limit body, as before", async () => {
		const store = loadStore();
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		fetchMock.mockResolvedValue(response(403, JSON.stringify({ message: "API rate limit exceeded" })));
		store._githubFetchProfile("ada@fixture.test");
		await vi.waitFor(() => expect(store.loading()).toBe(false));
		expect(warn).toHaveBeenCalledWith("API rate limit exceeded");
		expect(store.profileForFocusedContact()).toBe(false);
		warn.mockRestore();
	});

	it("stops on a network failure without an unhandled rejection", async () => {
		const store = loadStore();
		fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
		const callback = vi.fn();
		await store._githubRequest("https://api.github.com/search/users?q=x", callback);
		expect(callback).toHaveBeenCalledWith(expect.objectContaining({ message: "Failed to fetch" }));
	});
});

describe("composer-translate", () => {
	let TranslateButton;
	let showErrorBox;
	let session;

	beforeEach(() => {
		showErrorBox = vi.fn();
		session = { changes: { add: vi.fn(), commit: vi.fn() } };
		createPackageLoader({
			...base,
			"@electron/remote": { dialog: { showErrorBox } },
			"nylas-exports": {
				React,
				Actions: { closePopover: vi.fn(), recordUserEvent: vi.fn(), openPopover: vi.fn() },
				ComponentRegistry: {
					register: (component) => {
						TranslateButton = component;
					},
				},
				QuotedHTMLTransformer: {
					removeQuotedHTML: (html) => html.replace(" [quoted]", ""),
					appendQuotedHTML: (text, html) => `${text}${html.includes("[quoted]") ? " [quoted]" : ""}`,
				},
			},
			"nylas-component-kit": { Menu: () => null, RetinaImg: Object.assign(() => null, { Mode: {} }) },
		})(pkg("composer-translate/lib/main.jsx")).activate();
	});

	const translate = (body) => {
		const ref = React.createRef();
		render(<TranslateButton ref={ref} draft={{ body }} session={session} />);
		ref.current._onTranslate("Spanish");
	};

	it("sends the Yandex query encoded as `qs` did, and saves the translation", async () => {
		fetchMock.mockResolvedValue(response(200, JSON.stringify({ text: ["<p>Hola", " (amigo)</p>"] })));
		translate("<p>Hi (friend)!</p> [quoted]");
		await vi.waitFor(() => expect(session.changes.commit).toHaveBeenCalled());
		const url = new URL(fetchMock.mock.calls[0][0]);
		expect(`${url.origin}${url.pathname}`).toBe("https://translate.yandex.net/api/v1.5/tr.json/translate");
		expect(url.search).toContain("&lang=es&text=%3Cp%3EHi%20%28friend%29%21%3C%2Fp%3E&format=html");
		expect(url.searchParams.get("text")).toBe("<p>Hi (friend)!</p>");
		expect(session.changes.add).toHaveBeenCalledWith({ body: "<p>Hola (amigo)</p> [quoted]" });
		expect(showErrorBox).not.toHaveBeenCalled();
	});

	it("shows the error dialog for a status other than 200", async () => {
		fetchMock.mockResolvedValue(response(403, "{}"));
		translate("<p>Hi</p>");
		await vi.waitFor(() => expect(showErrorBox).toHaveBeenCalledWith("Language Conversion Failed", "Error: HTTP 403"));
		expect(session.changes.add).not.toHaveBeenCalled();
	});

	it("shows the error dialog for a network failure", async () => {
		fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
		translate("<p>Hi</p>");
		await vi.waitFor(() =>
			expect(showErrorBox).toHaveBeenCalledWith("Language Conversion Failed", "TypeError: Failed to fetch"),
		);
	});
});

describe("phishing-detection", () => {
	const renderIndicator = (message) => {
		let PhishingIndicator;
		createPackageLoader({
			...base,
			"nylas-exports": {
				React,
				ComponentRegistry: {
					register: (component) => {
						PhishingIndicator = component;
					},
				},
				MessageStore: { items: () => [message], listen: () => () => {} },
			},
		})(pkg("phishing-detection/lib/main.jsx")).activate();
		return render(<PhishingIndicator />).container;
	};
	const message = (from, replyTo) => ({ from: [{ email: from }], replyTo: [{ email: replyTo }] });

	it("warns when the registered domains differ", () => {
		const container = renderIndicator(message("a@paypal.com", "b@paypal-secure.net"));
		expect(container.querySelector(".phishingIndicator").textContent).toContain("replies will go to b@paypal-secure.net");
	});

	it("doesn't warn for a subdomain of the same registered domain", () => {
		const container = renderIndicator(message("a@paypal.com", "b@mail.PayPal.com"));
		expect(container.querySelector(".phishingIndicator")).toBeNull();
	});

	it("doesn't warn or throw for an empty or invalid domain", () => {
		for (const [from, replyTo] of [
			["a@paypal.com", "b@"],
			["a@paypal.com", "b"],
			["a@localhost", "b@paypal.com"],
			["a@paypal.com", "b@not a host"],
		]) {
			const container = renderIndicator(message(from, replyTo));
			expect(container.querySelector(".phishingIndicator")).toBeNull();
		}
	});
});

describe("account-sidebar's SidebarItem", () => {
	it("loads as CommonJS, where import.meta.url is undefined, and reads the snooze constants", () => {
		const perspective = { isInbox: () => false, isEqual: () => false, name: null, iconName: "x" };
		const MailboxPerspective = { forCategories: vi.fn(() => perspective) };
		const load = createPackageLoader({
			...base,
			"underscore.string": {},
			"nylas-exports": {
				WorkspaceStore: { rootSheet: () => "threads", Sheet: { Threads: "threads", Drafts: "drafts" } },
				MailboxPerspective,
				FocusedPerspectiveStore: { current: () => perspective },
				CategoryStore: { categories: () => [{ displayName: "N1-Snoozed", id: "c1" }] },
				Actions: {},
				RegExpUtils: {},
			},
			"nylas-component-kit": { OutlineViewItem: { CounterStyles: {} } },
			"./sidebar-actions.js": { default: {} },
		});
		const SidebarItem = load(pkg("account-sidebar/lib/sidebar-item.js")).default;
		const savedState = NylasEnv.savedState;
		NylasEnv.savedState = { sidebarKeysCollapsed: {} };
		let item;
		try {
			item = SidebarItem.forSnoozed(["a1"]);
		} finally {
			NylasEnv.savedState = savedState;
		}
		expect(MailboxPerspective.forCategories).toHaveBeenCalledWith([{ displayName: "N1-Snoozed", id: "c1" }]);
		expect(item.id).toBe("N1-Snoozed");
		expect(item.name).toBe("Snoozed");
		expect(item.iconName).toBe("snooze.png");
	});
});
