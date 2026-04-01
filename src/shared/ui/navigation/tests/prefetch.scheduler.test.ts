import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createViewportPrefetchController,
  flushScheduledNavigationPrefetches,
  resetNavigationPrefetchSchedulerForTests,
  scheduleNavigationPrefetch,
  waitForNavigationPrefetchesToSettleForTests,
} from '~/shared/ui/navigation/prefetch.scheduler'

afterEach(() => {
  resetNavigationPrefetchSchedulerForTests()
  vi.useRealTimers()
})

describe('prefetch scheduler', () => {
  it('dedupes queued prefetch tasks by key', async () => {
    const run = vi.fn(async () => undefined)

    scheduleNavigationPrefetch({
      key: 'process:dedupe-test',
      priority: 'viewport',
      run,
    })
    scheduleNavigationPrefetch({
      key: 'process:dedupe-test',
      priority: 'viewport',
      run,
    })

    flushScheduledNavigationPrefetches()
    await waitForNavigationPrefetchesToSettleForTests()

    expect(run).toHaveBeenCalledTimes(1)
  })

  it('upgrades a queued viewport prefetch to intent priority', async () => {
    const viewportRun = vi.fn(async () => undefined)
    const intentRun = vi.fn(async () => undefined)

    scheduleNavigationPrefetch({
      key: 'process:priority-test',
      priority: 'viewport',
      run: viewportRun,
    })
    scheduleNavigationPrefetch({
      key: 'process:priority-test',
      priority: 'intent',
      run: intentRun,
    })

    flushScheduledNavigationPrefetches()
    await waitForNavigationPrefetchesToSettleForTests()

    expect(viewportRun).not.toHaveBeenCalled()
    expect(intentRun).toHaveBeenCalledTimes(1)
  })

  it('debounces viewport prefetch until scrolling settles', () => {
    vi.useFakeTimers()

    let visibleKeys: readonly string[] = ['process-1']
    const onVisibleKeysSettled = vi.fn()

    const controller = createViewportPrefetchController({
      debounceMs: 120,
      collectVisibleKeys: () => visibleKeys,
      onVisibleKeysSettled,
    })

    controller.schedule()
    vi.advanceTimersByTime(80)

    visibleKeys = ['process-1', 'process-2']
    controller.schedule()

    vi.advanceTimersByTime(39)
    expect(onVisibleKeysSettled).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    vi.runOnlyPendingTimers()
    expect(onVisibleKeysSettled).toHaveBeenCalledTimes(1)
    expect(onVisibleKeysSettled).toHaveBeenCalledWith(['process-1', 'process-2'])
  })
})
