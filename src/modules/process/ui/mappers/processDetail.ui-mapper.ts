import { deriveProcessStatusFromContainers } from '~/modules/process/application/operational-projection/deriveProcessStatus'
import type { ProcessAggregatedStatus } from '~/modules/process/application/operational-projection/operationalSemantics'
import { toOperationalStatus } from '~/modules/process/application/operational-projection/operationalSemantics'
import {
  createNeverContainerSyncVM,
  normalizeContainerNumber,
  toContainerSyncVM,
} from '~/modules/process/ui/mappers/containerSync.ui-mapper'
import { toAlertDisplayVMs } from '~/modules/process/ui/mappers/trackingAlert.ui-mapper'
import {
  toTrackingStatusCode,
  trackingStatusToVariant,
} from '~/modules/process/ui/mappers/trackingStatus.ui-mapper'
import type { ShipmentDetailVM } from '~/modules/process/ui/viewmodels/shipment.vm'
import { toTrackingObservationDTOs } from '~/modules/tracking/application/projection/tracking.observation.dto'
import {
  deriveTimelineWithSeriesReadModel,
  type TrackingTimelineItem,
} from '~/modules/tracking/application/projection/tracking.timeline.readmodel'
import type { ProcessDetailResponse } from '~/shared/api-schemas/processes.schemas'
import type { StatusVariant } from '~/shared/ui/StatusBadge'
import { formatDateForLocale } from '~/shared/utils/formatDate'

function processAggregatedStatusToVariant(status: ProcessAggregatedStatus): StatusVariant {
  if (status === 'PARTIALLY_DELIVERED') return 'partial'
  return trackingStatusToVariant(toTrackingStatusCode(status))
}

function deriveProcessStatus(
  containers: readonly { readonly status?: string }[],
): ProcessAggregatedStatus {
  const statuses = containers.map((container) => toOperationalStatus(container.status))
  return deriveProcessStatusFromContainers(statuses)
}

type ContainerOperational = NonNullable<ProcessDetailResponse['containers'][number]['operational']>
type OperationalEta = NonNullable<ContainerOperational['eta']>
type OperationalTransshipment = ContainerOperational['transshipment']

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
  const total = data.process_operational?.coverage.total ?? containers.length
  const withEta =
    data.process_operational?.coverage.with_eta ?? containers.filter((c) => c.selectedEtaVm).length
  const etaMax = data.process_operational?.eta_max ?? null

  return {
    visible: containers.length > 1,
    date: etaMax?.event_time ? formatDateForLocale(etaMax.event_time, locale) : null,
    withEta,
    total,
    incomplete: withEta < total,
  }
}

export function toShipmentDetailVM(
  data: ProcessDetailResponse,
  locale: string = 'en-US',
): ShipmentDetailVM {
  const referenceNow = new Date()
  const syncByContainerNumber = new Map(
    data.containersSync.map((containerSync) => [
      normalizeContainerNumber(containerSync.containerNumber),
      toContainerSyncVM(containerSync, locale, referenceNow),
    ]),
  )

  const containers = data.containers.map((container) => {
    const observations = toTrackingObservationDTOs(container.observations ?? [])
    const timeline: TrackingTimelineItem[] = deriveTimelineWithSeriesReadModel(observations)

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
      etaChipVm,
      selectedEtaVm,
      tsChipVm: toTsChipVm(transshipment),
      dataIssueChipVm: {
        visible: container.operational?.data_issue === true,
      },
      transshipment,
      timeline,
    }
  })

  const processAggregatedStatus = deriveProcessStatus(data.containers)
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
    // canonical container-level status code (UNKNOWN if not a container status)
    statusCode: toTrackingStatusCode(processAggregatedStatus),
    // expose the raw process-level aggregated status when applicable
    aggregatedStatus:
      processAggregatedStatus === 'PARTIALLY_DELIVERED' ? 'PARTIALLY_DELIVERED' : null,
    eta: processEtaSecondaryVm.date,
    processEtaSecondaryVm,
    containers,
    alerts: toAlertDisplayVMs(
      (data.alerts ?? []).filter((alert) => alert.acked_at === null && alert.dismissed_at === null),
      locale,
    ),
  }
}
