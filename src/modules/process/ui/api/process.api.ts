import { z } from 'zod'
import type { CreateProcessInput } from '~/modules/process/interface/http/process.schemas'
import { toDashboardGlobalAlertsVM } from '~/modules/process/ui/mappers/dashboardGlobalAlerts.ui-mapper'
import { toProcessSummaryVMs } from '~/modules/process/ui/mappers/processList.ui-mapper'
import type { ProcessStatusCode } from '~/modules/process/ui/process-status-color'
import type { DashboardGlobalAlertsVM } from '~/modules/process/ui/viewmodels/dashboard-global-alerts.vm'
import type {
  DashboardSortDirection,
  DashboardSortField,
} from '~/modules/process/ui/viewmodels/dashboard-sort.vm'
import type { ProcessSummaryVM } from '~/modules/process/ui/viewmodels/process-summary.vm'
import { typedFetch } from '~/shared/api/typedFetch'
import { DashboardOperationalSummaryResponseSchema } from '~/shared/api-schemas/dashboard.schemas'
import {
  CreateProcessResponseSchema,
  ProcessListResponseSchema,
  ProcessResponseSchema,
} from '~/shared/api-schemas/processes.schemas'
import { systemClock } from '~/shared/time/clock'

const DASHBOARD_PROCESSES_ENDPOINT = '/api/processes'
const DASHBOARD_OPERATIONAL_SUMMARY_ENDPOINT = '/api/dashboard/operational-summary'
const DASHBOARD_PREFETCH_TTL_MS = 15_000

const AlertActionResponseSchema = z.object({
  ok: z.literal(true),
  alert_id: z.string(),
  action: z.enum(['acknowledge', 'unacknowledge']),
})

const NormalizeAutoCarriersResponseSchema = z.object({
  ok: z.literal(true),
  process_id: z.string(),
  normalized: z.boolean(),
  reason: z.string(),
  target_carrier_code: z.string().nullable(),
  before_summary: z.enum(['UNKNOWN', 'SINGLE', 'MIXED']),
  after_summary: z.enum(['UNKNOWN', 'SINGLE', 'MIXED']),
  updated_auto_containers: z.number().int().nonnegative(),
  skipped_manual_containers: z.number().int().nonnegative(),
  already_aligned_auto_containers: z.number().int().nonnegative(),
})

type DashboardProcessFiltersQuery = {
  readonly provider?: readonly string[]
  readonly status?: readonly ProcessStatusCode[]
  readonly importerId?: string
  readonly importerName?: string
}

type DashboardProcessSummariesQuery = {
  readonly sortField?: DashboardSortField
  readonly sortDir?: DashboardSortDirection
  readonly filters?: DashboardProcessFiltersQuery
}

type DashboardFetchOptions = {
  readonly preferPrefetched?: boolean
}

type DashboardProcessSummariesCacheRecord = {
  readonly expiresAtMs: number
  readonly value: readonly ProcessSummaryVM[]
}

type DashboardGlobalAlertsCacheRecord = {
  readonly expiresAtMs: number
  readonly value: DashboardGlobalAlertsVM
}

const dashboardProcessSummariesCacheByPath = new Map<string, DashboardProcessSummariesCacheRecord>()
const inFlightDashboardProcessSummariesByPath = new Map<
  string,
  Promise<readonly ProcessSummaryVM[]>
>()
let dashboardGlobalAlertsCache: DashboardGlobalAlertsCacheRecord | null = null
let inFlightDashboardGlobalAlerts: Promise<DashboardGlobalAlertsVM> | null = null

function nowMs(): number {
  return systemClock.now().toEpochMs()
}

function appendNonBlankQueryValues(
  searchParams: URLSearchParams,
  key: string,
  values: readonly string[] | undefined,
): void {
  if (values === undefined) return

  for (const value of values) {
    if (value.trim().length === 0) continue
    searchParams.append(key, value)
  }
}

