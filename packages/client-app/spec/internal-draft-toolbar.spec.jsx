import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("nylas-component-kit", () => ({
	RetinaImg: Object.assign(({ name }) => <span data-testid="retina-img">{name}</span>, { Mode: { ContentIsMask: "mask" } }),
}));

import { DraftDeleteButton } from "../internal_packages/draft-list/lib/draft-toolbar-buttons.jsx";

describe("draft toolbar delete button", () => {
	afterEach(() => { cleanup(); delete globalThis.Actions; });

	it("renders an accessible delete button and trash icon", () => {
		render(<DraftDeleteButton selection={{ items: () => [], clear: vi.fn() }} />);
		expect(screen.getByTitle("Delete")).toBeTruthy();
		expect(screen.getByText("icon-composer-trash.png")).toBeTruthy();
	});

	it("destroys every selected draft and clears the selection", () => {
		globalThis.Actions = { destroyDraft: vi.fn() };
		const selection = { items: () => [{ clientId: "one" }, { clientId: "two" }], clear: vi.fn() };
		render(<DraftDeleteButton selection={selection} />);
		fireEvent.click(screen.getByTitle("Delete"));
		expect(globalThis.Actions.destroyDraft.mock.calls).toEqual([["one"], ["two"]]);
		expect(selection.clear).toHaveBeenCalledOnce();
	});

	it("still clears an empty selection", () => {
		globalThis.Actions = { destroyDraft: vi.fn() };
		const selection = { items: () => [], clear: vi.fn() };
		render(<DraftDeleteButton selection={selection} />);
		fireEvent.click(screen.getByTitle("Delete"));
		expect(globalThis.Actions.destroyDraft).not.toHaveBeenCalled();
		expect(selection.clear).toHaveBeenCalledOnce();
	});
});
