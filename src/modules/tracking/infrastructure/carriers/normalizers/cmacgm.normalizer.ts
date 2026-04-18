import type { Snapshot } from '~/modules/tracking/domain/model/snapshot'
import type {
  Confidence,
  EventTimeType,
  ObservationDraft,
} from '~/modules/tracking/features/observation/domain/model/observationDraft'
import type { ObservationType } from '~/modules/tracking/features/observation/domain/model/observationType'
import { toLookupMapKey } from '~/modules/tracking/infrastructure/carriers/normalizers/lookup-key'
import {
  buildAbsoluteTrackingTemporal,
  buildDateOnlyTrackingTemporal,
  buildLocalDateTimeTrackingTemporal,
  composeTrackingRawEventTime,
} from '~/modules/tracking/infrastructure/carriers/normalizers/tracking-temporal-resolution'
import { CmaCgmApiSchema } from '~/modules/tracking/infrastructure/carriers/schemas/api/cmacgm.api.schema'
import { CalendarDate } from '~/shared/time/calendar-date'
import { systemClock } from '~/shared/time/clock'
import { parseInstantFromIso } from '~/shared/time/parsing'
import { parseMsDateString } from '~/shared/utils/parseDate'

/**
 * Maps CMA-CGM `StatusDescription` strings to canonical ObservationType.
 *
 * CMA-CGM status descriptions observed in real payloads:
 *   - "Gate in"          → GATE_IN
 *   - "Gate out"         → GATE_OUT
 *   - "Loaded on board"  → LOAD
 *   - "Discharged"       → DISCHARGE
 *   - "Departure"        → DEPARTURE
 *   - "Arrival"          → ARRIVAL
 *   - "Delivered"        → DELIVERY
 *
 * This mapping will grow as we see more CMA-CGM event types.
 */
const CMACGM_STATUS_MAP: Record<string, ObservationType> = {
  // Gate / yard events
  'gate in': 'GATE_IN',
  'gate out': 'GATE_OUT',
  'empty to shipper': 'GATE_OUT',
  'received for export transfer': 'GATE_IN',
  'ready to be loaded': 'GATE_IN',

  // Load / discharge
  'loaded on board': 'LOAD',
  load: 'LOAD',
  loaded: 'LOAD',
  discharged: 'DISCHARGE',
  discharge: 'DISCHARGE',
  'discharged in transhipment': 'DISCHARGE',

  // Departure / arrival
  departure: 'DEPARTURE',
  'vessel departure': 'DEPARTURE',
  'train departure': 'DEPARTURE',
  arrival: 'ARRIVAL',
  'vessel arrival': 'ARRIVAL',
  'train arrival': 'ARRIVAL',

  // Delivery / return
  delivered: 'DELIVERY',
  delivery: 'DELIVERY',
  'container to consignee': 'DELIVERY',
  'empty return': 'EMPTY_RETURN',
  'empty in depot': 'EMPTY_RETURN',
  'container returned empty': 'EMPTY_RETURN',
  'devolucao de conteiner vazio': 'EMPTY_RETURN',

  // Customs
  'customs hold': 'CUSTOMS_HOLD',
  'customs release': 'CUSTOMS_RELEASE',
}

function mapCmaCgmDescription(description: string | null | undefined): ObservationType {
  if (!description) return 'OTHER'
  const key = toLookupMapKey(description)
  return CMACGM_STATUS_MAP[key] ?? 'OTHER'
}

function toCarrierLabelOrNull(label: string | null | undefined): string | null {
  if (typeof label !== 'string') return null
  // Preserve original provider text for audit/UI transparency;
  // only use trim to detect blank values.
  return label.trim().length > 0 ? label : null
}

const MONTHS_BY_ABBREVIATION = new Map<string, number>([
  ['JAN', 1],
  ['FEB', 2],
  ['MAR', 3],
  ['APR', 4],
  ['MAY', 5],
  ['JUN', 6],
  ['JUL', 7],
  ['AUG', 8],
  ['SEP', 9],
  ['OCT', 10],
  ['NOV', 11],
  ['DEC', 12],
])

const CMA_DATE_TEXT_PATTERN = /(?:[A-Z]{3,9}[,\s]+)?(\d{1,2})-([A-Z]{3})-(\d{4})/iu
const CMA_ISO_DATE_PREFIX_PATTERN = /^(\d{4})-(\d{2})-(\d{2})(?:\b|T)/u
const CMA_TIME_TEXT_PATTERN = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/iu
const LBBEY_LOCATION_CODE = 'LBBEY'
const LBBEY_LOCATION_DISPLAY_FALLBACK = 'BEIRUT'

function toTrimmedOrNull(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length === 0 ? null : trimmed
}

