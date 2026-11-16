import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { expect, test } from "@playwright/test";

import { evaluate, launchApp, waitForWindowType } from "./app.mjs";
import { WINDOWS } from "./windows.mjs";

const require = createRequire(import.meta.url);
const { LAYERS } = require("../src/appearance/layers.js");

for (const spec of WINDOWS) {
	test.describe(`${spec.type} look runtime`, () => {
		let run;
		let page;

		test.beforeAll(async () => {
			run = await launchApp({ seeded: spec.seeded !== false });
			try {
				page = await spec.open(run);
			} catch (err) {
				err.message += `\n--- app log (tail) ---\n${run.log().slice(-4000)}`;
				throw err;
			}
		});

		test.afterAll(async () => {
			await run?.close();
		});

		test("loads the kernel first with the full resolved Classic look", async () => {
			const tokens = JSON.parse(
				readFileSync(
					new URL("../static/themes/classic.tokens.json", import.meta.url),
					"utf8",
				),
			);
			const variant = await run.app.evaluate(({ nativeTheme }) =>
				nativeTheme.shouldUseDarkColors ? "dark" : "light",
			);
			const surface = tokens[variant].surface.app.$value.hex;
			const readingSize =
				tokens[variant].type["body-reading"].size.$value.value;
			const state = await evaluate(page, () => {
				const kernel = document.styleSheets[0];
				const rule = kernel?.cssRules[0];
				const root = document.documentElement;
				const messageList = document.querySelector("#message-list");
				const el = document.createElement("span");
				el.style.fontSize = "var(--type-body-reading-size)";
				document.body.appendChild(el);
				const fontSize = getComputedStyle(el).fontSize;
				el.remove();
				const styles = Array.from(
					// The print window has no <nylas-styles>; its copied sheets sit in <head>.
					document.querySelectorAll(
						document.querySelector("nylas-styles")
							? "nylas-styles style"
							: "head style:not(#nylas-kernel)",
					),
				).filter(
					(style) =>
						!style.getAttribute("source-path")?.includes("email-frame"),
				);
				return {
					kernelId: kernel?.ownerNode.id,
					isLayerStatement: rule instanceof CSSLayerStatementRule,
					layers: Array.from(rule?.nameList || []),
					attributes: Object.fromEntries(
						Array.from(root.attributes)
							.filter(
								({ name }) =>
									name.startsWith("data-") && name !== "data-reflow",
							)
							.map(({ name, value }) => [name, value]),
					),
					surface: getComputedStyle(root)
						.getPropertyValue("--surface-app")
						.trim(),
					fontSize,
					cardShadow: getComputedStyle(root)
						.getPropertyValue("--shadow-card")
						.trim(),
					messageBackground: messageList
						? getComputedStyle(messageList).backgroundColor
						: null,
					styleCount: styles.length,
					unlayered: styles
						.filter(
							(style) =>
								!/^\s*@(layer|import|charset)\b/.test(style.textContent),
						)
						.map((style) => style.getAttribute("source-path")),
				};
			});

			expect(state.kernelId).toBe("nylas-kernel");
			expect(state.isLayerStatement).toBe(true);
			expect(state.layers).toEqual(LAYERS);
			expect(state.attributes).toEqual({
				"data-look": "",
				"data-theme": "classic",
				"data-variant": variant,
				"data-style": "classic",
				"data-density": "comfortable",
				"data-text-size": "100",
				"data-font": "theme",
			});
			expect(state.surface).toBe(surface);
			expect(state.fontSize).toMatch(/^\d+(?:\.\d+)?px$/);
			expect(state.fontSize).toBe(`${readingSize}px`);
			expect(state.cardShadow).not.toBe("");
			expect(state.styleCount).toBeGreaterThan(0);
			expect(state.unlayered).toEqual([]);

			if (spec.type === "thread-popout") {
				const hex = surface.slice(1);
				const expanded =
					hex.length === 3
						? Array.from(hex, (digit) => digit.repeat(2)).join("")
						: hex;
				const rgb = [0, 2, 4].map((offset) =>
					Number.parseInt(expanded.slice(offset, offset + 2), 16),
				);
				expect(state.messageBackground).toBe(`rgb(${rgb.join(", ")})`);
			}
		});

		if (spec.type === "default") {
			test("prepares the hot window before population and serves a revisioned library", async () => {
				const hot = await waitForWindowType(run, "emptyWindow", {
					ready: () =>
						!!NylasEnv.lookRuntime &&
						!!document.documentElement.getAttribute("data-theme"),
				});
				const variant = await run.app.evaluate(({ nativeTheme }) =>
					nativeTheme.shouldUseDarkColors ? "dark" : "light",
				);
				const state = await evaluate(hot, async () => {
					const root = document.documentElement;
					return {
						attributes: Object.fromEntries(
							Array.from(root.attributes)
								.filter(
									({ name }) =>
										name.startsWith("data-") && name !== "data-reflow",
								)
								.map(({ name, value }) => [name, value]),
						),
						library:
							await require("electron").ipcRenderer.invoke("get-theme-library"),
					};
				});
				expect(state.attributes).toEqual({
					"data-look": "",
					"data-theme": "classic",
					"data-variant": variant,
					"data-style": "classic",
					"data-density": "comfortable",
					"data-text-size": "100",
					"data-font": "theme",
				});
				expect(state.library.revision).toBeGreaterThanOrEqual(0);
				expect(state.library.themesFolder).toMatchObject({
					exists: expect.any(Boolean),
					writable: expect.any(Boolean),
				});
				expect(state.library.descriptors).toContainEqual(
					expect.objectContaining({
						id: "classic",
						status: "ok",
						css: expect.stringContaining("--surface-app"),
						revision: expect.any(Number),
					}),
				);
			});

			test("commits one appearance key across main, composer and thread windows", async () => {
				const composer = await WINDOWS.find(
					({ type }) => type === "composer",
				).open(run);
				const thread = await WINDOWS.find(
					({ type }) => type === "thread-popout",
				).open(run);
				const pages = [page, composer, thread];
				const tokens = JSON.parse(
					readFileSync(
						new URL("../static/themes/classic.tokens.json", import.meta.url),
						"utf8",
					),
				);
				const originalMode = await evaluate(page, () =>
					NylasEnv.config.get("core.appearance.mode"),
				);
				const readUnchanged = (window) =>
					evaluate(window, () => {
						const { mode: _mode, ...appearance } =
							NylasEnv.config.get("core.appearance") || {};
						return { themes: NylasEnv.config.get("core.themes"), appearance };
					});
				const before = await Promise.all(pages.map(readUnchanged));
				try {
					await evaluate(page, () =>
						NylasEnv.config.set("core.appearance.mode", "light"),
					);
					for (const window of pages) {
						await expect
							.poll(() =>
								evaluate(window, () =>
									document.documentElement.getAttribute("data-variant"),
								),
							)
							.toBe("light");
					}
					await evaluate(page, () =>
						NylasEnv.config.set("core.appearance.mode", "dark"),
					);
					for (const [index, window] of pages.entries()) {
						await expect
							.poll(() =>
								evaluate(window, () => ({
									variant:
										document.documentElement.getAttribute("data-variant"),
									surface: getComputedStyle(document.documentElement)
										.getPropertyValue("--surface-app")
										.trim(),
								})),
							)
							.toEqual({
								variant: "dark",
								surface: tokens.dark.surface.app.$value.hex,
							});
						expect(await readUnchanged(window)).toEqual(before[index]);
					}
				} finally {
					await evaluate(
						page,
						(mode) => NylasEnv.config.set("core.appearance.mode", mode),
						originalMode,
					);
				}
			});
		}
	});
}
