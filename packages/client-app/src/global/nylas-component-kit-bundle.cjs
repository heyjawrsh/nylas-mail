// The renderer bundle's `nylas-component-kit` (aliased in
// scripts/build-renderer.js).
//
// nylas-component-kit.js reads import.meta, so esbuild treats it as ESM with
// no exports, and every `import { Modal } from "nylas-component-kit"` in the
// bundle came out undefined. This file is CommonJS: esbuild compiles named
// imports from it to property reads at the point of use, so the kit's lazy
// getters stay lazy (a component is required only when first read).
//
// It is the one kit instance per window. register-bundled-modules.js hands
// this same object to internal packages.
require("./nylas-component-kit.js");

const NylasComponentKit = globalThis.NylasComponentKitClass;
const kit = new NylasComponentKit();
kit.NylasComponentKit = NylasComponentKit; // class handle for specs

module.exports = kit;
