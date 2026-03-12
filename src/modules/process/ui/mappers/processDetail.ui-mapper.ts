import type { ProcessAggregatedStatus } from '~/modules/process/features/operational-projection/application/operationalSemantics'
import {
  createNeverContainerSyncVM,
  normalizeContainerNumber,
  toContainerSyncVM,
} from '~/modules/process/ui/mappers/containerSync.ui-mapper'
import {
  processStatusToVariant,
  toProcessStatusCode,
} from '~/modules/process/ui/mappers/processStatus.ui-mapper'
import { toProcessStatusMicrobadgeVM } from '~/modules/process/ui/mappers/processStatusMicrobadge.ui-mapper'
import { toAlertDisplayVMs } from '~/modules/process/ui/mappers/trackingAlert.ui-mapper'
import {
  toTrackingStatusCode,
  trackingStatusToVariant,
} from '~/modules/process/ui/mappers/trackingStatus.ui-mapper'
import type {
  ContainerObservationVM,
  ShipmentDetailVM,
} from '~/modules/process/ui/viewmodels/shipment.vm'
import type { TrackingTimelineItem } from '~/modules/tracking/features/timeline/application/projection/tracking.timeline.readmodel'
import type { ProcessDetailResponse } from '~/shared/api-schemas/processes.schemas'
import { DEFAULT_LOCALE } from '~/shared/localization/defaultLocale'
import { formatDateForLocale } from '~/shared/utils/formatDate'

function processAggregatedStatusToVariant(status: ProcessAggregatedStatus) {
  return processStatusToVariant(toProcessStatusCode(status))
}

type ContainerOperational = NonNullable<ProcessDetailResponse['containers'][number]['operational']>
type OperationalEta = NonNullable<ContainerOperational['eta']>
type OperationalTransshipment = ContainerOperational['transshipment']

type TimelineResponseItem = NonNullable<
  ProcessDetailResponse['containers'][number]['timeline']
>[number]
type ObservationResponseItem = NonNullable<
  ProcessDetailResponse['containers'][number]['observations']
>[number]

function toProcessAggregatedStatus(status: string | null | undefined): ProcessAggregatedStatus {
  const normalizedStatus = toProcessStatusCode(status)

  switch (normalizedStatus) {
    case 'UNKNOWN':
    case 'BOOKED':
    case 'IN_TRANSIT':
    case 'DISCHARGED':
    case 'DELIVERED':
    case 'AWAITING_DATA':
    case 'NOT_SYNCED':
      return normalizedStatus
    case 'IN_PROGRESS':
      return 'BOOKED'
    case 'LOADED':
    case 'ARRIVED_AT_POD':
      return 'IN_TRANSIT'
    case 'AVAILABLE_FOR_PICKUP':
      return 'DISCHARGED'
    case 'EMPTY_RETURNED':
      return 'DELIVERED'
  }
}

function toTimelineSeriesHistory(
  seriesHistory: TimelineResponseItem['series_history'],
): TrackingTimelineItem['seriesHistory'] {
  if (seriesHistory === null || seriesHistory === undefined) return undefined

  return {
    hasActualConflict: seriesHistory.has_actual_conflict,
    classified: seriesHistory.classified.map((entry) => ({
      id: entry.id,
      type: entry.type,
      event_time: entry.event_time,
      event_time_type: entry.event_time_type,
      created_at: entry.created_at,
      seriesLabel: entry.series_label,
    })),
  }
}

function toTimelineItem(item: TimelineResponseItem): TrackingTimelineItem {
  return {
    id: item.id,
    type: item.type,
    carrierLabel: item.carrier_label ?? undefined,
    location: item.location ?? undefined,
    eventTimeIso: item.event_time_iso,
    eventTimeType: item.event_time_type,
    derivedState: item.derived_state,
    vesselName: item.vessel_name,
    voyage: item.voyage,
    seriesHistory: toTimelineSeriesHistory(item.series_history),
  }
}

function toContainerObservationVm(item: ObservationResponseItem): ContainerObservationVM {
  return {
    id: item.id,
    type: item.type,
    eventTime: item.event_time,
    eventTimeType: item.event_time_type,
    locationCode: item.location_code,
    locationDisplay: item.location_display,
    vesselName: item.vessel_name,
    voyage: item.voyage,
    isEmpty: item.is_empty,
    provider: item.provider,
    carrierLabel: item.carrier_label ?? null,
    confidence: item.confidence,
    retroactive: item.retroactive ?? false,
    fingerprint: item.fingerprint,
    createdAt: item.created_at,
    createdFromSnapshotId: item.created_from_snapshot_id ?? null,
  }
}

function toEtaTone(
  state: OperationalEta['state'],
): ShipmentDetailVM['containers'][number]['etaChipVm']['tone'] {
  switch (state) {
    case 'ACTUAL':
      return 'positive'
    case 'ACTIVE_EXPECTED':
      return 'informative'
    case 'EXPIRED_EXPECTED':
      return 'warning'
  }
}

function toContainerEtaChipVm(
  eta: ContainerOperational['eta'] | undefined,
  locale: string,
): ShipmentDetailVM['containers'][number]['etaChipVm'] {
  if (!eta?.event_time) {
    return {
      state: 'UNAVAILABLE',
      tone: 'neutral',
      date: null,
    }
  }

  return {
    state: eta.state,
    tone: toEtaTone(eta.state),
    date: formatDateForLocale(eta.event_time, locale),
  }
}

