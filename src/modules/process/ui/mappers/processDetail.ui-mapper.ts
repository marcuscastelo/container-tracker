import { deriveProcessStatusFromContainers } from '~/modules/process/application/operational-projection/deriveProcessStatus'
import { toOperationalStatus } from '~/modules/process/application/operational-projection/operationalSemantics'
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

function deriveProcessStatusCode(
  containers: readonly { readonly status?: string }[],
): ReturnType<typeof toTrackingStatusCode> {
  const statuses = containers.map((container) => toOperationalStatus(container.status))
  const highest = deriveProcessStatusFromContainers(statuses)
  return toTrackingStatusCode(highest)
}

export function toShipmentDetailVM(
  data: ProcessDetailResponse,
  locale: string = 'en-US',
): ShipmentDetailVM {
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

    return {
      id: container.id,
      number: container.container_number,
      status: trackingStatusToVariant(statusCode),
      statusCode,
      eta: null,
      timeline,
    }
  })

  const processStatusCode = deriveProcessStatusCode(data.containers)

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
    status: trackingStatusToVariant(processStatusCode),
    statusCode: processStatusCode,
    eta: null,
    containers,
    alerts: toAlertDisplayVMs(
      (data.alerts ?? []).filter((alert) => alert.acked_at === null && alert.dismissed_at === null),
      locale,
    ),
  }
}
