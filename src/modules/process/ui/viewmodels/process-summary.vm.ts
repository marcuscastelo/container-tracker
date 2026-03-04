import type { TrackingStatusCode } from '~/modules/tracking/application/projection/tracking.status.projection'
import type { StatusVariant } from '~/shared/ui/StatusBadge'

export type ProcessSummaryVM = {
  readonly id: string
  readonly reference: string | null
  readonly origin?: { display_name?: string | null } | null
  readonly destination?: { display_name?: string | null } | null
  readonly importerId: string | null
  readonly importerName: string | null
  readonly containerCount: number
  readonly status: StatusVariant
  readonly statusCode: TrackingStatusCode
  /** When the API provides a process-level aggregated status (e.g. PARTIALLY_DELIVERED),
   * it's exposed here so the UI can render/process it without breaking existing
   * mappers that expect canonical container tracking codes.
   */
  readonly aggregatedStatus?: 'PARTIALLY_DELIVERED' | null
  readonly statusRank: number
  readonly eta: string | null
  readonly etaMsOrNull: number | null
  readonly carrier: string | null
  readonly alertsCount: number
  readonly highestAlertSeverity: 'info' | 'warning' | 'danger' | null
  readonly hasTransshipment: boolean
  readonly lastEventAt: string | null
}
