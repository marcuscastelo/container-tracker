import type { Confidence, ObservationDraft, EventTimeType } from '~/modules/tracking/domain/observationDraft'
import type { ObservationType } from '~/modules/tracking/domain/observationType'
import type { Snapshot } from '~/modules/tracking/domain/snapshot'
import { MscApiSchema } from '~/modules/tracking/infrastructure/schemas/api/msc.api.schema'
import { parseDate } from '~/shared/utils/parseDate'

/**
 * Maps MSC event Description strings to canonical ObservationType.
 *
 * MSC descriptions observed in real payloads:
 *   - "Empty to Shipper" → GATE_OUT
 *   - "Export received at CY" → GATE_IN
 *   - "Export Loaded on Vessel" → LOAD
 *   - "Full Transshipment Loaded" → LOAD
 *   - "Full Transshipment Discharged" → DISCHARGE
 *   - "Import Discharged from Vessel" → DISCHARGE
 *   - "Delivered" → DELIVERY
 *
 * This mapping will grow as we see more MSC event types.
 */
const MSC_DESCRIPTION_MAP: Record<string, ObservationType> = {
  'empty to shipper': 'GATE_OUT',
  'export received at cy': 'GATE_IN',
  'export loaded on vessel': 'LOAD',
  'full transshipment loaded': 'LOAD',
  'full transshipment discharged': 'DISCHARGE',
  'import discharged from vessel': 'DISCHARGE',
  delivered: 'DELIVERY',
  'gate in': 'GATE_IN',
  'gate out': 'GATE_OUT',
  'customs hold': 'CUSTOMS_HOLD',
  'customs release': 'CUSTOMS_RELEASE',
  'empty return': 'EMPTY_RETURN',
}

function mapMscDescription(description: string | null | undefined): ObservationType {
  if (!description) return 'OTHER'
  const key = description.toLowerCase().trim()
  return MSC_DESCRIPTION_MAP[key] ?? 'OTHER'
}

function isEmptyEvent(
  description: string | null | undefined,
  detail: readonly string[] | null | undefined,
): boolean | null {
  if (!description) return null
  const lower = description.toLowerCase()
  if (lower.includes('empty')) return true
  if (detail && detail.length > 0) {
    const firstDetail = detail[0]?.toUpperCase() ?? ''
    if (firstDetail === 'EMPTY') return true
    if (firstDetail === 'LADEN') return false
  }
  return null
}

function computeConfidence(
  eventTime: string | null,
  locationCode: string | null | undefined,
  type: ObservationType,
): Confidence {
  if (!eventTime) return 'low'
  if (!locationCode && type !== 'OTHER') return 'medium'
  return 'high'
}

/**
 * Map MSC event to EventTimeType.
 *
 * MSC does not explicitly provide ACTUAL vs EXPECTED in their API.
 * Default to EXPECTED as per the canonical rules.
 *
 * @see Issue: Canonical differentiation between ACTUAL vs EXPECTED
 */
function mapMscEventTimeType(): EventTimeType {
  // MSC doesn't provide explicit event_time_type
  // According to the issue: if carrier doesn't explicitly indicate, use EXPECTED
  return 'EXPECTED'
}

/**
 * Normalize an MSC snapshot payload into ObservationDrafts.
 *
 * This is a pure function — no side effects, no persistence.
 * It validates the payload with Zod and extracts semantic observations.
 *
 * @param snapshot - The snapshot record (must have provider='msc')
 * @returns Array of ObservationDraft (may be empty if parsing fails)
 *
 * @see docs/master-consolidated-0209.md §4.1 — normalizeSnapshot step
 */
export function normalizeMscSnapshot(snapshot: Snapshot): ObservationDraft[] {
  const parseResult = MscApiSchema.safeParse(snapshot.payload)
  if (!parseResult.success) {
    // Payload doesn't match MSC schema — caller should create Alert[data]
    return []
  }

  const mscData = parseResult.data
  const bills = mscData.Data?.BillOfLadings ?? []
  const drafts: ObservationDraft[] = []

  for (const bill of bills) {
    const containers = bill.ContainersInfo ?? []
    for (const containerInfo of containers) {
      const containerNumber =
        containerInfo.ContainerNumber ?? mscData.Data?.TrackingNumber ?? 'UNKNOWN'
      const events = containerInfo.Events ?? []

      for (const event of events) {
        const type = mapMscDescription(event.Description)
        const parsedDate = event.Date ? parseDate(event.Date) : null
        const eventTime = parsedDate ? parsedDate.toISOString() : null
        const locationCode = event.UnLocationCode ?? null
        const locationDisplay = event.Location ?? null
        const vesselName =
          event.Detail && event.Detail.length > 0 ? (event.Detail[0] ?? null) : null
        const voyage = event.Detail && event.Detail.length > 1 ? (event.Detail[1] ?? null) : null
        const isEmpty = isEmptyEvent(event.Description, event.Detail)

        // Skip vessel-like detail for non-vessel events (GATE_IN, GATE_OUT, etc.)
        const isVesselEvent =
          type === 'LOAD' || type === 'DISCHARGE' || type === 'DEPARTURE' || type === 'ARRIVAL'
        const finalVesselName = isVesselEvent ? vesselName : null
        const finalVoyage = isVesselEvent ? voyage : null

        const confidence = computeConfidence(eventTime, locationCode, type)
        const eventTimeType = mapMscEventTimeType()

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
          provider: 'msc',
          snapshot_id: snapshot.id,
          raw_event: event,
        }

        drafts.push(draft)
      }
    }
  }

  return drafts
}