function resolveCmaCgmTemporalLocationContext(
  locationCode: string | null | undefined,
  locationDisplay: string | null | undefined,
): {
  readonly locationCode: string | null
  readonly locationDisplay: string | null
} {
  const normalizedCode = toTrimmedOrNull(locationCode)?.toUpperCase() ?? null
  const normalizedDisplay = toTrimmedOrNull(locationDisplay)

  if (
    normalizedCode === LBBEY_LOCATION_CODE &&
    (normalizedDisplay === null || !/BEIRUT/iu.test(normalizedDisplay))
  ) {
    return {
      locationCode: normalizedCode,
      locationDisplay: LBBEY_LOCATION_DISPLAY_FALLBACK,
    }
  }

  return {
    locationCode: normalizedCode,
    locationDisplay: normalizedDisplay,
  }
}

function parseCmaCgmCalendarDate(value: string): CalendarDate | null {
  const normalized = value.trim()
  const isoPrefixMatch = normalized.match(CMA_ISO_DATE_PREFIX_PATTERN)
  if (
    isoPrefixMatch &&
    isoPrefixMatch[1] !== undefined &&
    isoPrefixMatch[2] !== undefined &&
    isoPrefixMatch[3] !== undefined
  ) {
    try {
      return CalendarDate.fromIsoDate(
        `${isoPrefixMatch[1]}-${isoPrefixMatch[2]}-${isoPrefixMatch[3]}`,
      )
    } catch {
      return null
    }
  }

  const match = normalized.match(CMA_DATE_TEXT_PATTERN)
  if (!match || match[1] === undefined || match[2] === undefined || match[3] === undefined) {
    return null
  }

  const month = MONTHS_BY_ABBREVIATION.get(match[2].toUpperCase())
  if (month === undefined) return null

  try {
    return CalendarDate.fromIsoDate(
      `${String(Number(match[3])).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(
        Number(match[1]),
      ).padStart(2, '0')}`,
    )
  } catch {
    return null
  }
}

