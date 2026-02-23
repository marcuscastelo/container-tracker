import type { AlertDisplayVM } from '~/modules/process/ui/viewmodels/alert.vm'
import type { TrackingStatusCode } from '~/modules/tracking/application/projection/tracking.status.projection'
import type { TrackingTimelineItem } from '~/modules/tracking/application/projection/tracking.timeline.readmodel'
import type { StatusVariant } from '~/shared/ui/StatusBadge'

export type ContainerDetailVM = {
  readonly id: string
  readonly number: string
  readonly status: StatusVariant
  readonly statusCode: TrackingStatusCode
  readonly eta: string | null
  readonly timeline: readonly TrackingTimelineItem[]
}

export type ShipmentDetailVM = {
  readonly id: string
  readonly processRef: string
  readonly reference?: string | null
  readonly carrier?: string | null
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
  readonly statusCode: TrackingStatusCode
  readonly eta: string | null
  readonly containers: readonly ContainerDetailVM[]
  readonly alerts: readonly AlertDisplayVM[]
}
