import { deriveProcessStatusFromContainers } from '~/modules/process/application/operational-projection/deriveProcessStatus'
import type {
  ContainerDetail,
  ShipmentDetail,
} from '~/modules/process/application/shipment.readmodel'
import { CARRIERS, type Carrier } from '~/modules/process/domain/identity/value-objects'
import type { AlertDisplay } from '~/modules/tracking/application/projection/tracking.alert.presenter'
import { alertToDisplay } from '~/modules/tracking/application/projection/tracking.alert.presenter'
import {
  containerStatusLabel,
  containerStatusToVariant,
} from '~/modules/tracking/application/projection/tracking.status.presenter'
import {
  deriveTimelineWithSeriesReadModel,
  type TrackingTimelineItem,
} from '~/modules/tracking/application/projection/tracking.timeline.readmodel'
import {
  CONTAINER_STATUSES,
  type ContainerStatus,
} from '~/modules/tracking/domain/model/containerStatus'
import type { ProcessDetailResponse } from '~/shared/api-schemas/processes.schemas'
import type { StatusVariant } from '~/shared/ui/StatusBadge'

function isContainerStatus(s: unknown): s is ContainerStatus {
  return typeof s === 'string' && CONTAINER_STATUSES.some((cs) => cs === s)
}

function isCarrier(s: unknown): s is Carrier {
  return typeof s === 'string' && CARRIERS.some((c) => c === s)
}

/**
 * Derive the highest-dominance status from all containers.
 * Delegates to the shared Application-layer function.
 */
function deriveProcessStatus(containers: readonly { status?: string }[]): {
  variant: StatusVariant
  label: string
} {
  const statuses: ContainerStatus[] = containers.map((c) => {
    const s = c.status
    if (isContainerStatus(s)) {
      return s
    }
    return 'UNKNOWN'
  })

  const highest = deriveProcessStatusFromContainers(statuses)

  return {
    variant: containerStatusToVariant(highest),
    label: containerStatusLabel(highest),
  }
}

export function presentProcess(data: ProcessDetailResponse): ShipmentDetail {
  let carrier: Carrier | null
  if (data.carrier === null) {
    carrier = null
  } else if (isCarrier(data.carrier)) {
    carrier = data.carrier
  } else {
    carrier = 'unknown'
  }

  const containers: ContainerDetail[] = data.containers.map((c) => {
    // Build timeline from observations using event series projection
    const observations = c.observations ?? []
    const timeline: TrackingTimelineItem[] = deriveTimelineWithSeriesReadModel(observations)

    // If no observations, show a "process registered" placeholder
    if (timeline.length === 0) {
      timeline.push({
        id: 'system-created',
        type: 'SYSTEM_CREATED',
        location: undefined,
        event_time_iso: data.created_at,
        event_time_type: 'ACTUAL',
        derivedState: 'ACTUAL',
      })
    }

    return {
      id: c.id,
      number: c.container_number,
      status: containerStatusToVariant(c.status),
      statusLabel: containerStatusLabel(c.status),
      eta: null, // ETA will be derived from timeline in future iterations
      timeline,
    }
  })

  // Derive process-level status from container statuses
  const processStatus = deriveProcessStatus(data.containers)

  // Map alerts — filter out dismissed/acked
  const alerts: AlertDisplay[] = (data.alerts ?? [])
    .filter((a) => a.acked_at === null && a.dismissed_at === null)
    .map(alertToDisplay)

  return {
    id: data.id,
    processRef: data.reference || `<${data.id.slice(0, 8)}>`,
    reference: data.reference,
    carrier,
    bill_of_lading: data.bill_of_lading,
    booking_number: data.booking_number,
    importer_name: data.importer_name,
    exporter_name: data.exporter_name,
    reference_importer: data.reference_importer,
    product: data.product,
    redestination_number: data.redestination_number,
    origin: data.origin?.display_name || '—',
    destination: data.destination?.display_name || '—',
    status: processStatus.variant,
    statusLabel: processStatus.label,
    eta: null, // ETA derivation is a future iteration
    containers,
    alerts,
  }
}
