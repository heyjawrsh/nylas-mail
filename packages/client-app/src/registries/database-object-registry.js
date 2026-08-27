import SerializableRegistry from "./serializable-registry.js";

class DatabaseObjectRegistry extends SerializableRegistry {}

const registry = new DatabaseObjectRegistry();
export default registry;
