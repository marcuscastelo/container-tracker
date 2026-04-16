import { typedFetch } from '~/shared/api/typedFetch'
import {
  type DashboardKpisResponse,
  DashboardKpisResponseSchema,
} from '~/shared/api-schemas/dashboard.schemas'
import { systemClock } from '~/shared/time/clock'

const DASHBOARD_KPIS_ENDPOINT = '/api/dashboard/kpis'
const DASHBOARD_KPIS_PREFETCH_TTL_MS = 15_000

type DashboardFetchOptions = {
  readonly preferPrefetched?: boolean
}

type DashboardKpisCacheRecord = {
  readonly expiresAtMs: number
  readonly value: DashboardKpisResponse
}

let dashboardKpisCache: DashboardKpisCacheRecord | null = null
let inFlightDashboardKpis: Promise<DashboardKpisResponse> | null = null

function nowMs(): number {
  return systemClock.now().toEpochMs()
}

function readFreshDashboardKpisCache(): DashboardKpisResponse | null {
  if (!dashboardKpisCache) return null
  if (dashboardKpisCache.expiresAtMs <= nowMs()) {
    dashboardKpisCache = null
    return null
  }
  return dashboardKpisCache.value
}

function writeDashboardKpisCache(value: DashboardKpisResponse): void {
  dashboardKpisCache = {
    value,
    expiresAtMs: nowMs() + DASHBOARD_KPIS_PREFETCH_TTL_MS,
  }
}

async function loadDashboardKpis(command?: {
  readonly preferCached?: boolean
}): Promise<DashboardKpisResponse> {
  if (command?.preferCached === true) {
    const cached = readFreshDashboardKpisCache()
    if (cached !== null) return cached
  }

  if (inFlightDashboardKpis) return inFlightDashboardKpis

  const request = typedFetch(DASHBOARD_KPIS_ENDPOINT, undefined, DashboardKpisResponseSchema)
    .then((value) => {
      writeDashboardKpisCache(value)
      return value
    })
    .finally(() => {
      inFlightDashboardKpis = null
    })

  inFlightDashboardKpis = request
  return request
}

export async function fetchDashboardKpis(
  options?: DashboardFetchOptions,
): Promise<DashboardKpisResponse> {
  return loadDashboardKpis({
    preferCached: options?.preferPrefetched === true,
  })
}

export async function prefetchDashboardKpis(): Promise<void> {
  await loadDashboardKpis({ preferCached: true })
}

export function clearDashboardKpisPrefetchCache(): void {
  dashboardKpisCache = null
  inFlightDashboardKpis = null
}
