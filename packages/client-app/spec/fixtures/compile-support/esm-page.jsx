// ESM + JSX, the shape of an internal package component. Loaded by
// spec/compile-support-babel.spec.js through compile-cache's require hook.
import { helper } from "./esm-helper";

export const label = "esm-page";

export default function EsmPage() {
	return <div className="page">{helper()}</div>;
}
