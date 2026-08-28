import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const m = vi.hoisted(() => ({
	abortFetchFile: vi.fn(),
	fetchAndOpenFile: vi.fn(),
	fetchAndSaveFile: vi.fn(),
	openPopover: vi.fn(),
	pathForFile: vi.fn((file) => `/downloads/${file.id}`),
	removeFile: vi.fn(),
	shouldDisplayAsImage: vi.fn((file) => file.contentType.startsWith("image/")),
}));

vi.mock("nylas-exports", async () => {
	const { default: MockReact } = await import("react");
	class ComposerExtension {}
	class MessageViewExtension {}
	const Actions = {
		abortFetchFile: m.abortFetchFile,
		fetchAndOpenFile: m.fetchAndOpenFile,
		fetchAndSaveFile: m.fetchAndSaveFile,
		openPopover: m.openPopover,
		removeFile: m.removeFile,
	};
	const exports = {
		Actions,
		ComposerExtension,
		FileDownloadStore: { pathForFile: m.pathForFile },
		MessageViewExtension,
		React: MockReact,
		ReactDOM: {},
		RegExpUtils: { urlRegex: () => /^https?:\/\// },
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
	const RetinaImg = (props) => <img alt="tracking" className={props.className} />;
	RetinaImg.Mode = { ContentIsMask: "mask" };
	return {
		default: {},
		AttachmentItem: item("file"),
		ImageAttachmentItem: item("image"),
		RetinaImg,
	};
});

vi.mock("../internal_packages/link-tracking/lib/link-tracking-constants", () => ({
	PLUGIN_ID: "link-tracking",
	PLUGIN_URL: "https://track.test",
}));
vi.mock("../internal_packages/open-tracking/lib/open-tracking-constants", () => ({
	PLUGIN_ID: "open-tracking",
	PLUGIN_URL: "https://track.test",
}));
vi.mock("../internal_packages/link-tracking/lib/link-tracking-message-popover", () => ({
	default: () => <div>link popover</div>,
}));
vi.mock("../internal_packages/open-tracking/lib/open-tracking-message-popover", () => ({
	default: () => <div>open popover</div>,
}));

import MessageAttachments from "../internal_packages/attachments/lib/message-attachments";
import LinkTrackingComposerExtension from "../internal_packages/link-tracking/lib/link-tracking-composer-extension";
import LinkTrackingMessageExtension from "../internal_packages/link-tracking/lib/link-tracking-message-extension";
import OpenTrackingComposerExtension from "../internal_packages/open-tracking/lib/open-tracking-composer-extension";
import OpenTrackingIcon from "../internal_packages/open-tracking/lib/open-tracking-icon";
import OpenTrackingMessageStatus from "../internal_packages/open-tracking/lib/open-tracking-message-status";

const file = (id, contentType = "application/pdf") => ({
	id,
	contentType,
	displayExtension: () => (contentType === "application/pdf" ? "pdf" : "png"),
	displayFileSize: () => `${id.length} KB`,
	displayName: () => `${id}.file`,
});

const draft = (clientId, metadata) => ({
	clientId,
	metadataForPluginId: vi.fn(() => metadata),
	applyPluginMetadata: vi.fn(),
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

describe("LinkTrackingComposerExtension", () => {
	it("does nothing when link-tracking metadata is absent", () => {
		const root = document.createElement("div");
		root.innerHTML = '<a href="https://example.com">Example</a>';
		const model = draft("m1", null);
		LinkTrackingComposerExtension.applyTransformsForSending({ draftBodyRootNode: root, draft: model });
		expect(root.querySelector("a").href).toBe("https://example.com/");
		expect(model.applyPluginMetadata).not.toHaveBeenCalled();
	});

	it("rewrites valid links and records their metadata", () => {
		const root = document.createElement("div");
		root.innerHTML = '<a href="https://example.com/a?x=1&y=2">Example</a>';
		const metadata = { tracked: true };
		const model = draft("draft-7", metadata);
		LinkTrackingComposerExtension.applyTransformsForSending({ draftBodyRootNode: root, draft: model });
		expect(root.querySelector("a").getAttribute("href")).toBe("https://track.test/link/MESSAGE_ID/0?redirect=https%3A%2F%2Fexample.com%2Fa%3Fx%3D1%26y%3D2");
		expect(metadata).toMatchObject({ uid: "draft-7", links: [{ url: "https://example.com/a?x=1&y=2", click_count: 0, click_data: [] }] });
		expect(model.applyPluginMetadata).toHaveBeenCalledWith("link-tracking", metadata);
	});

	it("numbers tracked links and skips non-web hrefs", () => {
		const root = document.createElement("div");
		root.innerHTML = '<a href="mailto:a@example.com">Mail</a><a href="http://one.test">One</a><a href="https://two.test">Two</a>';
		const metadata = {};
		LinkTrackingComposerExtension.applyTransformsForSending({ draftBodyRootNode: root, draft: draft("m", metadata) });
		expect(metadata.links.map((link) => link.redirect_url)).toEqual([
			"https://track.test/link/MESSAGE_ID/0?redirect=http%3A%2F%2Fone.test",
			"https://track.test/link/MESSAGE_ID/1?redirect=https%3A%2F%2Ftwo.test",
		]);
	});

	it("does not rewrite links inside quoted Gmail content", () => {
		const root = document.createElement("div");
		root.innerHTML = '<a href="https://new.test">New</a><div class="gmail_quote"><a href="https://old.test">Old</a></div>';
		const metadata = {};
		LinkTrackingComposerExtension.applyTransformsForSending({ draftBodyRootNode: root, draft: draft("m", metadata) });
		expect(metadata.links).toHaveLength(1);
		expect(root.querySelector(".gmail_quote a").getAttribute("href")).toBe("https://old.test");
	});

	it("restores encoded redirect URLs", () => {
		const root = document.createElement("div");
		root.innerHTML = '<a href="https://track.test/link/MESSAGE_ID/0?redirect=https%3A%2F%2Fexample.com%2Fa%3Fx%3D1">Tracked</a>';
		LinkTrackingComposerExtension.unapplyTransformsForSending({ draftBodyRootNode: root });
		expect(root.querySelector("a").getAttribute("href")).toBe("https://example.com/a?x=1");
	});

	it("leaves unrelated links unchanged while restoring", () => {
		const root = document.createElement("div");
		root.innerHTML = '<a href="https://example.com">Plain</a>';
		LinkTrackingComposerExtension.unapplyTransformsForSending({ draftBodyRootNode: root });
		expect(root.querySelector("a").getAttribute("href")).toBe("https://example.com");
	});
});

describe("LinkTrackingMessageExtension", () => {
	const decorate = (link, bodyHref = link.redirect_url) => {
		const messageDocument = document.implementation.createHTMLDocument();
		messageDocument.body.innerHTML = `<p><a href="${bodyHref}">Read</a></p>`;
		const message = { metadataForPluginId: vi.fn(() => ({ links: [link] })) };
		const iframe = { getBoundingClientRect: () => ({ top: 20, left: 30 }) };
		LinkTrackingMessageExtension.renderedMessageBodyIntoDocument({ document: messageDocument, message, iframe });
		return { anchor: messageDocument.querySelector("a"), dot: messageDocument.querySelector("img"), message };
	};

	it("does not decorate messages without tracked links", () => {
		const messageDocument = document.implementation.createHTMLDocument();
		messageDocument.body.innerHTML = '<a href="https://example.com">Read</a>';
		LinkTrackingMessageExtension.renderedMessageBodyIntoDocument({ document: messageDocument, message: { metadataForPluginId: () => null }, iframe: {} });
		expect(messageDocument.querySelector("img")).toBeNull();
	});

	it("restores the original href and adds an unvisited status dot", () => {
		const link = { url: "https://example.com", redirect_url: "https://track.test/r", click_count: 0 };
		const { anchor, dot } = decorate(link);
		expect(anchor.getAttribute("href")).toBe("https://example.com");
		expect(anchor.title).toBe("https://example.com");
		expect(dot.title).toBe("This link has not been clicked (https://example.com)");
		expect(dot.src).toContain("ic-tracking-unvisited@2x.png");
	});

	it("matches already-restored original URLs too", () => {
		const link = { url: "https://example.com", redirect_url: "https://track.test/r", click_count: 0 };
		expect(decorate(link, link.url).dot).not.toBeNull();
	});

	it("pluralizes visited click counts", () => {
		const link = { url: "https://example.com", redirect_url: "https://track.test/r", click_count: 2 };
		const { dot } = decorate(link);
		expect(dot.title).toBe("2 clicks (https://example.com)");
		expect(dot.src).toContain("ic-tracking-visited@2x.png");
	});
});

describe("OpenTrackingComposerExtension", () => {
	it("does not inject a pixel without metadata", () => {
		const root = document.createElement("div");
		OpenTrackingComposerExtension.applyTransformsForSending({ draftBodyRootNode: root, draft: draft("m", null) });
		expect(root.querySelector(".n1-open")).toBeNull();
	});

	it("appends a zero-sized placeholder pixel and saves the draft uid", () => {
		const root = document.createElement("div");
		const metadata = { open_count: 0 };
		const model = draft("draft-9", metadata);
		OpenTrackingComposerExtension.applyTransformsForSending({ draftBodyRootNode: root, draft: model });
		const pixel = root.querySelector(".n1-open");
		expect(pixel.getAttribute("data-open-tracking-src")).toBe("https://track.test/open/MESSAGE_ID");
		expect(pixel.getAttribute("src")).toBeNull();
		expect(metadata.uid).toBe("draft-9");
		expect(model.applyPluginMetadata).toHaveBeenCalledWith("open-tracking", metadata);
	});

	it("inserts the pixel immediately before quoted content", () => {
		const root = document.createElement("div");
		root.innerHTML = '<p>New</p><blockquote class="gmail_quote">Old</blockquote>';
		OpenTrackingComposerExtension.applyTransformsForSending({ draftBodyRootNode: root, draft: draft("m", {}) });
		expect(root.children[1].className).toBe("n1-open");
		expect(root.children[2].className).toBe("gmail_quote");
	});

	it("removes an injected pixel", () => {
		const root = document.createElement("div");
		root.innerHTML = '<p>Body</p><img class="n1-open">';
		OpenTrackingComposerExtension.unapplyTransformsForSending({ draftBodyRootNode: root });
		expect(root.querySelector(".n1-open")).toBeNull();
		expect(root.textContent).toBe("Body");
	});

	it("tolerates unapply when no pixel exists", () => {
		const root = document.createElement("div");
		expect(() => OpenTrackingComposerExtension.unapplyTransformsForSending({ draftBodyRootNode: root })).not.toThrow();
	});
});

describe("open tracking status suffixes", () => {
	const message = (openCount) => ({
		draft: false,
		metadataForPluginId: vi.fn(() => openCount === undefined ? null : { open_count: openCount }),
	});

	it("renders nothing for a message without open metadata", () => {
		const { container } = render(<OpenTrackingMessageStatus message={message(undefined)} />);
		expect(container.textContent).toBe("");
	});

	it("renders No opens for a tracked but unopened message", () => {
		render(<OpenTrackingMessageStatus message={message(0)} />);
		expect(screen.getByText(/No opens/)).toBeDefined();
	});

	it("uses singular and plural message status suffixes", () => {
		const { rerender } = render(<OpenTrackingMessageStatus message={message(1)} />);
		expect(screen.getByText(/1 open$/)).toBeDefined();
		rerender(<OpenTrackingMessageStatus message={message(2)} />);
		expect(screen.getByText(/2 opens$/)).toBeDefined();
	});

	it("caps large message status counts at 999+", () => {
		render(<OpenTrackingMessageStatus message={message(1000)} />);
		expect(screen.getByText(/999\+ opens/)).toBeDefined();
	});

	it("uses the last non-draft message for the thread icon", () => {
		const opened = message(3);
		render(<OpenTrackingIcon thread={{ __messages: [opened, { ...message(9), draft: true }] }} />);
		expect(screen.getByTitle("3 opens")).toBeDefined();
	});

	it("uses a singular title for one open", () => {
		render(<OpenTrackingIcon thread={{ __messages: [message(1)] }} />);
		expect(screen.getByTitle("1 open")).toBeDefined();
	});

	it("describes a tracked thread with zero opens", () => {
		render(<OpenTrackingIcon thread={{ __messages: [message(0)] }} />);
		expect(screen.getByTitle("This message has not been opened")).toBeDefined();
	});

	it("renders a fixed-width placeholder when no sent message has metadata", () => {
		const { container } = render(<OpenTrackingIcon thread={{ __messages: [{ ...message(4), draft: true }] }} />);
		expect(container.firstChild.style.width).toBe("19px");
	});
});
