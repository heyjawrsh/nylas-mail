// Replaces the lerna-era symlink step from scripts/postinstall.es6.
// Links the client-sync workspace package into client-app's
// internal_packages directory, where the app loads it at runtime.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "packages", "client-sync");
const destination = path.join(
	root,
	"packages",
	"client-app",
	"internal_packages",
	"client-sync",
);

fs.mkdirSync(path.dirname(destination), { recursive: true });
try {
	const st = fs.lstatSync(destination);
	if (st.isSymbolicLink()) fs.unlinkSync(destination);
	else if (st.isDirectory() && !fs.readdirSync(destination).length)
		fs.rmSync(destination, { recursive: true });
	else {
		console.error(`postinstall: refusing to replace non-empty ${destination}`);
		process.exit(1);
	}
} catch {
	// destination does not exist yet
}
fs.symlinkSync(source, destination, "dir");
console.log(
	"postinstall: linked packages/client-sync -> client-app/internal_packages/client-sync",
);
