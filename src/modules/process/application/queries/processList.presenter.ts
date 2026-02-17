import {
  containerStatusLabel,
  containerStatusToVariant,
} from '~/modules/tracking/application/projection/tracking.status.presenter'
import type { StatusVariant } from '~/shared/ui/StatusBadge'

type ProcessSummary = {
  readonly id: string
  readonly reference: string | null
  readonly origin?: { display_name?: string | null } | null
  readonly destination?: { display_name?: string | null } | null
  readonly containerCount: number
  readonly status: StatusVariant
  readonly statusLabel: string
  readonly eta: string | null
  readonly carrier: string | null
  readonly alertsCount: number
  readonly highestAlertSeverity: 'info' | 'warning' | 'danger' | null
  readonly hasTransshipment: boolean
  readonly lastEventAt: string | null
}

export type ProcessApiResponse = {
  id: string
  reference?: string | null
  origin?: { display_name?: string | null } | null
  destination?: { display_name?: string | null } | null
  carrier?: string | null
  bill_of_lading?: string | null
  booking_number?: string | null
  source: string
  created_at: string
  updated_at: string
  containers: Array<{
    id: string
    container_number: string
    carrier_code?: string | null
  }>
  process_status?: string | null
  eta?: string | null
  alerts_count?: number
  highest_alert_severity?: 'info' | 'warning' | 'danger' | null
  has_transshipment?: boolean
  last_event_at?: string | null
}

export function presentProcessList(data: ProcessApiResponse[]): readonly ProcessSummary[] {
  return data.map((p) => ({
    id: p.id,
    reference: p.reference ?? null,
    origin: p.origin,
    destination: p.destination,
    containerCount: p.containers.length,
    status: containerStatusToVariant(p.process_status ?? undefined),
    statusLabel: containerStatusLabel(p.process_status ?? undefined),
    eta: p.eta ?? null,
    carrier: p.carrier ?? null,
    alertsCount: p.alerts_count ?? 0,
    highestAlertSeverity: p.highest_alert_severity ?? null,
    hasTransshipment: p.has_transshipment ?? false,
    lastEventAt: p.last_event_at ?? null,
  }))
}
