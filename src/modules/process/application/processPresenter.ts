import { type Carrier, CarrierSchema } from '~/modules/process/domain/value-objects'
import type {
  ObservationResponse,
  ProcessDetailResponse,
  TrackingAlertResponse,
} from '~/shared/api-schemas/processes.schemas'
import type { StatusVariant } from '~/shared/ui'
import { formatDateForLocale } from '~/shared/utils/formatDate'

// Backwards-compatible alias for tests and other callers
export type ProcessApiResponse = ProcessDetailResponse

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

/**
 * Map domain ContainerStatus (from tracking pipeline) to UI StatusVariant.
 */
function containerStatusToVariant(status: string | undefined): StatusVariant {
  switch (status) {
    case 'IN_TRANSIT':
      return 'in-transit'
    case 'LOADED':
      return 'loaded'
    case 'ARRIVED_AT_POD':
    case 'DISCHARGED':
    case 'AVAILABLE_FOR_PICKUP':
      return 'released'
    case 'DELIVERED':
    case 'EMPTY_RETURNED':
      return 'delivered'
    case 'IN_PROGRESS':
      return 'pending'
    default:
      return 'unknown'
  }
}

/**
 * Map domain ContainerStatus to a human-readable label.
 */
function containerStatusLabel(status: string | undefined): string {
  switch (status) {
    case 'IN_TRANSIT':
      return 'In Transit'
    case 'LOADED':
      return 'Loaded'
    case 'ARRIVED_AT_POD':
      return 'Arrived at POD'
    case 'DISCHARGED':
      return 'Discharged'
    case 'AVAILABLE_FOR_PICKUP':
      return 'Available for Pickup'
    case 'DELIVERED':
      return 'Delivered'
    case 'EMPTY_RETURNED':
      return 'Empty Returned'
    case 'IN_PROGRESS':
      return 'In Progress'
    default:
      return 'Awaiting data'
  }
}

/**
 * Map ObservationType to a human-readable label for timeline display.
 */
function observationTypeLabel(type: string): string {
  switch (type) {
    case 'GATE_IN':
      return 'Gate In'
    case 'GATE_OUT':
      return 'Gate Out'
    case 'LOAD':
      return 'Loaded on Vessel'
    case 'DEPARTURE':
      return 'Vessel Departed'
    case 'ARRIVAL':
      return 'Arrived at Port'
    case 'DISCHARGE':
      return 'Discharged from Vessel'
    case 'DELIVERY':
      return 'Delivered'
    case 'EMPTY_RETURN':
      return 'Empty Returned'
    case 'CUSTOMS_HOLD':
      return 'Customs Hold'
    case 'CUSTOMS_RELEASE':
      return 'Customs Released'
    default:
      return type
  }
}

/**
 * Map TrackingAlertType to AlertDisplay type.
 */
function alertTypeToDisplay(type: string): AlertDisplay['type'] {
  switch (type) {
    case 'TRANSSHIPMENT':
      return 'transshipment'
    case 'CUSTOMS_HOLD':
      return 'customs'
    case 'ETA_MISSING':
    case 'ETA_PASSED':
      return 'missing-eta'
    case 'NO_MOVEMENT':
      return 'delay'
    default:
      return 'info'
  }
}

/**
 * Map TrackingAlertSeverity to AlertDisplay severity.
 */
function alertSeverityToDisplay(severity: string): AlertDisplay['severity'] {
  if (severity === 'warning' || severity === 'danger' || severity === 'info') {
    return severity
  }
  return 'info'
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  return `${diffDays}d ago`
}

/**
 * Convert an observation (from API) into a TimelineEvent for the UI.
 */
function observationToTimelineEvent(obs: ObservationResponse, index: number): TimelineEvent {
  const evDate = obs.event_time ? new Date(obs.event_time) : null
  const dateStr = evDate ? formatDateForLocale(evDate) : null
  const eventTimeType = obs.event_time_type ?? 'EXPECTED'
  const isExpected = eventTimeType === 'EXPECTED'
  const expectedDate = isExpected && evDate ? formatDateForLocale(evDate) : undefined

  const dateIso = obs.event_time ?? null
  const expectedDateIso = isExpected && obs.event_time ? obs.event_time : undefined

  // Build location display
  const location = obs.location_display ?? obs.location_code ?? undefined

  // Build label with vessel info if available
  let label = observationTypeLabel(obs.type)
  if (obs.vessel_name) {
    label += ` — ${obs.vessel_name}`
    if (obs.voyage) label += ` (${obs.voyage})`
  }

  const status: EventStatus = isExpected ? 'expected' : 'completed'

  return {
    id: obs.id ?? `obs-${index}`,
    label,
    location,
    date: isExpected ? null : dateStr,
    date_iso: isExpected ? null : dateIso,
    expectedDate,
    expectedDate_iso: expectedDateIso,
    status,
    eventTimeType,
  }
}

/**
 * Convert a TrackingAlertResponse into an AlertDisplay for the UI.
 */
function alertToDisplay(alert: TrackingAlertResponse): AlertDisplay {
  return {
    id: alert.id,
    type: alertTypeToDisplay(alert.type),
    severity: alertSeverityToDisplay(alert.severity),
    message: alert.message,
    timestamp: formatRelativeTime(alert.triggered_at),
    category: alert.category === 'fact' ? 'fact' : 'monitoring',
    retroactive: alert.retroactive,
  }
}

/**
 * Derive the highest-dominance status from all containers.
 * Uses the same dominance logic as the tracking domain.
 */
function deriveProcessStatus(containers: readonly { status?: string }[]): {
  variant: StatusVariant
  label: string
} {
  const dominance = [
    'UNKNOWN',
    'IN_PROGRESS',
    'LOADED',
    'IN_TRANSIT',
    'ARRIVED_AT_POD',
    'DISCHARGED',
    'AVAILABLE_FOR_PICKUP',
    'DELIVERED',
    'EMPTY_RETURNED',
  ]

  let highest = 'UNKNOWN'
  let highestIdx = 0

  for (const c of containers) {
    const s = c.status ?? 'UNKNOWN'
    const idx = dominance.indexOf(s)
    if (idx > highestIdx) {
      highest = s
      highestIdx = idx
    }
  }

  return {
    variant: containerStatusToVariant(highest),
    label: containerStatusLabel(highest),
  }
}

export function presentProcess(data: ProcessDetailResponse): ShipmentDetail {
  const carrierResult = CarrierSchema.safeParse(data.carrier)
  const carrier: Carrier | 'unknown' | null =
    data.carrier === null ? null : carrierResult.success ? carrierResult.data : 'unknown'

  const containers: ContainerDetail[] = data.containers.map((c) => {
    // Build timeline from observations (new pipeline)
    const observations = c.observations ?? []
    const timeline: TimelineEvent[] = observations.map((obs, idx) =>
      observationToTimelineEvent(obs, idx),
    )

    // If no observations, show a "process registered" placeholder
    if (timeline.length === 0) {
      timeline.push({
        id: 'system-created',
        label: 'Process registered in the system',
        location: undefined,
        date: formatDateForLocale(new Date(data.created_at)),
        date_iso: data.created_at,
        status: 'completed',
        eventTimeType: 'ACTUAL', // System-generated event is ACTUAL
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
