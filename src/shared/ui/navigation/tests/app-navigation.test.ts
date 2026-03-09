import { describe, expect, it, vi } from 'vitest'
import {
  buildDashboardHref,
  buildProcessHref,
  isInternalAppHref,
  navigateToAppHref,
  navigateToProcess,
  prefetchDashboardIntent,
  prefetchProcessIntent,
  toInternalAppPathname,
} from '~/shared/ui/navigation/app-navigation'

describe('app-navigation helpers', () => {
  it('builds dashboard href', () => {
    expect(buildDashboardHref()).toBe('/')
  })

  it('builds process href with encoded process id', () => {
    expect(buildProcessHref('process/with space')).toBe('/shipments/process%2Fwith%20space')
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
    expect(navigate).toHaveBeenCalledWith('/shipments/p-123', { replace: undefined })

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

    expect(navigate).toHaveBeenCalledWith('/shipments/p-abc', { replace: undefined })
  })

  it('prefetches process intent with throttle', async () => {
    const preloadRoute = vi.fn()
    const preloadData = vi.fn(async () => undefined)

    prefetchProcessIntent({
      processId: 'intent-process-1',
      preloadRoute,
      preloadData,
      nowMs: 1_000,
    })
    prefetchProcessIntent({
      processId: 'intent-process-1',
      preloadRoute,
      preloadData,
      nowMs: 1_050,
    })
    prefetchProcessIntent({
      processId: 'intent-process-1',
      preloadRoute,
      preloadData,
      nowMs: 1_200,
    })

    expect(preloadRoute).toHaveBeenCalledTimes(2)
    expect(preloadRoute).toHaveBeenNthCalledWith(1, '/shipments/intent-process-1', {
      preloadData: true,
    })
    expect(preloadRoute).toHaveBeenNthCalledWith(2, '/shipments/intent-process-1', {
      preloadData: true,
    })
    expect(preloadData).toHaveBeenCalledTimes(2)
  })

  it('prefetches dashboard intent with throttle', async () => {
    const preloadRoute = vi.fn()
    const preloadData = vi.fn(async () => undefined)

    prefetchDashboardIntent({
      preloadRoute,
      preloadData,
      nowMs: 2_000,
    })
    prefetchDashboardIntent({
      preloadRoute,
      preloadData,
      nowMs: 2_050,
    })
    prefetchDashboardIntent({
      preloadRoute,
      preloadData,
      nowMs: 2_200,
    })

    expect(preloadRoute).toHaveBeenCalledTimes(2)
    expect(preloadRoute).toHaveBeenNthCalledWith(1, '/', {
      preloadData: true,
    })
    expect(preloadRoute).toHaveBeenNthCalledWith(2, '/', {
      preloadData: true,
    })
    expect(preloadData).toHaveBeenCalledTimes(2)
  })
})
