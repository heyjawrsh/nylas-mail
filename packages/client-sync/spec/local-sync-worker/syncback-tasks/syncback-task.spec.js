import {Errors} from 'isomorphic-core'
import {createLogger} from '../../../src/shared/logger'
import SyncbackTask from '../../../src/local-sync-worker/syncback-tasks/syncback-task'
import {vi} from 'vitest'

let syncbackTask;
const TIMEOUT_DELAY = 10;

describe("SyncbackTask", () => {
  beforeEach(() => {
    global.Logger = createLogger()
    const account = {id: 'account1'}
    const syncbackRequest = {
      status: 'NEW',
    }
    syncbackTask = new SyncbackTask(account, syncbackRequest)
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })
  describe("when it takes too long", () => {
    beforeEach(() => {
      syncbackTask._run = function* hello() {
        yield new Promise((resolve) => {
          setTimeout(resolve, TIMEOUT_DELAY + 5)
        })
      }
    })

    it("is stopped if retryable", async () => {
      syncbackTask._syncbackRequest.status = "INPROGRESS-RETRYABLE"
      const promise = syncbackTask.run(null, null, {timeoutDelay: TIMEOUT_DELAY})
      await vi.advanceTimersByTimeAsync(TIMEOUT_DELAY + 5)
      await expect(promise).rejects.toBeInstanceOf(Errors.RetryableError)
      await expect(promise).rejects.toThrow(/interrupted/i)
    })

    it("is not stopped if not retryable", async () => {
      syncbackTask._syncbackRequest.status = "INPROGRESS-NOTRETRYABLE"
      // If this does end up being stopped, it'll throw an error.
      const promise = syncbackTask.run(null, null, {timeoutDelay: TIMEOUT_DELAY})
      await vi.advanceTimersByTimeAsync(TIMEOUT_DELAY + 5)
      await expect(promise).resolves.toBeUndefined()
    })
  })
})
