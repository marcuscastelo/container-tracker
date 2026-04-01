import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  buildDashboardHref,
  buildProcessContainerHref,
  buildProcessHref,
  isInternalAppHref,
  navigateToAppHref,
  navigateToProcess,
  navigateToProcessContainer,
  readProcessContainerNavigationState,
  readProcessContainerNavigationStateFromSearch,
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

describe('app-navigation href helpers', () => {
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

  it('builds process href with shipment alert navigation query params', () => {
    expect(
      buildProcessContainerHref('process/with space', ' mscu1234567 ', {
        source: 'navbar-alerts',
        focusSection: 'current-status',
        revealLiveStatus: true,
        requestKey: 'navbar-alert-3',
      }),
    ).toBe(
      '/shipments/process%2Fwith%20space?container=MSCU1234567&focus=current-status&focusRequest=navbar-alert-3',
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

  it('passes navigation state through process container deep-links when provided', () => {
    const navigate = vi.fn()
    navigateToProcessContainer({
      navigate,
      processId: 'p-abc',
      containerNumber: 'mscu7654321',
      navigationState: {
        source: 'navbar-alerts',
        focusSection: 'current-status',
        revealLiveStatus: true,
        requestKey: 'navbar-alert-1',
      },
      state: {
        source: 'navbar-alerts',
        focusSection: 'current-status',
        revealLiveStatus: true,
        requestKey: 'navbar-alert-1',
      },
    })

    expect(navigate).toHaveBeenCalledWith(
      '/shipments/p-abc?container=MSCU7654321&focus=current-status&focusRequest=navbar-alert-1',
      {
        state: {
          source: 'navbar-alerts',
          focusSection: 'current-status',
          revealLiveStatus: true,
          requestKey: 'navbar-alert-1',
        },
      },
    )
  })

  it('reads valid process container navigation state from router state', () => {
    expect(
      readProcessContainerNavigationState({
        source: 'navbar-alerts',
        focusSection: 'current-status',
        revealLiveStatus: true,
        requestKey: 'navbar-alert-2',
      }),
    ).toEqual({
      source: 'navbar-alerts',
      focusSection: 'current-status',
      revealLiveStatus: true,
      requestKey: 'navbar-alert-2',
    })
  })

  it('reads valid process container navigation state from url search params', () => {
    expect(
      readProcessContainerNavigationStateFromSearch(
        '?container=MSCU1234567&focus=current-status&focusRequest=navbar-alert-4',
      ),
    ).toEqual({
      source: 'navbar-alerts',
      focusSection: 'current-status',
      revealLiveStatus: true,
      requestKey: 'navbar-alert-4',
    })
  })

  it('rejects unrelated or malformed process container navigation state', () => {
    expect(
      readProcessContainerNavigationState({
        source: 'search',
        focusSection: 'current-status',
        revealLiveStatus: true,
        requestKey: 'navbar-alert-2',
      }),
    ).toBeNull()
    expect(
      readProcessContainerNavigationState({
        source: 'navbar-alerts',
        focusSection: 'current-status',
        revealLiveStatus: false,
        requestKey: 'navbar-alert-2',
      }),
    ).toBeNull()
    expect(readProcessContainerNavigationState(null)).toBeNull()
    expect(
      readProcessContainerNavigationStateFromSearch('?container=MSCU1234567&focus=current-status'),
    ).toBeNull()
    expect(
      readProcessContainerNavigationStateFromSearch('?container=MSCU1234567&focus=timeline'),
    ).toBeNull()
  })
})

describe('app-navigation prefetch helpers', () => {
  it('preloads process intent using the canonical route helper', async () => {
    const preloadRoute = vi.fn()
    const preloadData = vi.fn(async (_processId: string) => undefined)

    scheduleIntentPrefetch({
      processId: 'intent-process-1',
      preloadRoute,
      preloadData,
    })

    await Promise.resolve()
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

    await Promise.resolve()
    await waitForNavigationPrefetchesToSettleForTests()

    expect(preloadRoute).toHaveBeenCalledTimes(1)
    expect(preloadRoute).toHaveBeenCalledWith('/', {
      preloadData: true,
    })
    expect(preloadData).toHaveBeenCalledTimes(1)
  })
})
