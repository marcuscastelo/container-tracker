import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { schedulePerProcessLocalSyncExpiry } from '~/modules/process/ui/screens/dashboard/hooks/useDashboardSyncController'

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
    const timeoutByProcessId = schedulePerProcessLocalSyncExpiry({
      processIds: ['p1', 'p2'],
      ttlMs: 2_500,
      onExpire,
    })

    expect(timeoutByProcessId.size).toBe(2)
    const p1Timeout = timeoutByProcessId.get('p1')
    const p2Timeout = timeoutByProcessId.get('p2')
    expect(p1Timeout).toBeDefined()
    expect(p2Timeout).toBeDefined()
    expect(p1Timeout).not.toBe(p2Timeout)

    if (p1Timeout !== undefined) {
      clearTimeout(p1Timeout)
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
})
