import type { ProcessStatusCode } from '~/modules/process/ui/process-status-color'
import type { AlertDisplayVM } from '~/modules/process/ui/viewmodels/alert.vm'
import type { ProcessStatusMicrobadgeVM } from '~/modules/process/ui/viewmodels/process-status-microbadge.vm'
import type { TrackingStatusCode } from '~/modules/tracking/features/status/application/projection/tracking.status.projection'
import type { TrackingTimelineItem } from '~/modules/tracking/features/timeline/application/projection/tracking.timeline.readmodel'
import type { StatusVariant } from '~/shared/ui/StatusBadge'

export type EtaChipState = 'ACTUAL' | 'ACTIVE_EXPECTED' | 'EXPIRED_EXPECTED' | 'UNAVAILABLE'
export type EtaChipTone = 'positive' | 'informative' | 'warning' | 'neutral'

export type ContainerEtaChipVM = {
  readonly state: EtaChipState
  readonly tone: EtaChipTone
  readonly date: string | null
}

export type ContainerEtaDetailVM = {
  readonly state: Exclude<EtaChipState, 'UNAVAILABLE'>
  readonly tone: EtaChipTone
  readonly date: string
  readonly type: string
} | null

type ContainerTransshipmentPortVM = {
  readonly code: string
  readonly display: string | null
}

export type ContainerTransshipmentVM = {
  readonly hasTransshipment: boolean
  readonly count: number
  readonly ports: readonly ContainerTransshipmentPortVM[]
}

export type ContainerTsChipVM = {
  readonly visible: boolean
  readonly count: number
  readonly portsTooltip: string | null
}

export type ContainerDataIssueChipVM = {
  readonly visible: boolean
}

export type ContainerSyncState = 'syncing' | 'ok' | 'error' | 'never'

export type ContainerSyncVM = {
  readonly containerNumber: string
  readonly carrier: string | null
  readonly state: ContainerSyncState
  readonly relativeTimeAt: string | null
  readonly isStale: boolean
}

export type ContainerDetailVM = {
  readonly id: string
  readonly number: string
  readonly carrierCode: string | null
  readonly status: StatusVariant
  readonly statusCode: TrackingStatusCode
  readonly sync: ContainerSyncVM
  readonly eta: string | null
  readonly etaApplicable?: boolean
  readonly etaChipVm: ContainerEtaChipVM
  readonly selectedEtaVm: ContainerEtaDetailVM
  readonly tsChipVm: ContainerTsChipVM
  readonly dataIssueChipVm: ContainerDataIssueChipVM
  readonly transshipment: ContainerTransshipmentVM
  readonly timeline: readonly TrackingTimelineItem[]
}

export type ProcessEtaSecondaryVM = {
  readonly visible: boolean
  readonly date: string | null
  readonly withEta: number
  readonly total: number
  readonly incomplete: boolean
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
  readonly statusCode: ProcessStatusCode
  readonly statusMicrobadge: ProcessStatusMicrobadgeVM | null
  readonly eta: string | null
  readonly processEtaSecondaryVm: ProcessEtaSecondaryVM
  readonly containers: readonly ContainerDetailVM[]
  readonly alerts: readonly AlertDisplayVM[]
}
