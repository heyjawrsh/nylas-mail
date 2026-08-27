// Must be the FIRST import of the window bootstraps: the flux layer reads the
// NylasEnv global at module-load time, so it must exist before ./window (and
// its whole static graph) evaluates.
import NylasEnvConstructor from "./nylas-env.js";

window.NylasEnv = window.atom = NylasEnvConstructor.loadOrCreate();
