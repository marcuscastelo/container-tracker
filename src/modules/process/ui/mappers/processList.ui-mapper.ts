import {
  toTrackingStatusCode,
  trackingStatusToRank,
  trackingStatusToVariant,
} from '~/modules/process/ui/mappers/trackingStatus.ui-mapper'
import type { ProcessSummaryVM } from '~/modules/process/ui/viewmodels/process-summary.vm'

export type ProcessListItemSource = {
  id: string
  reference?: string | null
  origin?: { display_name?: string | null } | null
  destination?: { display_name?: string | null } | null
  carrier?: string | null
  importer_id?: string | null
  importer_name?: string | null
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

function toOptionalNonBlankString(value: string | null | undefined): string | null {
  if (value == null) return null
  return value.trim().length > 0 ? value : null
}

function toTimestampOrNull(value: string | null | undefined): number | null {
  if (!value) return null
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? null : parsed
}

export function toProcessSummaryVMs(
  data: readonly ProcessListItemSource[],
): readonly ProcessSummaryVM[] {
  return data.map((process) => {
    const statusCode = toTrackingStatusCode(process.process_status)
    const eta = process.eta ?? null

    return {
      id: process.id,
      reference: process.reference ?? null,
      origin: process.origin,
      destination: process.destination,
      importerId: toOptionalNonBlankString(process.importer_id),
      importerName: toOptionalNonBlankString(process.importer_name),
      containerCount: process.containers.length,
      status: trackingStatusToVariant(statusCode),
      statusCode,
      statusRank: trackingStatusToRank(statusCode),
      eta,
      etaMsOrNull: toTimestampOrNull(eta),
      carrier: process.carrier ?? null,
      alertsCount: process.alerts_count ?? 0,
      highestAlertSeverity: process.highest_alert_severity ?? null,
      hasTransshipment: process.has_transshipment ?? false,
      lastEventAt: process.last_event_at ?? null,
    }
  })
}
