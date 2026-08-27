import {vi} from 'vitest'

globalThis.window = globalThis
globalThis.window.$n = globalThis.window.$n || {}
globalThis.window.originalSetTimeout = globalThis.setTimeout
globalThis.NylasEnv = {
  getCurrentWindow: vi.fn(() => ({show() {}, maximize() {}, openDevTools() {}})),
  inBenchmarkMode: vi.fn(() => false),
  inDevMode: vi.fn(() => false),
  inSpecMode: vi.fn(() => true),
  reportError: vi.fn(),
}
