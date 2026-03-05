import type { CreateProcessInput } from '~/modules/process/interface/http/process.schemas'
import type { CreateProcessDialogFormData } from '~/modules/process/ui/CreateProcessDialog'
import { toDashboardGlobalAlertsVM } from '~/modules/process/ui/mappers/dashboardGlobalAlerts.ui-mapper'
import { toProcessSummaryVMs } from '~/modules/process/ui/mappers/processList.ui-mapper'
import type { DashboardGlobalAlertsVM } from '~/modules/process/ui/viewmodels/dashboard-global-alerts.vm'
import type {
  DashboardSortDirection,
  DashboardSortField,
} from '~/modules/process/ui/viewmodels/dashboard-sort.vm'
import type { ProcessSummaryVM } from '~/modules/process/ui/viewmodels/process-summary.vm'
import type { TrackingStatusCode } from '~/modules/tracking/application/projection/tracking.status.projection'
import { typedFetch } from '~/shared/api/typedFetch'
import { DashboardOperationalSummaryResponseSchema } from '~/shared/api-schemas/dashboard.schemas'
import {
  CreateProcessResponseSchema,
  ProcessListResponseSchema,
  ProcessResponseSchema,
} from '~/shared/api-schemas/processes.schemas'

const DASHBOARD_PROCESSES_ENDPOINT = '/api/processes'

type DashboardProcessFiltersQuery = {
  readonly provider?: readonly string[]
  readonly status?: readonly TrackingStatusCode[]
  readonly importerId?: string
  readonly importerName?: string
}

type DashboardProcessSummariesQuery = {
  readonly sortField?: DashboardSortField
  readonly sortDir?: DashboardSortDirection
  readonly filters?: DashboardProcessFiltersQuery
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

export function toCreateProcessInput(data: CreateProcessDialogFormData): CreateProcessInput {
  return {
    reference: data.reference || null,
    origin: data.origin ? { display_name: data.origin } : null,
    destination: data.destination ? { display_name: data.destination } : null,
    carrier: data.carrier || null,
    bill_of_lading: data.billOfLading || null,
    booking_number: data.bookingNumber || null,
    importer_name: data.importerName || null,
    exporter_name: data.exporterName || null,
    reference_importer: data.referenceImporter || null,
    product: data.product || null,
    redestination_number: data.redestinationNumber || null,
    containers: data.containers.map((container) => ({
      container_number: container.containerNumber,
      carrier_code: data.carrier || null,
    })),
  }
}

export async function fetchDashboardProcessSummaries(
  query?: DashboardProcessSummariesQuery,
): Promise<readonly ProcessSummaryVM[]> {
  const data = await typedFetch(
    toDashboardProcessesPath(query),
    undefined,
    ProcessListResponseSchema,
  )
  return toProcessSummaryVMs(data)
}

async function fetchDashboardOperationalSummary() {
  return typedFetch(
    '/api/dashboard/operational-summary',
    undefined,
    DashboardOperationalSummaryResponseSchema,
  )
}

export async function fetchDashboardGlobalAlertsSummary(): Promise<DashboardGlobalAlertsVM> {
  const data = await fetchDashboardOperationalSummary()
  return toDashboardGlobalAlertsVM(data)
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
