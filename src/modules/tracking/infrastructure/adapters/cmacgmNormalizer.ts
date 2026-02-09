import type { Confidence, ObservationDraft } from '~/modules/tracking/domain/observationDraft'
import type { ObservationType } from '~/modules/tracking/domain/observationType'
import type { Snapshot } from '~/modules/tracking/domain/snapshot'
import { CmaCgmApiSchema } from '~/modules/tracking/infrastructure/schemas/api/cmacgm.api.schema'

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
  'gate in': 'GATE_IN',
  'gate out': 'GATE_OUT',
  'loaded on board': 'LOAD',
  load: 'LOAD',
  loaded: 'LOAD',
  discharged: 'DISCHARGE',
  discharge: 'DISCHARGE',
  departure: 'DEPARTURE',
  arrival: 'ARRIVAL',
  delivered: 'DELIVERY',
  delivery: 'DELIVERY',
  'customs hold': 'CUSTOMS_HOLD',
  'customs release': 'CUSTOMS_RELEASE',
  'empty return': 'EMPTY_RETURN',
  'empty to shipper': 'GATE_OUT',
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
  // Try DateString first (human-readable)
  if (dateStringField) {
    const d = new Date(dateStringField)
    if (!Number.isNaN(d.getTime())) return d.toISOString()
  }

  // Try MS date format: /Date(1234567890000)/
  if (dateField) {
    const msMatch = dateField.match(/\/Date\((-?\d+)\)\//)
    if (msMatch?.[1]) {
      const ts = Number(msMatch[1])
      if (!Number.isNaN(ts)) return new Date(ts).toISOString()
    }

    // Try as plain ISO date
    const d = new Date(dateField)
    if (!Number.isNaN(d.getTime())) return d.toISOString()
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

    const draft: ObservationDraft = {
      container_number: containerNumber,
      type,
      event_time: eventTime,
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
