// React 19 can't look up a component's DOM node. A ref holds either a DOM node (a ref on a
// host element) or a component instance. A component whose DOM node other
// code needs exposes it through a getDOMNode() method; this resolves either
// kind of ref value to the node, or null.
export function domNodeOf(refValue) {
	if (!refValue) {
		return null;
	}
	if (typeof refValue.nodeType === "number") {
		return refValue;
	}
	if (typeof refValue.getDOMNode === "function") {
		return refValue.getDOMNode() || null;
	}
	return null;
}

export default domNodeOf;