function appendOptionalNonBlankQueryValue(
  searchParams: URLSearchParams,
  key: string,
  value: string | undefined,
): void {
  if (value === undefined) return
  if (value.trim().length === 0) return
  searchParams.set(key, value)
}

function toDashboardProcessesPath(query?: DashboardProcessSummariesQuery): string {
  const searchParams = new URLSearchParams()

  if (query !== undefined) {
    if (query.sortField !== undefined && query.sortDir !== undefined) {
      searchParams.set('sortField', query.sortField)
      searchParams.set('sortDir', query.sortDir)
    }

    const filters = query.filters
    if (filters !== undefined) {
      appendNonBlankQueryValues(searchParams, 'provider', filters.provider)
      appendNonBlankQueryValues(searchParams, 'status', filters.status)
      appendOptionalNonBlankQueryValue(searchParams, 'importerId', filters.importerId)
      appendOptionalNonBlankQueryValue(searchParams, 'importerName', filters.importerName)
    }
  }

  const queryString = searchParams.toString()
  if (queryString.length === 0) return DASHBOARD_PROCESSES_ENDPOINT

  return `${DASHBOARD_PROCESSES_ENDPOINT}?${queryString}`
}

function readFreshDashboardProcessSummariesCache(path: string): readonly ProcessSummaryVM[] | null {
  const cached = dashboardProcessSummariesCacheByPath.get(path)
  if (!cached) return null
  if (cached.expiresAtMs <= nowMs()) {
    dashboardProcessSummariesCacheByPath.delete(path)
    return null
  }
  return cached.value
}

function writeDashboardProcessSummariesCache(
  path: string,
  value: readonly ProcessSummaryVM[],
): void {
  dashboardProcessSummariesCacheByPath.set(path, {
    value,
    expiresAtMs: nowMs() + DASHBOARD_PREFETCH_TTL_MS,
  })
}

function readFreshDashboardGlobalAlertsCache(): DashboardGlobalAlertsVM | null {
  if (!dashboardGlobalAlertsCache) return null
  if (dashboardGlobalAlertsCache.expiresAtMs <= nowMs()) {
    dashboardGlobalAlertsCache = null
    return null
  }
  return dashboardGlobalAlertsCache.value
}

function writeDashboardGlobalAlertsCache(value: DashboardGlobalAlertsVM): void {
  dashboardGlobalAlertsCache = {
    value,
    expiresAtMs: nowMs() + DASHBOARD_PREFETCH_TTL_MS,
  }
}

async function loadDashboardProcessSummaries(
  path: string,
  command?: { readonly preferCached?: boolean },
): Promise<readonly ProcessSummaryVM[]> {
  if (command?.preferCached === true) {
    const cached = readFreshDashboardProcessSummariesCache(path)
    if (cached !== null) return cached
  }

  const inFlight = inFlightDashboardProcessSummariesByPath.get(path)
  if (inFlight) return inFlight

  const request = typedFetch(path, undefined, ProcessListResponseSchema)
    .then((data) => toProcessSummaryVMs(data))
    .then((value) => {
      writeDashboardProcessSummariesCache(path, value)
      return value
    })
    .finally(() => {
      inFlightDashboardProcessSummariesByPath.delete(path)
    })

  inFlightDashboardProcessSummariesByPath.set(path, request)
  return request
}

async function loadDashboardGlobalAlerts(command?: {
  readonly preferCached?: boolean
}): Promise<DashboardGlobalAlertsVM> {
  if (command?.preferCached === true) {
    const cached = readFreshDashboardGlobalAlertsCache()
    if (cached !== null) return cached
  }

  if (inFlightDashboardGlobalAlerts) return inFlightDashboardGlobalAlerts

  const request = fetchDashboardOperationalSummary()
    .then((data) => toDashboardGlobalAlertsVM(data))
    .then((value) => {
      writeDashboardGlobalAlertsCache(value)
      return value
    })
    .finally(() => {
      inFlightDashboardGlobalAlerts = null
    })

  inFlightDashboardGlobalAlerts = request
  return request
}

