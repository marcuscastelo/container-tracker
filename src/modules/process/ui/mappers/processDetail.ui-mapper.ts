import type { ProcessAggregatedStatus } from '~/modules/process/features/operational-projection/application/operationalSemantics'
import { toAlertIncidentsVm } from '~/modules/process/ui/mappers/alertIncident.ui-mapper'
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
import { toOptionalNonBlankString } from '~/modules/process/ui/mappers/toOptionalNonBlankString'
import { toAlertDisplayVMs } from '~/modules/process/ui/mappers/trackingAlert.ui-mapper'
import {
  toTrackingStatusCode,
  trackingStatusToVariant,
} from '~/modules/process/ui/mappers/trackingStatus.ui-mapper'
import type { ShipmentDetailVM } from '~/modules/process/ui/viewmodels/shipment.vm'
import type {
  ContainerTrackingValidationVM,
  ProcessTrackingValidationVM,
  TrackingValidationIssueVM,
} from '~/modules/process/ui/viewmodels/tracking-review.vm'
import type { TrackingTimelineItem } from '~/modules/tracking/features/timeline/application/projection/tracking.timeline.readmodel'
import type { ProcessDetailResponse } from '~/shared/api-schemas/processes.schemas'
import { DEFAULT_LOCALE } from '~/shared/localization/defaultLocale'
import { systemClock } from '~/shared/time/clock'
import { toInstantDto } from '~/shared/time/dto'
import { Instant } from '~/shared/time/instant'
import { formatDateForLocale } from '~/shared/utils/formatDate'

function processAggregatedStatusToVariant(status: ProcessAggregatedStatus) {
  return processStatusToVariant(toProcessStatusCode(status))
}

type ContainerOperational = NonNullable<ProcessDetailResponse['containers'][number]['operational']>
type OperationalEta = NonNullable<ContainerOperational['eta']>
type OperationalTransshipment = ContainerOperational['transshipment']
type OperationalCurrentContext = ContainerOperational['current_context']
type OperationalNextLocation = ContainerOperational['next_location']
type ContainerTrackingValidationResponse =
  ProcessDetailResponse['containers'][number]['tracking_validation']
type ContainerTrackingContainmentResponse =
  ProcessDetailResponse['containers'][number]['tracking_containment']
type ProcessTrackingValidationResponse = ProcessDetailResponse['tracking_validation']

type TimelineResponseItem = NonNullable<
  ProcessDetailResponse['containers'][number]['timeline']
>[number]

type TrackingValidationIssueResponse = NonNullable<
  ProcessDetailResponse['tracking_validation']['top_issue']
>

function toProcessAggregatedStatus(status: string | null | undefined): ProcessAggregatedStatus {
  const normalizedStatus = toProcessStatusCode(status)

  switch (normalizedStatus) {
    case 'UNKNOWN':
    case 'BOOKED':
    case 'IN_TRANSIT':
    case 'ARRIVED_AT_POD':
    case 'DISCHARGED':
    case 'DELIVERED':
    case 'AWAITING_DATA':
    case 'NOT_SYNCED':
      return normalizedStatus
    case 'IN_PROGRESS':
      return 'BOOKED'
    case 'LOADED':
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
    ...(seriesHistory.conflict === null || seriesHistory.conflict === undefined
      ? {}
      : {
          conflict: {
            kind: seriesHistory.conflict.kind,
            fields: [...seriesHistory.conflict.fields],
          },
        }),
    classified: seriesHistory.classified.map((entry) => ({
      id: entry.id,
      type: entry.type,
      event_time: entry.event_time,
      event_time_type: entry.event_time_type,
      created_at: entry.created_at,
      seriesLabel: entry.series_label,
      ...(entry.vessel_name === undefined ? {} : { vesselName: entry.vessel_name }),
      ...(entry.voyage === undefined ? {} : { voyage: entry.voyage }),
      ...(entry.change_kind === undefined ? {} : { changeKind: entry.change_kind }),
    })),
  }
}