function parseCmaCgmMeridiemTime(value: string): string | null {
  const match = value.trim().match(CMA_TIME_TEXT_PATTERN)
  if (!match || match[1] === undefined || match[2] === undefined || match[3] === undefined) {
    return null
  }

  const baseHour = Number(match[1])
  const minute = Number(match[2])
  if (!Number.isInteger(baseHour) || baseHour < 1 || baseHour > 12) return null
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) return null

  let hour = baseHour % 12
  if (match[3].toUpperCase() === 'PM') {
    hour += 12
  }

  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00.000`
}

function parseCmaCgmExplicitAbsoluteInstant(
  value: string | null | undefined,
): ReturnType<typeof parseInstantFromIso> {
  const normalized = toTrimmedOrNull(value)
  if (normalized === null) return null

  const msDate = parseMsDateString(normalized)
  if (msDate !== null) return msDate

  return parseInstantFromIso(normalized)
}

/**
 * Parse CMA-CGM date strings.
 *
 * CMA-CGM uses Microsoft-style "\/Date(1764659520000)\/" format
 * and sometimes plain date strings in DateString field.
 */
function parseCmaCgmDate(
  dateField: string | null | undefined,
  dateStringField: string | null | undefined,
  timeStringField: string | null | undefined,
  locationCode: string | null | undefined,
  locationDisplay: string | null | undefined,
): Pick<ObservationDraft, 'event_time' | 'raw_event_time' | 'event_time_source'> {
  const normalizedDateField = toTrimmedOrNull(dateField)
  const rawEventTime =
    composeTrackingRawEventTime(dateStringField, timeStringField) ?? normalizedDateField
  const temporalLocationContext = resolveCmaCgmTemporalLocationContext(
    locationCode,
    locationDisplay,
  )

  if (dateStringField) {
    const parsedDate = parseCmaCgmCalendarDate(dateStringField)
    if (parsedDate) {
      if (timeStringField) {
        const parsedTime = parseCmaCgmMeridiemTime(timeStringField)
        if (parsedTime) {
          return buildLocalDateTimeTrackingTemporal({
            localDateTime: `${parsedDate.toIsoDate()}T${parsedTime}`,
            rawEventTime,
            locationCode: temporalLocationContext.locationCode,
            locationDisplay: temporalLocationContext.locationDisplay,
          })
        }
      }

      return buildDateOnlyTrackingTemporal({
        date: parsedDate,
        rawEventTime,
        locationCode: temporalLocationContext.locationCode,
        locationDisplay: temporalLocationContext.locationDisplay,
      })
    }
  }

  const explicitAbsoluteInstant = parseCmaCgmExplicitAbsoluteInstant(normalizedDateField)
  if (explicitAbsoluteInstant !== null) {
    return buildAbsoluteTrackingTemporal({
      instant: explicitAbsoluteInstant,
      rawEventTime,
    })
  }

  return {
    event_time: null,
    raw_event_time: rawEventTime,
    event_time_source: null,
  }
}

function computeConfidence(
  eventTime: ObservationDraft['event_time'],
  state: string | null | undefined,
  locationCode: string | null | undefined,
): Confidence {
  if (!eventTime) return 'low'
  if (state?.toUpperCase() === 'NONE') return 'medium' // provisional/future
  if (!locationCode) return 'medium'
  return 'high'
}

/**
 * Map CMA-CGM event to EventTimeType.
 *
 * CMA-CGM does not explicitly provide ACTUAL vs EXPECTED in their API.
 * Default to EXPECTED as per the canonical rules.
 *
 * @see Issue: Canonical differentiation between ACTUAL vs EXPECTED
 */
function mapCmaCgmEventTimeType(
  state?: string | null | undefined,
  eventTime?: ObservationDraft['event_time'],
): EventTimeType {
  // CMA-CGM doesn't provide an explicit enum for ACTUAL vs EXPECTED, but
  // the payload _does_ contain a `State` field with values like
  // - "DONE" (past/finalized)
  // - "CURRENT" (currently happening)
  // - "NONE" (provisional / future)
  // Use that when present. As a best-effort fallback, also consider the
  // presence of an event time and whether it's in the past.

  // No event time — treat as predicted/expected
  if (!eventTime) return 'EXPECTED'

  const s = state?.toUpperCase() ?? ''
  if (s === 'DONE' || s === 'CURRENT') return 'ACTUAL'
  if (s === 'NONE') return 'EXPECTED'

  // Fallback: if the event time is in the past (<= now) consider it ACTUAL,
  // otherwise EXPECTED. This helps when carriers omit the State field.
  if (eventTime?.kind === 'instant') {
    if (eventTime.value.compare(systemClock.now()) <= 0) return 'ACTUAL'
  }

  if (eventTime?.kind === 'date') {
    if (eventTime.value.compare(systemClock.now().toCalendarDate('UTC')) <= 0) return 'ACTUAL'
  }

  return 'EXPECTED'
}

/**
 * Normalize a CMA-CGM snapshot payload into ObservationDrafts.
 *
 * @param snapshot - The snapshot record (must have provider='cmacgm')
 * @returns Array of ObservationDraft — may be empty if parsing fails
 */
export function normalizeCmaCgmSnapshot(snapshot: Snapshot): ObservationDraft[] {
  const parseResult = CmaCgmApiSchema.safeParse(snapshot.payload)
  if (!parseResult.success) {
    return []
  }

  const cmacgmData = parseResult.data
  const containerNumber = cmacgmData.ContainerReference?.toUpperCase() ?? 'UNKNOWN'

  const drafts: ObservationDraft[] = []

  // Process all move arrays: PastMoves, CurrentMoves, ProvisionalMoves
  const allMoves = [
    ...(cmacgmData.PastMoves ?? []),
    ...(cmacgmData.CurrentMoves ?? []),
    ...(cmacgmData.ProvisionalMoves ?? []),
  ]

  for (const move of allMoves) {
    const type = mapCmaCgmDescription(move.StatusDescription)
    const temporal = parseCmaCgmDate(
      move.Date,
      move.DateString,
      move.TimeString,
      move.LocationCode,
      move.Location,
    )
    const eventTime = temporal.event_time
    const locationCode = move.LocationCode ?? null
    const locationDisplay = move.Location ?? null
    const vesselName = move.Vessel ?? null
    const voyage = move.Voyage ?? null

    const isVesselEvent =
      type === 'LOAD' || type === 'DISCHARGE' || type === 'DEPARTURE' || type === 'ARRIVAL'
    const finalVesselName = isVesselEvent ? vesselName : null
    const finalVoyage = isVesselEvent ? voyage : null

    const confidence = computeConfidence(eventTime, move.State, locationCode)
    const eventTimeType = mapCmaCgmEventTimeType(move.State, eventTime)

    const draft: ObservationDraft = {
      container_number: containerNumber,
      type,
      event_time: eventTime,
      event_time_type: eventTimeType,
      location_code: locationCode,
      location_display: locationDisplay,
      vessel_name: finalVesselName,
      voyage: finalVoyage,
      is_empty: null, // CMA-CGM doesn't provide empty/laden info in this format
      confidence,
      provider: 'cmacgm',
      snapshot_id: snapshot.id,
      carrier_label: toCarrierLabelOrNull(move.StatusDescription),
      raw_event_time: temporal.raw_event_time ?? null,
      event_time_source: temporal.event_time_source ?? null,
      raw_event: move,
    }

    drafts.push(draft)
  }

  return drafts
}
