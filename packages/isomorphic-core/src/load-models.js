import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// Works in Node ESM, CJS require(esm), and esbuild renderer bundles (where
// import.meta.url is empty): fall back to require-based resolution.
let __dirname;
try {
	// fileURLToPath decodes %20 & co. (the packaged app lives in "Nylas Mail.app")
	__dirname = path.dirname(fileURLToPath(new URL(".", import.meta.url)));
} catch (_e) {
	__dirname = path.dirname(
		(typeof require !== "undefined" ? require : () => null)?.main?.filename ||
			process.cwd(),
	);
}

export default async function loadModels(
	Sequelize,
	sequelize,
	{ loadShared = true, modelDirs = [], schema } = {},
) {
	if (loadShared) {
		modelDirs.unshift(path.join(__dirname, "src", "models"));
	}

	const db = {};

	const NON_MODEL_FILES = new Set(["define-model.js", ".eslintrc.js"]);
	for (const modelsDir of modelDirs) {
		for (const filename of fs.readdirSync(modelsDir)) {
			if (filename.endsWith(".js") && !NON_MODEL_FILES.has(filename)) {
				const mod = await import(
					pathToFileURL(path.join(modelsDir, filename)).href
				);
				let model = mod.default(sequelize, Sequelize);
				if (schema) {
					model = model.schema(schema);
				}
				db[model.name[0].toUpperCase() + model.name.substr(1)] = model;
			}
		}
	}

	Object.keys(db).forEach((modelName) => {
		if ("associate" in db[modelName]) {
			db[modelName].associate(db);
		}
	});

	return db;
}
