const SerializableRegistry = require("./serializable-registry.js").default;

class TaskRegistry extends SerializableRegistry {}

const registry = new TaskRegistry();
module.exports = registry;
module.exports.default = registry;
