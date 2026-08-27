import SerializableRegistry from "./serializable-registry.js";

class TaskRegistry extends SerializableRegistry {}

const registry = new TaskRegistry();
export default registry;
