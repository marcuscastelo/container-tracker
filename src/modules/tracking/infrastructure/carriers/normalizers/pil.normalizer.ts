import type { Snapshot } from '~/modules/tracking/domain/model/snapshot'
import type {
  Confidence,
  ObservationDraft,
} from '~/modules/tracking/features/observation/domain/model/observationDraft'
import type { ObservationType } from '~/modules/tracking/features/observation/domain/model/observationType'
import { toLookupMapKey } from '~/modules/tracking/infrastructure/carriers/normalizers/lookup-key'
import { parsePilTrackingPayload } from '~/modules/tracking/infrastructure/carriers/normalizers/pil.parser'
import {
  buildDateOnlyTrackingTemporal,
  buildLocalDateTimeTrackingTemporal,
} from '~/modules/tracking/infrastructure/carriers/normalizers/tracking-temporal-resolution'
import { PilApiSchema } from '~/modules/tracking/infrastructure/carriers/schemas/api/pil.api.schema'

const PIL_EVENT_MAP: Record<string, ObservationType> = {
  'o/b empty container released': 'GATE_OUT',
  'truck gate in to o/b terminal': 'GATE_IN',
  'vessel loading': 'LOAD',
  'vessel discharge': 'DISCHARGE',
  'truck gate out from i/b terminal': 'GATE_OUT',
  'i/b empty container returned': 'EMPTY_RETURN',
}

function mapPilEventName(eventName: string): ObservationType {
  if (eventName.length === 0) return 'OTHER'
  const key = toLookupMapKey(eventName)
  return PIL_EVENT_MAP[key] ?? 'OTHER'
}

function toCarrierLabelOrNull(label: string): string | null {
  return label.trim().length > 0 ? label : null
}

function toLocationCodeOrNull(rawPlace: string | null): string | null {
  if (rawPlace === null) return null
  const normalized = rawPlace.trim().toUpperCase()
  return /^[A-Z]{5}$/u.test(normalized) ? normalized : null
}

function computeConfidence(
  eventTime: ObservationDraft['event_time'],
  locationCode: string | null,
  locationDisplay: string | null,
  type: ObservationType,
): Confidence {
  if (eventTime === null) return 'low'
  if (type === 'OTHER') return 'medium'
  if (locationCode !== null || locationDisplay !== null) return 'high'
  return 'medium'
}

export function normalizePilSnapshot(snapshot: Snapshot): ObservationDraft[] {
  const parseResult = PilApiSchema.safeParse(snapshot.payload)
  if (!parseResult.success) {
    return []
  }

  const parsedPayload = parsePilTrackingPayload(parseResult.data)
  if (!parsedPayload.ok) {
    return []
  }

  const containerNumber = parsedPayload.value.containerNumber?.trim().toUpperCase() ?? 'UNKNOWN'
  const drafts: ObservationDraft[] = []

  for (const eventRow of parsedPayload.value.detailedEvents) {
    if (eventRow.eventTimeType === null || eventRow.rawEventName.trim().length === 0) {
      continue
    }

    const type = mapPilEventName(eventRow.rawEventName)
    const locationCode = toLocationCodeOrNull(eventRow.rawPlace)
    const locationDisplay = eventRow.rawPlace
    const temporal =
      eventRow.eventLocalDateTime !== null
        ? buildLocalDateTimeTrackingTemporal({
            localDateTime: eventRow.eventLocalDateTime,
            rawEventTime: eventRow.rawEventTimeText,
            locationCode,
            locationDisplay,
          })
        : buildDateOnlyTrackingTemporal({
            date: eventRow.eventDate,
            rawEventTime: eventRow.rawEventTimeText,
            locationCode,
            locationDisplay,
          })
    const isVesselEvent =
      type === 'LOAD' || type === 'DISCHARGE' || type === 'DEPARTURE' || type === 'ARRIVAL'
    const vesselName = isVesselEvent ? eventRow.rawVessel : null
    const voyage = isVesselEvent ? eventRow.rawVoyage : null

    drafts.push({
      container_number: containerNumber,
      type,
      event_time: temporal.event_time,
      event_time_type: eventRow.eventTimeType,
      location_code: locationCode,
      location_display: locationDisplay,
      vessel_name: vesselName,
      voyage,
      is_empty: null,
      confidence: computeConfidence(temporal.event_time, locationCode, locationDisplay, type),
      provider: 'pil',
      snapshot_id: snapshot.id,
      carrier_label: toCarrierLabelOrNull(eventRow.rawEventName),
      raw_event_time: temporal.raw_event_time ?? null,
      event_time_source: temporal.event_time_source ?? null,
      raw_event: {
        ...eventRow,
        summary: parsedPayload.value.summary,
      },
    })
  }

  return drafts
}
