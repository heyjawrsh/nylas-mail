import fs from 'node:fs'
import path from 'node:path'
import {pathToFileURL} from 'node:url'

const __dirname = path.dirname(new URL('.', import.meta.url).pathname);


export default async function loadModels(Sequelize, sequelize, {loadShared = true, modelDirs = [], schema} = {}) {
  if (loadShared) {
    modelDirs.unshift(path.join(__dirname, 'src', 'models'))
  }

  const db = {};

  const NON_MODEL_FILES = new Set(['define-model.js', '.eslintrc.js']);
  for (const modelsDir of modelDirs) {
    for (const filename of fs.readdirSync(modelsDir)) {
      if (filename.endsWith('.js') && !NON_MODEL_FILES.has(filename)) {
        const mod = await import(pathToFileURL(path.join(modelsDir, filename)).href)
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
