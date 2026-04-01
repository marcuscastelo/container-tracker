import type { Accessor, JSX } from 'solid-js'
import { createEffect, onCleanup } from 'solid-js'
import { prefetchDashboardData } from '~/modules/process/ui/api/process.api'
import type { DashboardChartWindowSize } from '~/modules/process/ui/fetchDashboardProcessesCreatedByMonth'
import { resolveDashboardChartWindowSize } from '~/modules/process/ui/utils/dashboard-chart-window-size'
import {
  type PreloadRouteFn,
  scheduleDashboardPrefetch,
} from '~/shared/ui/navigation/app-navigation'

export const DASHBOARD_KEEP_WARM_INTERVAL_MS = 12_000

export type DashboardKeepWarmEnvironment = {
  readonly document?:
    | Pick<Document, 'addEventListener' | 'removeEventListener' | 'visibilityState'>
    | undefined
  readonly window?:
    | Pick<Window, 'addEventListener' | 'removeEventListener' | 'innerWidth'>
    | undefined
}

type DashboardKeepWarmBoundaryProps = {
  readonly pathname: Accessor<string>
  readonly preloadRoute: PreloadRouteFn
  readonly environment?: DashboardKeepWarmEnvironment
  readonly warmDashboardData?: (command: {
    readonly windowSize: DashboardChartWindowSize
  }) => Promise<unknown> | unknown
}

type DashboardKeepWarmController = {
  readonly dispose: () => void
  readonly sync: () => void
}

export function shouldKeepDashboardWarm(pathname: string): boolean {
  return pathname !== '/'
}

function resolveDashboardWarmWindowSize(
  currentWindow: DashboardKeepWarmEnvironment['window'],
): DashboardChartWindowSize {
  if (!currentWindow) return 6
  return resolveDashboardChartWindowSize(currentWindow.innerWidth)
}

function isDocumentVisible(currentDocument: DashboardKeepWarmEnvironment['document']): boolean {
  if (!currentDocument) return true
  return currentDocument.visibilityState === 'visible'
}

export function createDashboardKeepWarmController(command: {
  readonly environment?: DashboardKeepWarmEnvironment
  readonly getPathname: () => string
  readonly preloadRoute: PreloadRouteFn
  readonly warmDashboardData?: (args: {
    readonly windowSize: DashboardChartWindowSize
  }) => Promise<unknown> | unknown
}): DashboardKeepWarmController {
  const currentWindow =
    command.environment?.window ?? (typeof window === 'undefined' ? undefined : window)
  const currentDocument =
    command.environment?.document ?? (typeof document === 'undefined' ? undefined : document)
  const warmDashboardData = command.warmDashboardData ?? prefetchDashboardData
  let pageVisible = isDocumentVisible(currentDocument)
  let lastWindowSize = resolveDashboardWarmWindowSize(currentWindow)
  let intervalId: ReturnType<typeof globalThis.setInterval> | null = null

  const runWarmCycle = (windowSize?: DashboardChartWindowSize): void => {
    if (!shouldKeepDashboardWarm(command.getPathname())) return
    if (!pageVisible) return

    scheduleDashboardPrefetch({
      preloadRoute: command.preloadRoute,
      priority: 'viewport',
      preloadData: () =>
        warmDashboardData({
          windowSize: windowSize ?? resolveDashboardWarmWindowSize(currentWindow),
        }),
    })
  }

  const stopInterval = (): void => {
    if (intervalId !== null) {
      globalThis.clearInterval(intervalId)
      intervalId = null
    }
  }

  const sync = (): void => {
    if (!shouldKeepDashboardWarm(command.getPathname()) || !pageVisible) {
      stopInterval()
      return
    }

    runWarmCycle()

    if (intervalId !== null) return

    intervalId = globalThis.setInterval(() => {
      if (!shouldKeepDashboardWarm(command.getPathname()) || !pageVisible) return
      runWarmCycle()
    }, DASHBOARD_KEEP_WARM_INTERVAL_MS)
  }

  const handleVisibilityChange = () => {
    pageVisible = isDocumentVisible(currentDocument)
    if (!pageVisible) {
      stopInterval()
      return
    }

    sync()
  }

  if (currentDocument) {
    currentDocument.addEventListener('visibilitychange', handleVisibilityChange)
  }

  const handleFocus = () => {
    runWarmCycle()
  }

  const handleResize = () => {
    const nextWindowSize = resolveDashboardWarmWindowSize(currentWindow)
    if (nextWindowSize === lastWindowSize) return
    lastWindowSize = nextWindowSize
    runWarmCycle(nextWindowSize)
  }

  if (currentWindow) {
    currentWindow.addEventListener('focus', handleFocus)
    currentWindow.addEventListener('resize', handleResize)
  }

  return {
    sync,
    dispose: () => {
      stopInterval()
      if (currentWindow) {
        currentWindow.removeEventListener('focus', handleFocus)
        currentWindow.removeEventListener('resize', handleResize)
      }
      if (currentDocument) {
        currentDocument.removeEventListener('visibilitychange', handleVisibilityChange)
      }
    },
  }
}

export function DashboardKeepWarmBoundary(props: DashboardKeepWarmBoundaryProps): JSX.Element {
  const getPathname = () => props.pathname()
  const preloadRoute: PreloadRouteFn = (...args) => props.preloadRoute(...args)
  const environment: DashboardKeepWarmEnvironment = {
    get document() {
      return props.environment?.document
    },
    get window() {
      return props.environment?.window
    },
  }
  const warmDashboardData = (args: { readonly windowSize: DashboardChartWindowSize }) =>
    props.warmDashboardData?.(args) ?? prefetchDashboardData(args)
  const controller = createDashboardKeepWarmController({
    getPathname,
    preloadRoute,
    environment,
    warmDashboardData,
  })

  createEffect(() => {
    getPathname()
    controller.sync()
  })

  onCleanup(() => {
    controller.dispose()
  })

  return null
}
