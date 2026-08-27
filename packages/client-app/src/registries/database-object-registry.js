const SerializableRegistry = require("./serializable-registry.js").default;

class DatabaseObjectRegistry extends SerializableRegistry {}

const registry = new DatabaseObjectRegistry();
module.exports = registry;
module.exports.default = registry;
