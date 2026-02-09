import { MaerskApiSchema } from '~/modules/container/infrastructure/schemas/api/maersk.api.schema'
import type { Confidence, ObservationDraft } from '~/modules/tracking/domain/observationDraft'
import type { ObservationType } from '~/modules/tracking/domain/observationType'
import type { Snapshot } from '~/modules/tracking/domain/snapshot'

/**
 * Maps Maersk event `activity` strings to canonical ObservationType.
 *
 * Maersk activity values observed in real payloads:
 *   - "GATE-IN"        → GATE_IN
 *   - "GATE-OUT"       → GATE_OUT
 *   - "LOAD"           → LOAD
 *   - "CONTAINER ARRIVAL" → ARRIVAL
 *   - "DISCHARGE"      → DISCHARGE
 *   - "CONTAINER DEPARTURE" → DEPARTURE
 *
 * This mapping will grow as we see more Maersk event types.
 */
const MAERSK_ACTIVITY_MAP: Record<string, ObservationType> = {
  'gate-in': 'GATE_IN',
  'gate in': 'GATE_IN',
  'gate-out': 'GATE_OUT',
  'gate out': 'GATE_OUT',
  load: 'LOAD',
  loaded: 'LOAD',
  discharge: 'DISCHARGE',
  discharged: 'DISCHARGE',
  'container arrival': 'ARRIVAL',
  arrival: 'ARRIVAL',
  'container departure': 'DEPARTURE',
  departure: 'DEPARTURE',
  delivered: 'DELIVERY',
  delivery: 'DELIVERY',
  'customs hold': 'CUSTOMS_HOLD',
  'customs release': 'CUSTOMS_RELEASE',
  'empty return': 'EMPTY_RETURN',
  'empty to shipper': 'GATE_OUT',
}

function mapMaerskActivity(activity: string | null | undefined): ObservationType {
  if (!activity) return 'OTHER'
  const key = activity.toLowerCase().trim()
  return MAERSK_ACTIVITY_MAP[key] ?? 'OTHER'
}

function computeConfidence(
  eventTime: string | null,
  eventTimeType: string | null | undefined,
  locationCode: string | null | undefined,
): Confidence {
  if (!eventTime) return 'low'
  if (eventTimeType?.toUpperCase() === 'EXPECTED') return 'medium'
  if (!locationCode) return 'medium'
  return 'high'
}

/**
 * Normalize a Maersk snapshot payload into ObservationDrafts.
 *
 * @param snapshot - The snapshot record (must have provider='maersk')
 * @returns Array of ObservationDraft — may be empty if parsing fails
 */
export function normalizeMaerskSnapshot(snapshot: Snapshot): ObservationDraft[] {
  const parseResult = MaerskApiSchema.safeParse(snapshot.payload)
  if (!parseResult.success) {
    return []
  }

  const maerskData = parseResult.data
  const containers = maerskData.containers ?? []
  const drafts: ObservationDraft[] = []

  for (const container of containers) {
    const containerNumber = container.container_num?.toUpperCase() ?? 'UNKNOWN'
    const locations = container.locations ?? []

    for (const location of locations) {
      const events = location.events ?? []

      for (const event of events) {
        const type = mapMaerskActivity(event.activity)
        const eventTime = event.event_time ?? null
        const locationCode = event.locationCode ?? location.location_code ?? null
        const locationDisplay =
          [location.city, location.country_code].filter(Boolean).join(', ') || null
        const vesselName = event.vessel_name ?? null
        const voyage = event.voyage_num ?? null
        const isEmpty = event.stempty ?? null

        const isVesselEvent =
          type === 'LOAD' || type === 'DISCHARGE' || type === 'DEPARTURE' || type === 'ARRIVAL'
        const finalVesselName = isVesselEvent ? vesselName : null
        const finalVoyage = isVesselEvent ? voyage : null

        const confidence = computeConfidence(eventTime, event.event_time_type, locationCode)

        const draft: ObservationDraft = {
          container_number: containerNumber,
          type,
          event_time: eventTime,
          location_code: locationCode,
          location_display: locationDisplay,
          vessel_name: finalVesselName,
          voyage: finalVoyage,
          is_empty: isEmpty,
          confidence,
          provider: 'maersk',
          snapshot_id: snapshot.id,
          raw_event: event,
        }

        drafts.push(draft)
      }
    }
  }

  return drafts
}
