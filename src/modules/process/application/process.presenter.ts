import type {
  ContainerDetail,
  ShipmentDetail,
} from '~/modules/process/application/shipment.readmodel'
import { deriveProcessStatusFromContainers } from '~/modules/process/application/projections/deriveProcessStatus'
import { type Carrier, CarrierSchema } from '~/modules/process/domain/value-objects'
import type { AlertDisplay } from '~/modules/tracking/application/tracking.alert.presenter'
import { alertToDisplay } from '~/modules/tracking/application/tracking.alert.presenter'
import {
  containerStatusLabel,
  containerStatusToVariant,
} from '~/modules/tracking/application/tracking.status.presenter'
import type { TimelineEvent } from '~/modules/tracking/application/tracking.timeline.presenter'
import { deriveTimelineWithSeries } from '~/modules/tracking/application/tracking.timeline.presenter'
import type { ContainerStatus } from '~/modules/tracking/domain/containerStatus'
import { ContainerStatusSchema } from '~/modules/tracking/domain/containerStatus'
import type { ProcessDetailResponse } from '~/shared/api-schemas/processes.schemas'
import type { StatusVariant } from '~/shared/ui/StatusBadge'
import { formatDateForLocale } from '~/shared/utils/formatDate'

/**
 * Derive the highest-dominance status from all containers.
 * Delegates to the shared Application-layer function.
 */
function deriveProcessStatus(containers: readonly { status?: string }[]): {
  variant: StatusVariant
  label: string
} {
  const statuses: ContainerStatus[] = containers.map((c) => {
    const parsed = ContainerStatusSchema.safeParse(c.status)
    return parsed.success ? parsed.data : 'UNKNOWN'
  })

  const highest = deriveProcessStatusFromContainers(statuses)

  return {
    variant: containerStatusToVariant(highest),
    label: containerStatusLabel(highest),
  }
}

export function presentProcess(data: ProcessDetailResponse): ShipmentDetail {
  const carrierResult = CarrierSchema.safeParse(data.carrier)
  let carrier: Carrier | 'unknown' | null
  if (data.carrier === null) {
    carrier = null
  } else if (carrierResult.success) {
    carrier = carrierResult.data
  } else {
    carrier = 'unknown'
  }

  const containers: ContainerDetail[] = data.containers.map((c) => {
    // Build timeline from observations using event series projection
    const observations = c.observations ?? []
    const timeline: TimelineEvent[] = deriveTimelineWithSeries(observations)

    // If no observations, show a "process registered" placeholder
    if (timeline.length === 0) {
      timeline.push({
        id: 'system-created',
        label: 'Process registered in the system', // fallback for non-i18n consumers
        labelKey: 'shipmentView.timeline.systemCreated', // i18n key for UI
        location: undefined,
        date: formatDateForLocale(new Date(data.created_at)),
        date_iso: data.created_at,
        status: 'completed',
        eventTimeType: 'ACTUAL', // System-generated event is ACTUAL
        derivedState: 'ACTUAL', // System-generated event is ACTUAL
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
