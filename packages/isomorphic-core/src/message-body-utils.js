import fs from "node:fs";
import { mkdirp } from "mkdirp";
import path from "node:path";
import zlib from "node:zlib";

const MAX_PATH_DIRS = 5;
const FILE_EXTENSION = "nylasmail";

function baseMessagePath() {
	return path.join(process.env.NYLAS_HOME, "messages");
}

export function tryReadBody(val) {
	try {
		const parsed = JSON.parse(val);
		if (parsed?.path?.startsWith(baseMessagePath())) {
			if (parsed.compressed) {
				return zlib.gunzipSync(fs.readFileSync(parsed.path)).toString();
			}
			return fs.readFileSync(parsed.path, { encoding: "utf8" });
		}
	} catch (_err) {
		// ignore. this is valid. JSON parse should fail if the body isn't
		// metadata about the flat zipped file, but rather a plain text
	}
	return null;
}

export function pathForBodyFile(msgId) {
	const pathGroups = [];
	let remainingId = msgId;
	while (pathGroups.length < MAX_PATH_DIRS) {
		pathGroups.push(remainingId.substring(0, 2));
		remainingId = remainingId.substring(2);
	}
	const bodyPath = path.join(...pathGroups);
	return path.join(
		baseMessagePath(),
		bodyPath,
		`${remainingId}.${FILE_EXTENSION}`,
	);
}

// NB: The return value of this function is what gets written into the database.
export function writeBody({ msgId, body } = {}) {
	const bodyPath = pathForBodyFile(msgId);
	const bodyDir = path.dirname(bodyPath);

	const compressedBody = zlib.gzipSync(body);
	const dbEntry = {
		path: bodyPath,
		compressed: true,
	};

	// It's possible that gzipping actually makes the body larger. If that's the
	// case then just write the uncompressed body instead.
	let bodyToWrite = compressedBody;
	if (compressedBody.length >= body.length) {
		dbEntry.compressed = false;
		bodyToWrite = body;
	}

	const result = JSON.stringify(dbEntry);
	// If the JSON db entry would be longer than the body itself then just write
	// the body directly into the database.
	if (result.length > body.length) {
		return body;
	}

	try {
		if (!fs.existsSync(bodyPath)) {
			mkdirp.sync(bodyDir);
		}

		fs.writeFileSync(bodyPath, bodyToWrite);
		return result;
	} catch (_err) {
		// If anything bad happens while trying to write to disk just store the
		// body in the database.
		return body;
	}
}
