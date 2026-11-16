import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { expect, test } from "@playwright/test";

import { evaluate, launchApp } from "./app.mjs";
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

		test("loads the kernel first and applies Classic light tokens", async () => {
			const tokens = JSON.parse(
				readFileSync(
					new URL("../static/themes/classic.tokens.json", import.meta.url),
					"utf8",
				),
			);
			const surface = tokens.light.surface.app.$value.hex;
			const state = await evaluate(page, () => {
				const kernel = document.styleSheets[0];
				const rule = kernel?.cssRules[0];
				const root = document.documentElement;
				const messageList = document.querySelector("#message-list");
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
					look: root.getAttribute("data-look"),
					theme: root.getAttribute("data-theme"),
					variant: root.getAttribute("data-variant"),
					surface: getComputedStyle(root)
						.getPropertyValue("--surface-app")
						.trim(),
					readingSize: getComputedStyle(root)
						.getPropertyValue("--type-body-reading-size")
						.trim(),
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
			expect(state.look).toBe("");
			expect(state.theme).toBe("classic");
			expect(state.variant).toBe("light");
			expect(state.surface).toBe(surface);
			expect(state.readingSize.startsWith("calc(")).toBe(true);
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
	});
}
