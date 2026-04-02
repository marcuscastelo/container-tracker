import type { Snapshot } from '~/modules/tracking/domain/model/snapshot'
import type {
  Confidence,
  ObservationDraft,
} from '~/modules/tracking/features/observation/domain/model/observationDraft'
import type { ObservationType } from '~/modules/tracking/features/observation/domain/model/observationType'
import { toLookupMapKey } from '~/modules/tracking/infrastructure/carriers/normalizers/lookup-key'
import {
  type PilParsedEventRow,
  parsePilTrackingPayload,
} from '~/modules/tracking/infrastructure/carriers/normalizers/pil.parser'
import {
  buildDateOnlyTrackingTemporal,
  buildLocalDateTimeTrackingTemporal,
} from '~/modules/tracking/infrastructure/carriers/normalizers/tracking-temporal-resolution'
import { PilApiSchema } from '~/modules/tracking/infrastructure/carriers/schemas/api/pil.api.schema'
import type { TemporalValue } from '~/shared/time/temporal-value'

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

function toStructuredLocationCodeOrNull(value: string | null): string | null {
  if (value === null) return null
  const normalized = value.trim().toUpperCase()
  if (!/^[A-Z]{5}[A-Z0-9]{0,3}$/u.test(normalized)) {
    return null
  }

  if (normalized.length === 5) {
    return normalized
  }

  return /[0-9]/u.test(normalized) ? normalized : null
}

function toTemporalDateKey(value: TemporalValue | null): string | null {
  if (value === null) return null
  if (value.kind === 'date') return value.value.toIsoDate()
  if (value.kind === 'local-datetime') return value.value.toIsoLocalString().slice(0, 10)
  return value.value.toIsoString().slice(0, 10)
}

function toPilEventDateKey(
  eventDate: PilParsedEventRow['eventDate'],
  eventLocalDateTime: PilParsedEventRow['eventLocalDateTime'],
): string | null {
  if (eventDate !== null) return eventDate.toIsoDate()
  return eventLocalDateTime === null ? null : eventLocalDateTime.slice(0, 10)
}

function matchesPilText(left: string | null, right: string | null): boolean {
  if (left === null || right === null) return false
  return toLookupMapKey(left) === toLookupMapKey(right)
}

function resolvePilLocationCode(command: {
  readonly type: ObservationType
  readonly rawPlace: string | null
  readonly eventDateKey: string | null
  readonly summary: {
    readonly rawLoadPortName: string | null
    readonly rawLoadPortCode: string | null
    readonly rawNextLocationCode: string | null
    readonly nextLocationDate: TemporalValue | null
  } | null
}): string | null {
  const directCode = toStructuredLocationCodeOrNull(command.rawPlace)
  if (directCode !== null) return directCode

  const summary = command.summary
  if (summary === null) return null

  const loadPortCode = toStructuredLocationCodeOrNull(summary.rawLoadPortCode)
  const nextLocationCode = toStructuredLocationCodeOrNull(summary.rawNextLocationCode)
  const placeMatchesLoadPort = matchesPilText(command.rawPlace, summary.rawLoadPortName)

  if (
    loadPortCode !== null &&
    placeMatchesLoadPort &&
    (command.type === 'LOAD' || command.type === 'GATE_IN' || command.type === 'GATE_OUT')
  ) {
    return loadPortCode
  }

  if (command.type !== 'DISCHARGE' || nextLocationCode === null) {
    return null
  }

  const nextLocationDateKey = toTemporalDateKey(summary.nextLocationDate)
  const sameScheduledDay =
    command.eventDateKey !== null &&
    nextLocationDateKey !== null &&
    command.eventDateKey === nextLocationDateKey

  if (sameScheduledDay) {
    return nextLocationCode
  }

  if (!placeMatchesLoadPort) {
    return nextLocationCode
  }

  return null
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
  const summary = parsedPayload.value.summary

  for (const eventRow of parsedPayload.value.detailedEvents) {
    if (eventRow.eventTimeType === null || eventRow.rawEventName.trim().length === 0) {
      continue
    }

    const type = mapPilEventName(eventRow.rawEventName)
    const locationCode = resolvePilLocationCode({
      type,
      rawPlace: eventRow.rawPlace,
      eventDateKey: toPilEventDateKey(eventRow.eventDate, eventRow.eventLocalDateTime),
      summary,
    })
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
    const vesselName = isVesselEvent ? (eventRow.rawVessel ?? summary?.rawVessel ?? null) : null
    const voyage = isVesselEvent ? (eventRow.rawVoyage ?? summary?.rawVoyage ?? null) : null

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
        summary,
      },
    })
  }

  return drafts
}
