import type { Accessor, JSX } from 'solid-js'
import { createEffect } from 'solid-js'
import { prefetchDashboardData } from '~/modules/process/ui/api/process.api'
import { prefetchProcessDetail } from '~/modules/process/ui/fetchProcess'
import { resolveDashboardChartWindowSize } from '~/modules/process/ui/utils/dashboard-chart-window-size'

type AppInitialRoutePrefetchBoundaryProps = {
  readonly pathname: Accessor<string>
  readonly locale: Accessor<string>
}

type InitialRoutePrefetchTarget =
  | {
      readonly kind: 'dashboard'
    }
  | {
      readonly kind: 'shipment'
      readonly processId: string
    }

function toInitialRoutePrefetchTarget(pathname: string): InitialRoutePrefetchTarget | null {
  if (pathname === '/') {
    return { kind: 'dashboard' }
  }

  const shipmentMatch = /^\/shipments\/([^/?#]+)/.exec(pathname)
  const encodedProcessId = shipmentMatch?.[1]
  if (!encodedProcessId) return null

  try {
    return {
      kind: 'shipment',
      processId: decodeURIComponent(encodedProcessId),
    }
  } catch {
    return {
      kind: 'shipment',
      processId: encodedProcessId,
    }
  }
}

function resolveInitialDashboardWindowSize(): 6 | 12 | 24 {
  if (typeof window === 'undefined') return 24
  return resolveDashboardChartWindowSize(window.innerWidth)
}

export function AppInitialRoutePrefetchBoundary(
  props: AppInitialRoutePrefetchBoundaryProps,
): JSX.Element {
  let lastPrefetchedKey: string | null = null

  createEffect(() => {
    const pathname = props.pathname()
    const locale = props.locale()
    const target = toInitialRoutePrefetchTarget(pathname)

    if (!target) {
      lastPrefetchedKey = null
      return
    }

    const nextKey =
      target.kind === 'dashboard'
        ? `dashboard:${resolveInitialDashboardWindowSize()}`
        : `shipment:${target.processId}:${locale}`

    if (lastPrefetchedKey === nextKey) return
    lastPrefetchedKey = nextKey

    if (target.kind === 'dashboard') {
      void prefetchDashboardData({
        windowSize: resolveInitialDashboardWindowSize(),
      }).catch(() => undefined)
      return
    }

    void prefetchProcessDetail(target.processId, locale)
  })

  return null
}
