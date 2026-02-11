import type {
  Confidence,
  EventTimeType,
  ObservationDraft,
} from '~/modules/tracking/domain/observationDraft'
import type { ObservationType } from '~/modules/tracking/domain/observationType'
import type { Snapshot } from '~/modules/tracking/domain/snapshot'
import { CmaCgmApiSchema } from '~/modules/tracking/infrastructure/schemas/api/cmacgm.api.schema'
import { parseIsoOrRfcString, parseMsDateString } from '~/shared/utils/parseDate'

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
  'empty return': 'EMPTY_RETURN',

  // Customs
  'customs hold': 'CUSTOMS_HOLD',
  'customs release': 'CUSTOMS_RELEASE',
}

function mapCmaCgmDescription(description: string | null | undefined): ObservationType {
  if (!description) return 'OTHER'
  const key = description.toLowerCase().trim()
  return CMACGM_STATUS_MAP[key] ?? 'OTHER'
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
): string | null {
  // Try DateString first (human-readable ISO/RFC) — many CMA-CGM endpoints provide ISO strings here
  if (dateStringField) {
    const d = parseIsoOrRfcString(dateStringField)
    if (d) return d.toISOString()
  }

  // Try MS date format: /Date(1234567890000)/
  if (dateField) {
    const ms = parseMsDateString(dateField)
    if (ms) return ms.toISOString()

    // Fallback: try ISO/RFC parsing on the field
    const d = parseIsoOrRfcString(dateField)
    if (d) return d.toISOString()
  }

  return null
}

function computeConfidence(
  eventTime: string | null,
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
  eventTime?: string | null,
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
  try {
    const d = new Date(eventTime)
    if (!Number.isNaN(d.getTime())) {
      if (d.getTime() <= Date.now()) return 'ACTUAL'
    }
  } catch (_e) {
    // ignore and fallthrough to default
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
    const eventTime = parseCmaCgmDate(move.Date, move.DateString)
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
      raw_event: move,
    }

    drafts.push(draft)
  }

  return drafts
}
