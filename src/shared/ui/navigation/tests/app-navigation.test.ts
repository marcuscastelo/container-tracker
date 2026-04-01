import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  buildDashboardHref,
  buildProcessContainerHref,
  buildProcessHref,
  isInternalAppHref,
  navigateToAppHref,
  navigateToProcess,
  navigateToProcessContainer,
  scheduleDashboardPrefetch,
  scheduleIntentPrefetch,
  scheduleVisiblePrefetch,
  toInternalAppPathname,
} from '~/shared/ui/navigation/app-navigation'
import {
  resetNavigationPrefetchSchedulerForTests,
  waitForNavigationPrefetchesToSettleForTests,
} from '~/shared/ui/navigation/prefetch.scheduler'

afterEach(() => {
  resetNavigationPrefetchSchedulerForTests()
})

describe('app-navigation helpers', () => {
  it('builds dashboard href', () => {
    expect(buildDashboardHref()).toBe('/')
  })

  it('builds process href with encoded process id', () => {
    expect(buildProcessHref('process/with space')).toBe('/shipments/process%2Fwith%20space')
  })

  it('builds process href with container deep-link query', () => {
    expect(buildProcessContainerHref('process/with space', ' mscu1234567 ')).toBe(
      '/shipments/process%2Fwith%20space?container=MSCU1234567',
    )
  })

  it('detects internal hrefs and parses pathname safely', () => {
    expect(isInternalAppHref('/shipments/abc')).toBe(true)
    expect(isInternalAppHref('https://example.com/shipments/abc')).toBe(false)
    expect(toInternalAppPathname('/shipments/abc?tab=alerts#top')).toBe('/shipments/abc')
  })

  it('navigates only when href is internal', () => {
    const navigate = vi.fn()

    expect(
      navigateToAppHref({
        navigate,
        href: '/shipments/p-123',
      }),
    ).toBe(true)
    expect(navigate).toHaveBeenCalledWith('/shipments/p-123', undefined)

    navigate.mockClear()

    expect(
      navigateToAppHref({
        navigate,
        href: 'https://external.example/p-123',
      }),
    ).toBe(false)
    expect(navigate).not.toHaveBeenCalled()
  })

  it('navigates to process through canonical helper', () => {
    const navigate = vi.fn()
    navigateToProcess({
      navigate,
      processId: 'p-abc',
    })

    expect(navigate).toHaveBeenCalledWith('/shipments/p-abc', undefined)
  })

  it('navigates to process container deep-link through canonical helper', () => {
    const navigate = vi.fn()
    navigateToProcessContainer({
      navigate,
      processId: 'p-abc',
      containerNumber: 'mscu7654321',
    })

    expect(navigate).toHaveBeenCalledWith('/shipments/p-abc?container=MSCU7654321', undefined)
  })

  it('preloads process intent using the canonical route helper', async () => {
    const preloadRoute = vi.fn()
    const preloadData = vi.fn(async (_processId: string) => undefined)

    scheduleIntentPrefetch({
      processId: 'intent-process-1',
      preloadRoute,
      preloadData,
    })

    await waitForNavigationPrefetchesToSettleForTests()

    expect(preloadRoute).toHaveBeenCalledTimes(1)
    expect(preloadRoute).toHaveBeenCalledWith('/shipments/intent-process-1', {
      preloadData: true,
    })
    expect(preloadData).toHaveBeenCalledTimes(1)
    expect(preloadData).toHaveBeenCalledWith('intent-process-1')
  })

  it('preloads visible processes using canonical route helpers', async () => {
    const preloadRoute = vi.fn()
    const preloadData = vi.fn(async (_processId: string) => undefined)

    scheduleVisiblePrefetch({
      processIds: ['visible-process-1', 'visible-process-1', 'visible-process-2'],
      preloadRoute,
      preloadData,
    })

    await waitForNavigationPrefetchesToSettleForTests()

    expect(preloadRoute).toHaveBeenCalledTimes(2)
    expect(preloadRoute).toHaveBeenNthCalledWith(1, '/shipments/visible-process-1', {
      preloadData: true,
    })
    expect(preloadRoute).toHaveBeenNthCalledWith(2, '/shipments/visible-process-2', {
      preloadData: true,
    })
    expect(preloadData).toHaveBeenCalledTimes(2)
    expect(preloadData).toHaveBeenNthCalledWith(1, 'visible-process-1')
    expect(preloadData).toHaveBeenNthCalledWith(2, 'visible-process-2')
  })

  it('caps visible prefetch bursts to the first ten unique process ids', async () => {
    const preloadRoute = vi.fn()
    const preloadData = vi.fn(async (_processId: string) => undefined)

    scheduleVisiblePrefetch({
      processIds: [
        'visible-process-1',
        'visible-process-2',
        'visible-process-2',
        'visible-process-3',
        'visible-process-4',
        'visible-process-5',
        'visible-process-6',
        'visible-process-7',
        'visible-process-8',
        'visible-process-9',
        'visible-process-10',
        'visible-process-11',
      ],
      preloadRoute,
      preloadData,
    })

    await waitForNavigationPrefetchesToSettleForTests()

    expect(preloadRoute).toHaveBeenCalledTimes(10)
    expect(preloadRoute).toHaveBeenNthCalledWith(1, '/shipments/visible-process-1', {
      preloadData: true,
    })
    expect(preloadRoute).toHaveBeenNthCalledWith(10, '/shipments/visible-process-10', {
      preloadData: true,
    })
    expect(preloadData).toHaveBeenCalledTimes(10)
    expect(preloadData).toHaveBeenNthCalledWith(1, 'visible-process-1')
    expect(preloadData).toHaveBeenNthCalledWith(10, 'visible-process-10')
  })

  it('preloads dashboard using the canonical route helper', async () => {
    const preloadRoute = vi.fn()
    const preloadData = vi.fn(async () => undefined)

    scheduleDashboardPrefetch({
      preloadRoute,
      preloadData,
      priority: 'intent',
    })

    await waitForNavigationPrefetchesToSettleForTests()

    expect(preloadRoute).toHaveBeenCalledTimes(1)
    expect(preloadRoute).toHaveBeenCalledWith('/', {
      preloadData: true,
    })
    expect(preloadData).toHaveBeenCalledTimes(1)
  })
})
