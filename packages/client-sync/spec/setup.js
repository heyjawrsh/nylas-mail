import {vi} from 'vitest'
import os from 'node:os'
import path from 'node:path'

process.env.NYLAS_HOME = path.join(os.tmpdir(), 'nylas-sync-spec-home')

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
