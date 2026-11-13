// True when a and b have the same keys with identical (===) values. Used by
// components that re-derive state or re-subscribe only when their props change.
export default function shallowEqual(a, b) {
	if (a === b) return true;
	if (!a || !b) return false;
	const aKeys = Object.keys(a);
	if (aKeys.length !== Object.keys(b).length) return false;
	return aKeys.every(
		(key) => Object.prototype.hasOwnProperty.call(b, key) && a[key] === b[key],
	);
}
