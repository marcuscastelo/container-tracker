import type {
  Confidence,
  EventTimeType,
  ObservationDraft,
} from '~/modules/tracking/domain/observationDraft'
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
  eventTimeType: EventTimeType,
): Confidence {
  if (!eventTime) return 'low'
  if (eventTimeType === 'EXPECTED') return 'medium'
  if (!locationCode && type !== 'OTHER') return 'medium'
  return 'high'
}

/**
 * Determine EventTimeType for an MSC event.
 *
 * MSC does not explicitly provide ACTUAL vs EXPECTED, so we infer it:
 *
 * Rules:
 *   1. If event.Date is present and <= snapshot.Data.CurrentDate → ACTUAL (confirmed past event)
 *   2. If event.Date is present and > snapshot.Data.CurrentDate → EXPECTED (future prediction)
 *   3. If event.Date is missing → EXPECTED (uncertain, treat as provisional)
 *   4. Fallback: if CurrentDate missing, use snapshot.fetched_at for comparison
 *
 * @param eventDate - Event date string (dd/MM/yyyy format from MSC)
 * @param currentDate - CurrentDate from snapshot payload (dd/MM/yyyy)
 * @param snapshotFetchedAt - Fallback date if CurrentDate is missing
 * @returns 'ACTUAL' | 'EXPECTED'
 */
function determineEventTimeType(
  eventDate: string | null | undefined,
  currentDate: string | null | undefined,
  snapshotFetchedAt: string,
): EventTimeType {
  // If no event date, treat as EXPECTED (provisional)
  if (!eventDate) return 'EXPECTED'

  // Parse event date
  const parsedEventDate = parseDate(eventDate)
  if (!parsedEventDate) return 'EXPECTED'

  // Determine reference date (current date from payload or snapshot fetch time)
  let referenceDate: Date
  if (currentDate) {
    const parsedCurrentDate = parseDate(currentDate)
    if (parsedCurrentDate) {
      referenceDate = parsedCurrentDate
    } else {
      referenceDate = new Date(snapshotFetchedAt)
    }
  } else {
    referenceDate = new Date(snapshotFetchedAt)
  }

  // Compare dates (normalize to date-only to avoid time-of-day issues)
  const eventDateOnly = new Date(
    parsedEventDate.getUTCFullYear(),
    parsedEventDate.getUTCMonth(),
    parsedEventDate.getUTCDate(),
  )
  const referenceDateOnly = new Date(
    referenceDate.getUTCFullYear(),
    referenceDate.getUTCMonth(),
    referenceDate.getUTCDate(),
  )

  if (eventDateOnly <= referenceDateOnly) {
    return 'ACTUAL'
  }

  return 'EXPECTED'
}

/**
 * Normalize an MSC snapshot payload into ObservationDrafts.
 *
 * This is a pure function — no side effects, no persistence.
 * It validates the payload with Zod and extracts semantic observations.
 *
 * New: infers ACTUAL vs EXPECTED based on event date vs CurrentDate.
 *
 * @param snapshot - The snapshot record (must have provider='msc')
 * @returns Array of ObservationDraft (may be empty if parsing fails)
 *
 * @see docs/master-consolidated-0209.md §4.1 — normalizeSnapshot step
 * @see Issue: Canonical differentiation between ACTUAL vs EXPECTED
 */
export function normalizeMscSnapshot(snapshot: Snapshot): ObservationDraft[] {
  const parseResult = MscApiSchema.safeParse(snapshot.payload)
  if (!parseResult.success) {
    // Payload doesn't match MSC schema — caller should create Alert[data]
    return []
  }

  const mscData = parseResult.data
  const currentDate = mscData.Data?.CurrentDate ?? null
  const bills = mscData.Data?.BillOfLadings ?? []
  const drafts: ObservationDraft[] = []

  for (const bill of bills) {
    const containers = bill.ContainersInfo ?? []
    for (const containerInfo of containers) {
      const containerNumber =
        containerInfo.ContainerNumber ?? mscData.Data?.TrackingNumber ?? 'UNKNOWN'
      const events = containerInfo.Events ?? []

      // Process historical/confirmed events from Events array
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

        // Determine ACTUAL vs EXPECTED based on date comparison
        const eventTimeType = determineEventTimeType(event.Date, currentDate, snapshot.fetched_at)

        const confidence = computeConfidence(eventTime, locationCode, type, eventTimeType)

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

      // Generate EXPECTED observation from PodEtaDate if present and future
      const podEtaDate = containerInfo.PodEtaDate
      if (podEtaDate && podEtaDate.trim() !== '') {
        const parsedEta = parseDate(podEtaDate)
        if (parsedEta) {
          // Determine if this ETA is in the future
          const etaTimeType = determineEventTimeType(podEtaDate, currentDate, snapshot.fetched_at)

          // Only create EXPECTED observation if it's truly in the future
          if (etaTimeType === 'EXPECTED') {
            const podLocation = bill.GeneralTrackingInfo?.PortOfDischarge ?? null
            const podLocationCode = null // MSC doesn't provide POD UN/LOCODE in PodEtaDate context

            const etaDraft: ObservationDraft = {
              container_number: containerNumber,
              type: 'ARRIVAL', // ETA implies arrival at POD
              event_time: parsedEta.toISOString(),
              event_time_type: 'EXPECTED',
              location_code: podLocationCode,
              location_display: podLocation,
              vessel_name: null,
              voyage: null,
              is_empty: null,
              confidence: 'medium', // ETA is provisional
              provider: 'msc',
              snapshot_id: snapshot.id,
              raw_event: { source: 'PodEtaDate', value: podEtaDate },
            }

            drafts.push(etaDraft)
          }
        }
      }
    }
  }

  return drafts
}
