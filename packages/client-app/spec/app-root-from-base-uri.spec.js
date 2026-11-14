import { describe, expect, it } from "vitest";
import appRootFromBaseURI from "../src/app-root-from-base-uri.js";

describe("appRootFromBaseURI", () => {
	it("decodes %20 into a real space", () => {
		expect(
			appRootFromBaseURI("file:///Applications/Nylas%20Mail.app/Contents/Resources/app/static/index.html", false),
		).toBe("/Applications/Nylas Mail.app/Contents/Resources/app");
	});

	it("uses the document's own dir when it isn't in static/", () => {
		expect(appRootFromBaseURI("file:///opt/nylas%20mail/index.html", false)).toBe("/opt/nylas mail");
	});

	it("keeps a Windows drive letter", () => {
		expect(
			appRootFromBaseURI("file:///C:/Program%20Files/Nylas%20Mail/resources/app/static/index.html", true),
		).toBe("C:\\Program Files\\Nylas Mail\\resources\\app");
	});
});
