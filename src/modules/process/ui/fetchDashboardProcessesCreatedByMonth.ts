import { typedFetch } from '~/shared/api/typedFetch'
import {
  type DashboardProcessesCreatedByMonthResponse,
  DashboardProcessesCreatedByMonthResponseSchema,
} from '~/shared/api-schemas/dashboard.schemas'
import { systemClock } from '~/shared/time/clock'

const DASHBOARD_PROCESSES_CREATED_BY_MONTH_ENDPOINT =
  '/api/dashboard/charts/processes-created-by-month'
const DASHBOARD_ACTIVITY_PREFETCH_TTL_MS = 15_000

export type DashboardChartWindowSize = 6 | 12 | 24

type FetchDashboardProcessesCreatedByMonthCommand = {
  readonly windowSize?: DashboardChartWindowSize
}

type DashboardFetchOptions = {
  readonly preferPrefetched?: boolean
}

type DashboardProcessesCreatedByMonthCacheRecord = {
  readonly expiresAtMs: number
  readonly value: DashboardProcessesCreatedByMonthResponse
}

const dashboardProcessesCreatedByMonthCacheByPath = new Map<
  string,
  DashboardProcessesCreatedByMonthCacheRecord
>()
const inFlightDashboardProcessesCreatedByMonthByPath = new Map<
  string,
  Promise<DashboardProcessesCreatedByMonthResponse>
>()

function nowMs(): number {
  return systemClock.now().toEpochMs()
}

function toDashboardProcessesCreatedByMonthUrl(
  command: FetchDashboardProcessesCreatedByMonthCommand = {},
): string {
  const { windowSize } = command
  if (windowSize === undefined) {
    return DASHBOARD_PROCESSES_CREATED_BY_MONTH_ENDPOINT
  }

  return `${DASHBOARD_PROCESSES_CREATED_BY_MONTH_ENDPOINT}?window=${windowSize}`
}

function readFreshDashboardProcessesCreatedByMonthCache(
  path: string,
): DashboardProcessesCreatedByMonthResponse | null {
  const cached = dashboardProcessesCreatedByMonthCacheByPath.get(path)
  if (!cached) return null
  if (cached.expiresAtMs <= nowMs()) {
    dashboardProcessesCreatedByMonthCacheByPath.delete(path)
    return null
  }
  return cached.value
}

function writeDashboardProcessesCreatedByMonthCache(
  path: string,
  value: DashboardProcessesCreatedByMonthResponse,
): void {
  dashboardProcessesCreatedByMonthCacheByPath.set(path, {
    value,
    expiresAtMs: nowMs() + DASHBOARD_ACTIVITY_PREFETCH_TTL_MS,
  })
}

async function loadDashboardProcessesCreatedByMonth(
  path: string,
  command?: { readonly preferCached?: boolean },
): Promise<DashboardProcessesCreatedByMonthResponse> {
  if (command?.preferCached === true) {
    const cached = readFreshDashboardProcessesCreatedByMonthCache(path)
    if (cached !== null) return cached
  }

  const inFlight = inFlightDashboardProcessesCreatedByMonthByPath.get(path)
  if (inFlight) return inFlight

  const request = typedFetch(path, undefined, DashboardProcessesCreatedByMonthResponseSchema)
    .then((value) => {
      writeDashboardProcessesCreatedByMonthCache(path, value)
      return value
    })
    .finally(() => {
      inFlightDashboardProcessesCreatedByMonthByPath.delete(path)
    })

  inFlightDashboardProcessesCreatedByMonthByPath.set(path, request)
  return request
}

export async function fetchDashboardProcessesCreatedByMonth(
  command: FetchDashboardProcessesCreatedByMonthCommand = {},
  options?: DashboardFetchOptions,
): Promise<DashboardProcessesCreatedByMonthResponse> {
  const path = toDashboardProcessesCreatedByMonthUrl(command)
  return loadDashboardProcessesCreatedByMonth(path, {
    preferCached: options?.preferPrefetched === true,
  })
}

export async function prefetchDashboardProcessesCreatedByMonth(
  command: FetchDashboardProcessesCreatedByMonthCommand = {},
): Promise<void> {
  const path = toDashboardProcessesCreatedByMonthUrl(command)
  await loadDashboardProcessesCreatedByMonth(path, { preferCached: true })
}

export function clearDashboardProcessesCreatedByMonthPrefetchCache(): void {
  dashboardProcessesCreatedByMonthCacheByPath.clear()
  inFlightDashboardProcessesCreatedByMonthByPath.clear()
}
