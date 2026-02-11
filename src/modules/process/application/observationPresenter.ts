import type { EventStatus, TimelineEvent } from '~/modules/process/application/uiTypes'
import type { ObservationResponse } from '~/shared/api-schemas/processes.schemas'
import { formatDateForLocale } from '~/shared/utils/formatDate'

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
 * Convert an observation (from API) into a TimelineEvent for the UI.
 */
export function observationToTimelineEvent(obs: ObservationResponse, index: number): TimelineEvent {
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
