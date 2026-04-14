import { createUpdaterPublicLogsPublisher } from '@agent/updater'
import { afterEach, describe, expect, it, vi } from 'vitest'

describe('updater public logs publisher', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('debounces repeated refresh requests and flushes pending work on shutdown', () => {
    vi.useFakeTimers()
    const refresh = vi.fn()
    const publisher = createUpdaterPublicLogsPublisher({
      refresh,
      debounceMs: 150,
    })

    publisher.requestRefresh()
    publisher.requestRefresh()

    expect(refresh).not.toHaveBeenCalled()

    vi.advanceTimersByTime(149)
    expect(refresh).not.toHaveBeenCalled()

    publisher.flushPending()
    expect(refresh).toHaveBeenCalledTimes(1)

    publisher.requestRefresh()
    vi.advanceTimersByTime(150)
    expect(refresh).toHaveBeenCalledTimes(2)
  })
})
