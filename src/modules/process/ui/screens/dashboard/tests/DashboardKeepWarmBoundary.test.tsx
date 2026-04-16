import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createDashboardKeepWarmController,
  DASHBOARD_KEEP_WARM_INTERVAL_MS,
  shouldKeepDashboardWarm,
} from '~/modules/process/ui/screens/dashboard/DashboardKeepWarmBoundary'
import {
  resetNavigationPrefetchSchedulerForTests,
  waitForNavigationPrefetchesToSettleForTests,
} from '~/shared/ui/navigation/prefetch.scheduler'

class MockDashboardWindow extends EventTarget {
  innerWidth: number

  constructor(innerWidth: number) {
    super()
    this.innerWidth = innerWidth
  }
}

class MockDashboardDocument extends EventTarget {
  visibilityState: DocumentVisibilityState

  constructor(visibilityState: DocumentVisibilityState) {
    super()
    this.visibilityState = visibilityState
  }
}

type MountedKeepWarmBoundary = {
  readonly dashboardDocument: MockDashboardDocument
  readonly dashboardWindow: MockDashboardWindow
  readonly dispose: () => void
  readonly preloadRoute: ReturnType<typeof vi.fn>
  readonly setPathname: (value: string) => void
  readonly warmDashboardData: ReturnType<typeof vi.fn>
}

const mountedBoundaries: Array<() => void> = []

async function settleDashboardWarmCycle(): Promise<void> {
  await Promise.resolve()
  await waitForNavigationPrefetchesToSettleForTests()
}

function mountDashboardKeepWarmBoundary(command?: {
  readonly pathname?: string
  readonly visibilityState?: DocumentVisibilityState
  readonly innerWidth?: number
  readonly warmDashboardData?: ReturnType<typeof vi.fn>
}): MountedKeepWarmBoundary {
  let pathname = command?.pathname ?? '/agents'
  const preloadRoute = vi.fn()
  const warmDashboardData = command?.warmDashboardData ?? vi.fn(async () => undefined)
  const dashboardWindow = new MockDashboardWindow(command?.innerWidth ?? 1366)
  const dashboardDocument = new MockDashboardDocument(command?.visibilityState ?? 'visible')

  const controller = createDashboardKeepWarmController({
    getPathname: () => pathname,
    preloadRoute,
    warmDashboardData,
    environment: {
      window: dashboardWindow,
      document: dashboardDocument,
    },
  })

  controller.sync()

  const cleanup = () => controller.dispose()

  mountedBoundaries.push(cleanup)

  return {
    dashboardDocument,
    dashboardWindow,
    dispose: cleanup,
    preloadRoute,
    setPathname: (value: string) => {
      pathname = value
      controller.sync()
    },
    warmDashboardData,
  }
}

afterEach(() => {
  while (mountedBoundaries.length > 0) {
    const cleanup = mountedBoundaries.pop()
    cleanup?.()
  }

  resetNavigationPrefetchSchedulerForTests()
  vi.useRealTimers()
})

