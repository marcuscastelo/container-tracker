import type { CreateProcessInput } from '~/modules/process/interface/http/process.schemas'
import type { CreateProcessDialogFormData } from '~/modules/process/ui/CreateProcessDialog'
import { toDashboardGlobalAlertsVM } from '~/modules/process/ui/mappers/dashboardGlobalAlerts.ui-mapper'
import { toDashboardProcessExceptionVMs } from '~/modules/process/ui/mappers/dashboardProcessExceptions.ui-mapper'
import type { DashboardGlobalAlertsVM } from '~/modules/process/ui/viewmodels/dashboard-global-alerts.vm'
import type { DashboardProcessExceptionVM } from '~/modules/process/ui/viewmodels/dashboard-process-exception.vm'
import { typedFetch } from '~/shared/api/typedFetch'
import { DashboardOperationalSummaryResponseSchema } from '~/shared/api-schemas/dashboard.schemas'
import {
  CreateProcessResponseSchema,
  ProcessResponseSchema,
} from '~/shared/api-schemas/processes.schemas'

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

export async function fetchDashboardOperationalSummary() {
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

export async function fetchDashboardProcessExceptions(): Promise<
  readonly DashboardProcessExceptionVM[]
> {
  const data = await fetchDashboardOperationalSummary()
  return toDashboardProcessExceptionVMs(data)
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
