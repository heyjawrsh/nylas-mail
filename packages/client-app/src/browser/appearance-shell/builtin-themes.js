import fs from "node:fs";
import path from "node:path";

export function readBuiltinThemes(resourcePath) {
	const directory = path.join(resourcePath, "static", "themes");
	return ["classic"].map((id) => ({
		...JSON.parse(
			fs.readFileSync(path.join(directory, `${id}.descriptor.json`), "utf8"),
		),
		css: fs.readFileSync(path.join(directory, `${id}.css`), "utf8"),
	}));
}

export function readThemesFolder(configDirPath) {
	const folder = path.join(configDirPath, "themes");
	const exists = fs.existsSync(folder);
	let writable = false;
	if (exists) {
		try {
			if (fs.statSync(folder).isDirectory()) {
				fs.accessSync(folder, fs.constants.W_OK);
				writable = true;
			}
		} catch {
			// Report an inaccessible folder without changing it.
		}
	}
	return { path: folder, exists, writable };
}