describe('DashboardKeepWarmBoundary', () => {
  it('treats only the dashboard route as ineligible for keep-warm', () => {
    expect(shouldKeepDashboardWarm('/')).toBe(false)
    expect(shouldKeepDashboardWarm('/agents')).toBe(true)
    expect(shouldKeepDashboardWarm('/shipments/process-1')).toBe(true)
  })

  it('does not warm the dashboard while already on the dashboard route', async () => {
    const boundary = mountDashboardKeepWarmBoundary({
      pathname: '/',
    })

    await settleDashboardWarmCycle()

    expect(boundary.preloadRoute).not.toHaveBeenCalled()
    expect(boundary.warmDashboardData).not.toHaveBeenCalled()
  })

  it('starts warming as soon as navigation leaves the dashboard route', async () => {
    const boundary = mountDashboardKeepWarmBoundary({
      pathname: '/',
    })

    await settleDashboardWarmCycle()
    expect(boundary.preloadRoute).not.toHaveBeenCalled()

    boundary.setPathname('/agents')
    await settleDashboardWarmCycle()

    expect(boundary.preloadRoute).toHaveBeenCalledTimes(1)
    expect(boundary.warmDashboardData).toHaveBeenCalledTimes(1)
  })

  it('warms immediately and keeps warming on the configured interval outside the dashboard', async () => {
    vi.useFakeTimers()

    const boundary = mountDashboardKeepWarmBoundary()

    await settleDashboardWarmCycle()

    expect(boundary.preloadRoute).toHaveBeenCalledTimes(1)
    expect(boundary.preloadRoute).toHaveBeenCalledWith('/', {
      preloadData: true,
    })
    expect(boundary.warmDashboardData).toHaveBeenCalledTimes(1)
    expect(boundary.warmDashboardData).toHaveBeenCalledWith({
      windowSize: 24,
    })

    await vi.advanceTimersByTimeAsync(DASHBOARD_KEEP_WARM_INTERVAL_MS)
    await settleDashboardWarmCycle()

    expect(boundary.preloadRoute).toHaveBeenCalledTimes(2)
    expect(boundary.warmDashboardData).toHaveBeenCalledTimes(2)
  })

  it('pauses while hidden and resumes immediately plus on interval after becoming visible again', async () => {
    vi.useFakeTimers()

    const boundary = mountDashboardKeepWarmBoundary({
      visibilityState: 'hidden',
    })

    await settleDashboardWarmCycle()
    await vi.advanceTimersByTimeAsync(DASHBOARD_KEEP_WARM_INTERVAL_MS * 2)
    await settleDashboardWarmCycle()

    expect(boundary.preloadRoute).not.toHaveBeenCalled()
    expect(boundary.warmDashboardData).not.toHaveBeenCalled()

    boundary.dashboardDocument.visibilityState = 'visible'
    boundary.dashboardDocument.dispatchEvent(new Event('visibilitychange'))
    await settleDashboardWarmCycle()

    expect(boundary.preloadRoute).toHaveBeenCalledTimes(1)
    expect(boundary.warmDashboardData).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(DASHBOARD_KEEP_WARM_INTERVAL_MS)
    await settleDashboardWarmCycle()

    expect(boundary.preloadRoute).toHaveBeenCalledTimes(2)
    expect(boundary.warmDashboardData).toHaveBeenCalledTimes(2)
  })

  it('rewarms on focus and when the chart bucket changes, while deduping concurrent warm cycles', async () => {
    vi.useFakeTimers()

    const warmResolution: {
      resolve: null | (() => void)
    } = {
      resolve: null,
    }
    let shouldHoldFirstWarmRequest = true
    const warmDashboardData = vi.fn(() => {
      if (!shouldHoldFirstWarmRequest) {
        return Promise.resolve()
      }

      shouldHoldFirstWarmRequest = false
      return new Promise<void>((resolve) => {
        warmResolution.resolve = resolve
      })
    })

    const boundary = mountDashboardKeepWarmBoundary({
      warmDashboardData,
    })

    await Promise.resolve()

    expect(boundary.preloadRoute).toHaveBeenCalledTimes(1)
    expect(boundary.warmDashboardData).toHaveBeenCalledTimes(1)

    boundary.dashboardWindow.dispatchEvent(new Event('focus'))
    boundary.dashboardWindow.innerWidth = 480
    boundary.dashboardWindow.dispatchEvent(new Event('resize'))
    await vi.advanceTimersByTimeAsync(DASHBOARD_KEEP_WARM_INTERVAL_MS)
    await Promise.resolve()

    expect(boundary.preloadRoute).toHaveBeenCalledTimes(1)
    expect(boundary.warmDashboardData).toHaveBeenCalledTimes(1)

    if (warmResolution.resolve) {
      warmResolution.resolve()
    }
    await settleDashboardWarmCycle()

    boundary.dashboardWindow.innerWidth = 960
    boundary.dashboardWindow.dispatchEvent(new Event('resize'))
    await settleDashboardWarmCycle()

    expect(boundary.preloadRoute).toHaveBeenCalledTimes(2)
    expect(boundary.warmDashboardData).toHaveBeenNthCalledWith(2, {
      windowSize: 12,
    })
  })
})