function toTimelineItem(item: TimelineResponseItem): TrackingTimelineItem {
  const seriesHistory = toTimelineSeriesHistory(item.series_history)

  return {
    id: item.id,
    observationId: item.observation_id,
    type: item.type,
    eventTime: item.event_time,
    eventTimeType: item.event_time_type,
    derivedState: item.derived_state,
    hasSeriesHistory: item.has_series_history,
    ...(item.carrier_label === null || item.carrier_label === undefined
      ? {}
      : { carrierLabel: item.carrier_label }),
    ...(item.location === null || item.location === undefined ? {} : { location: item.location }),
    ...(item.vessel_name === undefined ? {} : { vesselName: item.vessel_name }),
    ...(item.voyage === undefined ? {} : { voyage: item.voyage }),
    ...(item.series_conflict === null || item.series_conflict === undefined
      ? {}
      : {
          seriesConflict: {
            kind: item.series_conflict.kind,
            fields: [...item.series_conflict.fields],
          },
        }),
    ...(seriesHistory === undefined ? {} : { seriesHistory }),
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

function toDateEtaChipVm(
  eta: OperationalEta,
  locale: string,
): ShipmentDetailVM['containers'][number]['etaChipVm'] {
  return {
    state: eta.state,
    tone: toEtaTone(eta.state),
    date: formatDateForLocale(eta.event_time, locale),
  }
}

function toContainerEtaChipVm(
  etaDisplay: ContainerOperational['eta_display'] | undefined,
  eta: ContainerOperational['eta'] | undefined,
  locale: string,
): ShipmentDetailVM['containers'][number]['etaChipVm'] {
  if (etaDisplay?.kind === 'delivered') {
    return {
      state: 'DELIVERED',
      tone: 'positive',
      date: null,
    }
  }

  if (etaDisplay?.kind === 'unavailable') {
    return {
      state: 'UNAVAILABLE',
      tone: 'neutral',
      date: null,
    }
  }

  if (!eta?.event_time) {
    return {
      state: 'UNAVAILABLE',
      tone: 'neutral',
      date: null,
    }
  }

  return toDateEtaChipVm(eta, locale)
}

function toContainerEtaDetailVm(
  etaDisplay: ContainerOperational['eta_display'] | undefined,
  eta: ContainerOperational['eta'] | undefined,
  locale: string,
): ShipmentDetailVM['containers'][number]['selectedEtaVm'] {
  if (etaDisplay?.kind === 'delivered' || etaDisplay?.kind === 'unavailable') {
    return null
  }

  if (!eta?.event_time) return null

  return {
    state: eta.state,
    tone: toEtaTone(eta.state),
    date: formatDateForLocale(eta.event_time, locale),
    type: eta.type,
  }
}

function toProcessEtaDisplayVm(
  processOperational: ProcessDetailResponse['process_operational'],
  locale: string,
): ShipmentDetailVM['processEtaDisplayVm'] {
  const etaDisplay = processOperational?.eta_display
  if (etaDisplay?.kind === 'delivered') {
    return { kind: 'delivered' }
  }

  if (etaDisplay?.kind === 'date' || etaDisplay?.kind === 'arrived') {
    return {
      kind: etaDisplay.kind,
      date: formatDateForLocale(etaDisplay.value, locale),
    }
  }

  if (processOperational?.eta_max?.event_time) {
    return {
      kind: 'date',
      date: formatDateForLocale(processOperational.eta_max.event_time, locale),
    }
  }

  return { kind: 'unavailable' }
}

function toProcessEtaDate(
  processEtaDisplayVm: ShipmentDetailVM['processEtaDisplayVm'],
): string | null {
  if (processEtaDisplayVm.kind === 'date' || processEtaDisplayVm.kind === 'arrived') {
    return processEtaDisplayVm.date
  }

  return null
}

function toCurrentContextVm(
  currentContext: OperationalCurrentContext | undefined,
): ShipmentDetailVM['containers'][number]['currentContext'] {
  if (!currentContext) {
    return {
      locationCode: null,
      locationDisplay: null,
      vesselName: null,
      voyage: null,
      vesselVisible: true,
    }
  }

  return {
    locationCode: currentContext.location_code,
    locationDisplay: currentContext.location_display,
    vesselName: currentContext.vessel_name,
    voyage: currentContext.voyage,
    vesselVisible: currentContext.vessel_visible,
  }
}

function toNextLocationVm(
  nextLocation: OperationalNextLocation | undefined,
  locale: string,
): ShipmentDetailVM['containers'][number]['nextLocation'] {
  if (!nextLocation?.event_time) return null

  return {
    date: formatDateForLocale(nextLocation.event_time, locale),
    type: nextLocation.type,
    eventTimeType: nextLocation.event_time_type,
    locationCode: nextLocation.location_code,
    locationDisplay: nextLocation.location_display,
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

function toProcessTrackingValidationVm(
  trackingValidation: ProcessTrackingValidationResponse | undefined,
): ProcessTrackingValidationVM {
  return {
    hasIssues: trackingValidation?.has_issues === true,
    highestSeverity: trackingValidation?.highest_severity ?? null,
    affectedContainerCount: trackingValidation?.affected_container_count ?? 0,
    topIssue: toTrackingValidationIssueVm(trackingValidation?.top_issue),
  }
}

function toTrackingValidationIssueVm(
  issue: TrackingValidationIssueResponse | null | undefined,
): TrackingValidationIssueVM | null {
  if (issue === null || issue === undefined) {
    return null
  }

  return {
    code: issue.code,
    severity: issue.severity,
    reasonKey: issue.reason_key,
    affectedArea: issue.affected_area,
    affectedLocation: issue.affected_location ?? null,
    affectedBlockLabelKey: issue.affected_block_label_key ?? null,
  }
}

function toContainerTrackingValidationVm(
  trackingValidation: ContainerTrackingValidationResponse | undefined,
): ContainerTrackingValidationVM {
  return {
    hasIssues: trackingValidation?.has_issues === true,
    highestSeverity: trackingValidation?.highest_severity ?? null,
    findingCount: trackingValidation?.finding_count ?? 0,
    activeIssues: (trackingValidation?.active_issues ?? [])
      .map((issue) => toTrackingValidationIssueVm(issue))
      .filter((issue): issue is TrackingValidationIssueVM => issue !== null),
  }
}

function toContainerTrackingContainmentVm(
  trackingContainment: ContainerTrackingContainmentResponse,
): ShipmentDetailVM['containers'][number]['trackingContainment'] {
  if (trackingContainment === null) {
    return null
  }

  return {
    active: true,
    reasonCode: trackingContainment.reason_code,
    activatedAt: trackingContainment.activated_at,
    externalTrackingUrl: trackingContainment.external_tracking_url,
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
  processOperational: ProcessDetailResponse['process_operational'],
  containers: readonly ShipmentDetailVM['containers'][number][],
  processEtaDisplayVm: ShipmentDetailVM['processEtaDisplayVm'],
): ShipmentDetailVM['processEtaSecondaryVm'] {
  const total = processOperational?.coverage.eligible_total ?? containers.length
  const withEta =
    processOperational?.coverage.with_eta ?? containers.filter((c) => c.selectedEtaVm).length

  return {
    visible: containers.length > 1 && total > 0,
    date: toProcessEtaDate(processEtaDisplayVm),
    withEta,
    total,
    incomplete: total > 0 && withEta < total,
  }
}

export function toShipmentDetailVM(
  data: ProcessDetailResponse,
  locale: string = DEFAULT_LOCALE,
): ShipmentDetailVM {
  const referenceNow = systemClock.now()
  const syncByContainerNumber = new Map(
    data.containersSync.map((containerSync) => [
      normalizeContainerNumber(containerSync.containerNumber),
      toContainerSyncVM(containerSync, referenceNow),
    ]),
  )

  const containers = data.containers.map((container) => {
    const timeline = (container.timeline ?? []).map(toTimelineItem)

    if (timeline.length === 0) {
      timeline.push({
        id: 'system-created',
        type: 'SYSTEM_CREATED',
        eventTime: toInstantDto(Instant.fromIso(data.created_at)),
        eventTimeType: 'ACTUAL',
        derivedState: 'ACTUAL',
      })
    }

    const statusCode = toTrackingStatusCode(container.status)
    const etaChipVm = toContainerEtaChipVm(
      container.operational?.eta_display,
      container.operational?.eta,
      locale,
    )
    const selectedEtaVm = toContainerEtaDetailVm(
      container.operational?.eta_display,
      container.operational?.eta,
      locale,
    )
    const etaApplicable =
      container.operational?.eta_applicable ??
      container.operational?.lifecycle_bucket === 'pre_arrival'
    const transshipment = toTransshipmentVm(container.operational?.transshipment)
    const currentContext = toCurrentContextVm(container.operational?.current_context)
    const nextLocation = toNextLocationVm(container.operational?.next_location, locale)
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
      currentContext,
      nextLocation,
      tsChipVm: toTsChipVm(transshipment),
      dataIssueChipVm: {
        visible: container.operational?.data_issue === true,
      },
      trackingContainment: toContainerTrackingContainmentVm(container.tracking_containment ?? null),
      trackingValidation: toContainerTrackingValidationVm(container.tracking_validation),
      transshipment,
      timeline,
    }
  })

  const processAggregatedStatus = toProcessAggregatedStatus(
    data.process_operational?.derived_status,
  )
  const processEtaDisplayVm = toProcessEtaDisplayVm(data.process_operational, locale)
  const processEtaSecondaryVm = toProcessEtaSecondaryVm(
    data.process_operational,
    containers,
    processEtaDisplayVm,
  )

  return {
    id: data.id,
    trackingFreshnessToken: data.tracking_freshness_token,
    processRef: data.reference || `<${data.id.slice(0, 8)}>`,
    reference: data.reference ?? null,
    carrier: data.carrier ?? null,
    bill_of_lading: data.bill_of_lading ?? null,
    booking_number: data.booking_number ?? null,
    importer_name: data.importer_name ?? null,
    exporter_name: data.exporter_name ?? null,
    reference_importer: data.reference_importer ?? null,
    depositary: data.depositary ?? null,
    product: data.product ?? null,
    redestination_number: toOptionalNonBlankString(data.redestination_number),
    origin: data.origin?.display_name || '—',
    destination: data.destination?.display_name || '—',
    status: processAggregatedStatusToVariant(processAggregatedStatus),
    statusCode: toProcessStatusCode(processAggregatedStatus),
    statusMicrobadge: toProcessStatusMicrobadgeVM(data.process_operational?.status_microbadge),
    eta: toProcessEtaDate(processEtaDisplayVm),
    processEtaDisplayVm,
    processEtaSecondaryVm,
    trackingValidation: toProcessTrackingValidationVm(data.tracking_validation),
    containers,
    alerts: [],
    alertIncidents: toAlertIncidentsVm(data.operational_incidents),
  }
}
