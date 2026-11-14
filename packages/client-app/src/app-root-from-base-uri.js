import path from "node:path";
import { fileURLToPath } from "node:url";

// The app root for a page at <root>/static/*.html or <root>/*.html.
// fileURLToPath decodes %20 (the packaged app lives in "Nylas Mail.app")
// and turns file:///C:/... into a real Windows path.
export default function appRootFromBaseURI(
	baseURI,
	windows = process.platform === "win32",
) {
	const p = windows ? path.win32 : path.posix;
	const dir = p.resolve(fileURLToPath(new URL(".", baseURI), { windows }));
	return p.basename(dir) === "static" ? p.dirname(dir) : dir;
}
