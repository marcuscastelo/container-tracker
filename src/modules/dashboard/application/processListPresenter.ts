import type { StatusVariant } from '~/shared/ui/StatusBadge'

export type ProcessSummary = {
  readonly id: string
  readonly reference: string | null
  readonly origin?: { display_name?: string | null } | null
  readonly destination?: { display_name?: string | null } | null
  readonly containerCount: number
  readonly status: StatusVariant
  readonly statusLabel: string
  readonly eta: string | null
  readonly carrier: string | null
}

export type ProcessApiResponse = {
  id: string
  reference?: string | null
  operation_type: string
  origin?: { display_name?: string | null } | null
  destination?: { display_name?: string | null } | null
  carrier?: string | null
  bill_of_lading?: string | null
  source: string
  created_at: string
  updated_at: string
  containers: Array<{
    id: string
    container_number: string
    carrier_code?: string | null
    container_type?: string | null
    container_size?: string | null
  }>
}

export function presentProcessList(data: ProcessApiResponse[]): readonly ProcessSummary[] {
  return data.map((p) => ({
    id: p.id,
    reference: p.reference ?? null,
    origin: p.origin,
    destination: p.destination,
    containerCount: p.containers.length,
    // Dashboard list view doesn't have observation data yet.
    // Status will remain 'unknown' until we add a summary endpoint
    // or include derived status in the process list API response.
    status: 'unknown',
    statusLabel: 'Awaiting data',
    eta: null,
    carrier: p.carrier ?? null,
  }))
}
