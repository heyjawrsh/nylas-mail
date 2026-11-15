import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const m = vi.hoisted(() => ({
	abortFetchFile: vi.fn(),
	fetchAndOpenFile: vi.fn(),
	fetchAndSaveFile: vi.fn(),
	pathForFile: vi.fn((file) => `/downloads/${file.id}`),
	removeFile: vi.fn(),
	shouldDisplayAsImage: vi.fn((file) => file.contentType.startsWith("image/")),
}));

vi.mock("nylas-exports", () => {
	const Actions = {
		abortFetchFile: m.abortFetchFile,
		fetchAndOpenFile: m.fetchAndOpenFile,
		fetchAndSaveFile: m.fetchAndSaveFile,
		removeFile: m.removeFile,
	};
	const exports = {
		Actions,
		FileDownloadStore: { pathForFile: m.pathForFile },
		Utils: { shouldDisplayAsImage: m.shouldDisplayAsImage },
	};
	return { default: exports, ...exports };
});

vi.mock("nylas-component-kit", () => {
	const item = (kind) => (props) => (
		<div data-testid={`${kind}-${props.displayName}`}>
			<span>{props.displaySize}</span>
			<span>{props.fileIconName}</span>
			<span>{props.filePreviewPath || "no-preview"}</span>
			<button title={`open-${props.displayName}`} onClick={props.onOpenAttachment} />
			<button title={`download-${props.displayName}`} onClick={props.onDownloadAttachment} />
			<button title={`abort-${props.displayName}`} onClick={props.onAbortDownload} />
			{props.onRemoveAttachment && <button title={`remove-${props.displayName}`} onClick={props.onRemoveAttachment} />}
		</div>
	);
	return {
		default: {},
		AttachmentItem: item("file"),
		ImageAttachmentItem: item("image"),
	};
});

import MessageAttachments from "../internal_packages/attachments/lib/message-attachments";

const file = (id, contentType = "application/pdf") => ({
	id,
	contentType,
	displayExtension: () => (contentType === "application/pdf" ? "pdf" : "png"),
	displayFileSize: () => `${id.length} KB`,
	displayName: () => `${id}.file`,
});

beforeEach(() => {
	vi.clearAllMocks();
	globalThis.NylasEnv = { config: { get: vi.fn(() => true) } };
});

afterEach(cleanup);

describe("MessageAttachments", () => {
	it("renders non-images with AttachmentItem and images with ImageAttachmentItem", () => {
		render(<MessageAttachments files={[file("doc"), file("photo", "image/png")]} />);
		expect(screen.getByTestId("file-doc.file")).toBeDefined();
		expect(screen.getByTestId("image-photo.file")).toBeDefined();
	});

	it("passes derived display values to an attachment item", () => {
		render(<MessageAttachments files={[file("doc")]} />);
		expect(screen.getByText("3 KB")).toBeDefined();
		expect(screen.getByText("file-pdf.png")).toBeDefined();
		expect(m.pathForFile).toHaveBeenCalledWith(expect.objectContaining({ id: "doc" }));
	});

	it("passes a preview path when previews are enabled", () => {
		render(<MessageAttachments files={[file("doc")]} filePreviewPaths={{ doc: "/tmp/doc.png" }} />);
		expect(screen.getByText("/tmp/doc.png")).toBeDefined();
	});

	it("suppresses preview paths when the preference is disabled", () => {
		NylasEnv.config.get.mockReturnValue(false);
		render(<MessageAttachments files={[file("doc")]} filePreviewPaths={{ doc: "/tmp/doc.png" }} />);
		expect(screen.getByText("no-preview")).toBeDefined();
	});

	it("opens, downloads, and aborts the selected file", () => {
		const doc = file("doc");
		render(<MessageAttachments files={[doc]} />);
		fireEvent.click(screen.getByTitle("open-doc.file"));
		fireEvent.click(screen.getByTitle("download-doc.file"));
		fireEvent.click(screen.getByTitle("abort-doc.file"));
		expect(m.fetchAndOpenFile).toHaveBeenCalledWith(doc);
		expect(m.fetchAndSaveFile).toHaveBeenCalledWith(doc);
		expect(m.abortFetchFile).toHaveBeenCalledWith(doc);
	});

	it("only exposes removal when allowed and includes the message id", () => {
		const doc = file("doc");
		const { rerender } = render(<MessageAttachments files={[doc]} messageClientId="m1" />);
		expect(screen.queryByTitle("remove-doc.file")).toBeNull();
		rerender(<MessageAttachments files={[doc]} messageClientId="m1" canRemoveAttachments />);
		fireEvent.click(screen.getByTitle("remove-doc.file"));
		expect(m.removeFile).toHaveBeenCalledWith({ file: doc, messageClientId: "m1" });
	});
});
