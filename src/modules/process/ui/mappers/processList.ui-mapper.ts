import {
  toTrackingStatusCode,
  trackingStatusToRank,
  trackingStatusToVariant,
} from '~/modules/process/ui/mappers/trackingStatus.ui-mapper'
import { TRACKING_STATUS_CODES } from '~/modules/tracking/application/projection/tracking.status.projection'
import type { TrackingStatusCode } from '~/modules/tracking/application/projection/tracking.status.projection'
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
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
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
    // Preserve the aggregated process status when present (e.g. PARTIALLY_DELIVERED)
    const rawStatus = process.process_status ?? null
    const eta = process.eta ?? null
    // canonical statusCode used by most UI mappers (falls back to UNKNOWN)
    const statusCode = toTrackingStatusCode(rawStatus)
    const aggregatedStatus = rawStatus === 'PARTIALLY_DELIVERED' ? 'PARTIALLY_DELIVERED' : null

    return {
      id: process.id,
      reference: process.reference ?? null,
      origin: process.origin,
      destination: process.destination,
      importerId: toOptionalNonBlankString(process.importer_id),
      importerName: toOptionalNonBlankString(process.importer_name),
      containerCount: process.containers.length,
      status: trackingStatusToVariant(aggregatedStatus ?? statusCode),
      statusCode,
      aggregatedStatus: aggregatedStatus,
      // compute a sensible rank: use the canonical tracking rank when the code
      // is one of the container statuses; for PARTIALLY_DELIVERED use the same
      // rank as DELIVERED to position it appropriately in sorted lists.
      statusRank:
        TRACKING_STATUS_CODES.includes(statusCode as TrackingStatusCode)
          ? trackingStatusToRank(statusCode as TrackingStatusCode)
          : aggregatedStatus === 'PARTIALLY_DELIVERED'
          ? trackingStatusToRank('DELIVERED')
          : 0,
      eta,
      etaMsOrNull: toTimestampOrNull(eta),
      carrier: toOptionalNonBlankString(process.carrier),
      alertsCount: process.alerts_count ?? 0,
      highestAlertSeverity: process.highest_alert_severity ?? null,
      hasTransshipment: process.has_transshipment ?? false,
      lastEventAt: process.last_event_at ?? null,
    }
  })
}
