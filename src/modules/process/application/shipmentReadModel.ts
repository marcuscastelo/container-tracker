import type { Carrier } from '~/modules/process/domain/value-objects'
import type { AlertDisplay } from '~/modules/tracking/application/alertPresenter'
import type { TimelineEvent } from '~/modules/tracking/application/timelinePresenter'
import type { StatusVariant } from '~/shared/ui/StatusBadge'

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
  readonly carrier?: Carrier | 'unknown' | null
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
