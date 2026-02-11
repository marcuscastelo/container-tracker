import type { Carrier } from '~/modules/process/domain/value-objects'
import type { StatusVariant } from '~/shared/ui/StatusBadge'

// Presenter: convert ProcessApiResponse (API) into ShipmentDetail (UI shape)
export type EventStatus = 'completed' | 'current' | 'expected' | 'delayed'

export type TimelineEvent = {
  readonly id: string
  readonly label: string
  readonly location?: string
  readonly date: string | null
  readonly date_iso?: string | null
  readonly expectedDate?: string | null
  readonly expectedDate_iso?: string | null
  readonly status: EventStatus
  /** Whether this is an ACTUAL (confirmed) or EXPECTED (predicted) event */
  readonly eventTimeType: 'ACTUAL' | 'EXPECTED'
  /** Optional i18n key for system-generated events that should be translated in UI */
  readonly labelKey?: string
}

export type AlertDisplay = {
  readonly id: string
  readonly type: 'delay' | 'customs' | 'missing-eta' | 'transshipment' | 'info'
  readonly severity: 'info' | 'warning' | 'danger'
  readonly message: string
  readonly timestamp: string
  readonly category: 'fact' | 'monitoring'
  readonly retroactive: boolean
}

export type ContainerDetail = {
  readonly id: string
  readonly number: string
  readonly status: StatusVariant
  readonly statusLabel: string
  readonly eta: string | null
  readonly timeline: readonly TimelineEvent[]
}

export type ShipmentDetail = {
  readonly id: string
  readonly processRef: string
  readonly reference?: string | null
  readonly carrier?: Carrier | null
  readonly bill_of_lading?: string | null
  readonly booking_number?: string | null
  readonly importer_name?: string | null
  readonly exporter_name?: string | null
  readonly reference_importer?: string | null
  readonly product?: string | null
  readonly redestination_number?: string | null
  readonly origin: string
  readonly destination: string
  readonly status: StatusVariant
  readonly statusLabel: string
  readonly eta: string | null
  readonly containers: readonly ContainerDetail[]
  readonly alerts: readonly AlertDisplay[]
}
