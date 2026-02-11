import type { ObservationResponse } from '~/shared/api-schemas/processes.schemas'
import { formatDateForLocale } from '~/shared/utils/formatDate'

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
  /** Optional i18n key for system-generated events that should be translated in UI */
  readonly labelKey?: string
}

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
  let label = (() => {
    switch (obs.type) {
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
        return obs.type
    }
  })()

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
