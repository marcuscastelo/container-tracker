import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  schedulePerProcessLocalSyncExpiry,
  schedulePerProcessVisibleLocalSyncExpiry,
} from '~/modules/process/ui/screens/dashboard/hooks/useDashboardSyncController'

class MockVisibilityDocument extends EventTarget {
  visibilityState: DocumentVisibilityState

  constructor(visibilityState: DocumentVisibilityState) {
    super()
    this.visibilityState = visibilityState
  }
}

describe('useDashboardSyncController', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  it('creates independent timers per process so clearing one does not cancel others', async () => {
    const onExpire = vi.fn()
    const expiryByProcessId = schedulePerProcessLocalSyncExpiry({
      processIds: ['p1', 'p2'],
      ttlMs: 2_500,
      onExpire,
    })

    expect(expiryByProcessId.size).toBe(2)
    const p1Expiry = expiryByProcessId.get('p1')
    const p2Expiry = expiryByProcessId.get('p2')
    expect(p1Expiry).toBeDefined()
    expect(p2Expiry).toBeDefined()
    expect(p1Expiry).not.toBe(p2Expiry)

    if (p1Expiry !== undefined) {
      p1Expiry.dispose()
    }

    await vi.advanceTimersByTimeAsync(2_600)

    expect(onExpire).toHaveBeenCalledTimes(1)
    expect(onExpire).toHaveBeenCalledWith('p2')
  })

  it('expires all process ids when timers are not cleared', async () => {
    const onExpire = vi.fn()
    schedulePerProcessLocalSyncExpiry({
      processIds: ['p1', 'p2'],
      ttlMs: 2_500,
      onExpire,
    })

    await vi.advanceTimersByTimeAsync(2_600)

    expect(onExpire).toHaveBeenCalledTimes(2)
    expect(onExpire).toHaveBeenCalledWith('p1')
    expect(onExpire).toHaveBeenCalledWith('p2')
  })

  it('pauses visible success expiry while the document is hidden and resumes when visible again', async () => {
    const onExpire = vi.fn()
    const mockDocument = new MockVisibilityDocument('hidden')

    schedulePerProcessVisibleLocalSyncExpiry({
      processIds: ['p1'],
      ttlMs: 30_000,
      onExpire,
      environment: {
        document: mockDocument,
      },
    })

    await vi.advanceTimersByTimeAsync(30_000)
    expect(onExpire).not.toHaveBeenCalled()

    mockDocument.visibilityState = 'visible'
    mockDocument.dispatchEvent(new Event('visibilitychange'))

    await vi.advanceTimersByTimeAsync(29_000)
    expect(onExpire).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1_100)
    expect(onExpire).toHaveBeenCalledTimes(1)
    expect(onExpire).toHaveBeenCalledWith('p1')
  })

  it('preserves the remaining visible time when the tab is hidden mid-countdown', async () => {
    const onExpire = vi.fn()
    const mockDocument = new MockVisibilityDocument('visible')

    schedulePerProcessVisibleLocalSyncExpiry({
      processIds: ['p1'],
      ttlMs: 30_000,
      onExpire,
      environment: {
        document: mockDocument,
      },
    })

    await vi.advanceTimersByTimeAsync(10_000)

    mockDocument.visibilityState = 'hidden'
    mockDocument.dispatchEvent(new Event('visibilitychange'))
    await vi.advanceTimersByTimeAsync(60_000)

    expect(onExpire).not.toHaveBeenCalled()

    mockDocument.visibilityState = 'visible'
    mockDocument.dispatchEvent(new Event('visibilitychange'))

    await vi.advanceTimersByTimeAsync(19_000)
    expect(onExpire).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1_100)
    expect(onExpire).toHaveBeenCalledTimes(1)
  })
})