async function fetchDashboardOperationalSummary() {
  return typedFetch(
    DASHBOARD_OPERATIONAL_SUMMARY_ENDPOINT,
    undefined,
    DashboardOperationalSummaryResponseSchema,
  )
}

export async function fetchDashboardProcessSummaries(
  query?: DashboardProcessSummariesQuery,
  options?: DashboardFetchOptions,
): Promise<readonly ProcessSummaryVM[]> {
  const path = toDashboardProcessesPath(query)
  return loadDashboardProcessSummaries(path, {
    preferCached: options?.preferPrefetched === true,
  })
}

export async function fetchDashboardGlobalAlertsSummary(
  options?: DashboardFetchOptions,
): Promise<DashboardGlobalAlertsVM> {
  return loadDashboardGlobalAlerts({
    preferCached: options?.preferPrefetched === true,
  })
}

export async function prefetchDashboardProcessSummaries(
  query?: DashboardProcessSummariesQuery,
): Promise<void> {
  const path = toDashboardProcessesPath(query)
  await loadDashboardProcessSummaries(path, { preferCached: true })
}

export async function prefetchDashboardGlobalAlertsSummary(): Promise<void> {
  await loadDashboardGlobalAlerts({ preferCached: true })
}

export function clearDashboardPrefetchCache(): void {
  dashboardProcessSummariesCacheByPath.clear()
  inFlightDashboardProcessSummariesByPath.clear()
  dashboardGlobalAlertsCache = null
  inFlightDashboardGlobalAlerts = null
}

export async function createProcessRequest(input: CreateProcessInput): Promise<string> {
  const result = await typedFetch(
    '/api/processes',
    {
      method: 'POST',
      body: JSON.stringify(input),
      headers: { 'Content-Type': 'application/json' },
    },
    CreateProcessResponseSchema,
  )

  return result.process.id
}

export async function updateProcessRequest(id: string, input: CreateProcessInput): Promise<void> {
  await typedFetch(
    `/api/processes/${id}`,
    {
      method: 'PATCH',
      body: JSON.stringify(input),
      headers: { 'Content-Type': 'application/json' },
    },
    ProcessResponseSchema,
  )
}

export async function deleteProcessRequest(processId: string): Promise<void> {
  const response = await fetch(`/api/processes/${encodeURIComponent(processId)}`, {
    method: 'DELETE',
  })

  if (response.ok) return

  const body = await response.json().catch(() => ({}))
  const parsed = z.object({ error: z.string().optional() }).safeParse(body)
  const message =
    parsed.success && parsed.data.error ? parsed.data.error : 'Failed to delete process'
  throw new Error(message)
}

export async function normalizeAutoCarriersRequest(processId: string): Promise<{
  readonly normalized: boolean
  readonly reason: string
  readonly targetCarrierCode: string | null
}> {
  const result = await typedFetch(
    `/api/processes/${encodeURIComponent(processId)}/normalize-auto-carriers`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    NormalizeAutoCarriersResponseSchema,
  )

  return {
    normalized: result.normalized,
    reason: result.reason,
    targetCarrierCode: result.target_carrier_code,
  }
}

async function runTrackingAlertActionRequest(
  alertId: string,
  action: 'acknowledge' | 'unacknowledge',
): Promise<void> {
  await typedFetch(
    '/api/alerts',
    {
      method: 'PATCH',
      body: JSON.stringify({ alert_id: alertId, action }),
      headers: { 'Content-Type': 'application/json' },
    },
    AlertActionResponseSchema,
  )
}

export async function acknowledgeTrackingAlertRequest(alertId: string): Promise<void> {
  await runTrackingAlertActionRequest(alertId, 'acknowledge')
}

export async function unacknowledgeTrackingAlertRequest(alertId: string): Promise<void> {
  await runTrackingAlertActionRequest(alertId, 'unacknowledge')
}
