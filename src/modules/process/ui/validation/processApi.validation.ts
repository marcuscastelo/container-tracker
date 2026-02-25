import type { CreateProcessInput } from '~/modules/process/interface/http/process.schemas'
import type { CreateProcessDialogFormData } from '~/modules/process/ui/CreateProcessDialog'
import { toProcessSummaryVMs } from '~/modules/process/ui/mappers/processList.ui-mapper'
import type { ProcessSummaryVM } from '~/modules/process/ui/viewmodels/process-summary.vm'
import { typedFetch } from '~/shared/api/typedFetch'
import {
  CreateProcessResponseSchema,
  ProcessListResponseSchema,
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

export async function fetchDashboardProcessSummaries(): Promise<readonly ProcessSummaryVM[]> {
  const data = await typedFetch('/api/processes', undefined, ProcessListResponseSchema)
  return toProcessSummaryVMs(data)
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
