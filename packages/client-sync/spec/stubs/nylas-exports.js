import {vi} from 'vitest'

const action = () => ({listen: vi.fn()})

export const Actions = {
  debugSync: action(),
  recordPerfMetric: vi.fn(),
  recordUserEvent: vi.fn(),
  resetEmailCache: action(),
  runSendRequest: action(),
  updateAccount: vi.fn(),
  wakeLocalSyncWorkerForAccount: action(),
}
export const Account = {
  SYNC_STATE_AUTH_FAILED: 'auth-failed',
  SYNC_STATE_ERROR: 'error',
  SYNC_STATE_RUNNING: 'running',
}
export const AccountStore = {accounts: vi.fn(() => []), isMyEmail: vi.fn(() => false), listen: vi.fn()}
export class APIError extends Error {}
export const BatteryStatusManager = {isOnBatteryPower: vi.fn(() => false)}
export const ComponentRegistry = {register: vi.fn()}
export const DatabaseStore = {findJSONBlob: vi.fn(), inTransaction: vi.fn(fn => fn())}
export class DeltaProcessor {}
export const IdentityStore = {identity: vi.fn(() => true), identityId: vi.fn(() => 'test-identity'), listen: vi.fn()}
export const IMAPSearchQueryBackend = {}
export class N1CloudAPI {}
export class NylasAPI { static PermanentErrorCodes = [400, 401, 403, 404] }
export class NylasAPIRequest { run() { return Promise.resolve({}) } }
export const OnlineStatusStore = {isOnline: vi.fn(() => true), listen: vi.fn()}
export const React = {Component: class Component {}, createElement: vi.fn()}
export const ReactDOM = {}
export const SearchQueryParser = {}
