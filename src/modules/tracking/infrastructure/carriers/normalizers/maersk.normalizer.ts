import type { Snapshot } from '~/modules/tracking/domain/model/snapshot'
import type {
  Confidence,
  EventTimeType,
  ObservationDraft,
} from '~/modules/tracking/features/observation/domain/model/observationDraft'
import type { ObservationType } from '~/modules/tracking/features/observation/domain/model/observationType'
import { toLookupMapKey } from '~/modules/tracking/infrastructure/carriers/normalizers/lookup-key'
import { MaerskApiSchema } from '~/modules/tracking/infrastructure/carriers/schemas/api/maersk.api.schema'

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
  discharg: 'DISCHARGE',
  'container arrival': 'ARRIVAL',
  arrival: 'ARRIVAL',
  'container departure': 'DEPARTURE',
  departure: 'DEPARTURE',
  delivered: 'DELIVERY',
  delivery: 'DELIVERY',
  'customs hold': 'CUSTOMS_HOLD',
  'customs release': 'CUSTOMS_RELEASE',
  'empty return': 'EMPTY_RETURN',
  'container returned empty': 'EMPTY_RETURN',
  'devolucao de conteiner vazio': 'EMPTY_RETURN',
  'empty to shipper': 'GATE_OUT',
}

function mapMaerskActivity(activity: string | null | undefined): ObservationType {
  if (!activity) return 'OTHER'
  const key = toLookupMapKey(activity)
  return MAERSK_ACTIVITY_MAP[key] ?? 'OTHER'
}

/**
 * Map Maersk event_time_type to canonical EventTimeType.
 *
 * Maersk uses: "ACTUAL" | "EXPECTED" (case-insensitive)
 * We map explicitly; if uncertain or null → EXPECTED (safe default).
 *
 * @see Issue: Canonical differentiation between ACTUAL vs EXPECTED
 */
function mapEventTimeType(eventTimeType: string | null | undefined): EventTimeType {
  if (!eventTimeType) return 'EXPECTED'
  const upper = eventTimeType.toUpperCase().trim()
  if (upper === 'ACTUAL') return 'ACTUAL'
  return 'EXPECTED'
}

function toCarrierLabelOrNull(label: string | null | undefined): string | null {
  if (typeof label !== 'string') return null
  // Preserve the original provider text for audit/UI transparency.
  // Use trim only to detect empty/blank values.
  return label.trim().length > 0 ? label : null
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
        const eventTimeType = mapEventTimeType(event.event_time_type)

        const draft: ObservationDraft = {
          container_number: containerNumber,
          type,
          event_time: eventTime,
          event_time_type: eventTimeType,
          location_code: locationCode,
          location_display: locationDisplay,
          vessel_name: finalVesselName,
          voyage: finalVoyage,
          is_empty: isEmpty,
          confidence,
          provider: 'maersk',
          snapshot_id: snapshot.id,
          carrier_label: toCarrierLabelOrNull(event.activity),
          raw_event: event,
        }

        drafts.push(draft)
      }
    }
  }

  return drafts
}