function toContainerEtaDetailVm(
  eta: ContainerOperational['eta'] | undefined,
  locale: string,
): ShipmentDetailVM['containers'][number]['selectedEtaVm'] {
  if (!eta?.event_time) return null

  return {
    state: eta.state,
    tone: toEtaTone(eta.state),
    date: formatDateForLocale(eta.event_time, locale),
    type: eta.type,
  }
}

function toTransshipmentVm(
  transshipment: OperationalTransshipment | undefined,
): ShipmentDetailVM['containers'][number]['transshipment'] {
  if (!transshipment) {
    return {
      hasTransshipment: false,
      count: 0,
      ports: [],
    }
  }

  return {
    hasTransshipment: transshipment.has_transshipment,
    count: transshipment.count,
    ports: transshipment.ports.map((port) => ({
      code: port.code,
      display: port.display,
    })),
  }
}

function toTsChipVm(
  transshipment: ShipmentDetailVM['containers'][number]['transshipment'],
): ShipmentDetailVM['containers'][number]['tsChipVm'] {
  const portsTooltip =
    transshipment.ports.length > 0
      ? transshipment.ports
          .map((port) => (port.display ? `${port.code} (${port.display})` : port.code))
          .join(', ')
      : null

  return {
    visible: transshipment.hasTransshipment && transshipment.count > 0,
    count: transshipment.count,
    portsTooltip,
  }
}

function toProcessEtaSecondaryVm(
  data: ProcessDetailResponse,
  containers: readonly ShipmentDetailVM['containers'][number][],
  locale: string,
): ShipmentDetailVM['processEtaSecondaryVm'] {
  const total = data.process_operational?.coverage.eligible_total ?? containers.length
  const withEta =
    data.process_operational?.coverage.with_eta ?? containers.filter((c) => c.selectedEtaVm).length
  const etaMax = data.process_operational?.eta_max ?? null

  return {
    visible: containers.length > 1 && total > 0,
    date: etaMax?.event_time ? formatDateForLocale(etaMax.event_time, locale) : null,
    withEta,
    total,
    incomplete: total > 0 && withEta < total,
  }
}

export function toShipmentDetailVM(
  data: ProcessDetailResponse,
  locale: string = DEFAULT_LOCALE,
): ShipmentDetailVM {
  const referenceNow = new Date()
  const syncByContainerNumber = new Map(
    data.containersSync.map((containerSync) => [
      normalizeContainerNumber(containerSync.containerNumber),
      toContainerSyncVM(containerSync, referenceNow),
    ]),
  )

  const containers = data.containers.map((container) => {
    const observations = (container.observations ?? []).map(toContainerObservationVm)
    const timeline = (container.timeline ?? []).map(toTimelineItem)

    if (timeline.length === 0) {
      timeline.push({
        id: 'system-created',
        type: 'SYSTEM_CREATED',
        location: undefined,
        eventTimeIso: data.created_at,
        eventTimeType: 'ACTUAL',
        derivedState: 'ACTUAL',
      })
    }

    const statusCode = toTrackingStatusCode(container.status)
    const etaChipVm = toContainerEtaChipVm(container.operational?.eta, locale)
    const selectedEtaVm = toContainerEtaDetailVm(container.operational?.eta, locale)
    const etaApplicable =
      container.operational?.eta_applicable ??
      container.operational?.lifecycle_bucket === 'pre_arrival'
    const transshipment = toTransshipmentVm(container.operational?.transshipment)
    const sync =
      syncByContainerNumber.get(normalizeContainerNumber(container.container_number)) ??
      createNeverContainerSyncVM(container.container_number)

    return {
      id: container.id,
      number: container.container_number,
      carrierCode: container.carrier_code ?? null,
      status: trackingStatusToVariant(statusCode),
      statusCode,
      sync,
      eta: null,
      etaApplicable,
      etaChipVm,
      selectedEtaVm,
      tsChipVm: toTsChipVm(transshipment),
      dataIssueChipVm: {
        visible: container.operational?.data_issue === true,
      },
      transshipment,
      observations,
      timeline,
    }
  })

  const processAggregatedStatus = toProcessAggregatedStatus(
    data.process_operational?.derived_status,
  )
  const processEtaSecondaryVm = toProcessEtaSecondaryVm(data, containers, locale)

  return {
    id: data.id,
    processRef: data.reference || `<${data.id.slice(0, 8)}>`,
    reference: data.reference,
    carrier: data.carrier ?? null,
    bill_of_lading: data.bill_of_lading,
    booking_number: data.booking_number,
    importer_name: data.importer_name,
    exporter_name: data.exporter_name,
    reference_importer: data.reference_importer,
    product: data.product,
    redestination_number: data.redestination_number,
    origin: data.origin?.display_name || '—',
    destination: data.destination?.display_name || '—',
    status: processAggregatedStatusToVariant(processAggregatedStatus),
    statusCode: toProcessStatusCode(processAggregatedStatus),
    statusMicrobadge: toProcessStatusMicrobadgeVM(data.process_operational?.status_microbadge),
    eta: processEtaSecondaryVm.date,
    processEtaSecondaryVm,
    containers,
    alerts: toAlertDisplayVMs(data.alerts ?? [], locale),
  }
}
