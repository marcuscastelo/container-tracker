import type { Snapshot } from '~/modules/tracking/domain/model/snapshot'
import type {
  Confidence,
  EventTimeType,
  ObservationDraft,
} from '~/modules/tracking/features/observation/domain/model/observationDraft'
import type { ObservationType } from '~/modules/tracking/features/observation/domain/model/observationType'
import { toLookupMapKey } from '~/modules/tracking/infrastructure/carriers/normalizers/lookup-key'
import { MscApiSchema } from '~/modules/tracking/infrastructure/carriers/schemas/api/msc.api.schema'
import { parseDateDDMMYYYYString } from '~/shared/utils/parseDate'

/**
 * Maps MSC event Description strings to canonical ObservationType.
 *
 * MSC descriptions observed in real payloads:
 *   - "Empty to Shipper" → GATE_OUT
 *   - "Export received at CY" → GATE_IN
 *   - "Export Loaded on Vessel" → LOAD
 *   - "Full Transshipment Loaded" → LOAD
 *   - "Full Transshipment Discharged" → DISCHARGE
 *   - "Full Transshipment Positioned In" → contextual (LOAD on vessel change, ARRIVAL fallback)
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
  'import to consignee': 'DELIVERY',
  delivered: 'DELIVERY',
  'gate in': 'GATE_IN',
  'gate out': 'GATE_OUT',
  'customs hold': 'CUSTOMS_HOLD',
  'customs release': 'CUSTOMS_RELEASE',
  'empty return': 'EMPTY_RETURN',
  'empty received at cy': 'EMPTY_RETURN',
  'container returned empty': 'EMPTY_RETURN',
  'devolucao de conteiner vazio': 'EMPTY_RETURN',
}

const MSC_TRANSHIPMENT_POSITIONED_IN_KEY = 'full transshipment positioned in'

type MscEventForSemanticMapping = {
  readonly Description: string | null | undefined
  readonly Detail: readonly string[] | null | undefined
  readonly UnLocationCode: string | null | undefined
  readonly Location: string | null | undefined
  readonly Vessel?: {
    readonly IMO: string | null | undefined
  } | null
}

function mapMscDescription(description: string | null | undefined): ObservationType {
  if (!description) return 'OTHER'
  const key = toLookupMapKey(description)
  return MSC_DESCRIPTION_MAP[key] ?? 'OTHER'
}

function toEventDescriptionKey(description: string | null | undefined): string {
  if (!description) return ''
  return toLookupMapKey(description)
}

function toEventLocationKey(event: MscEventForSemanticMapping): string {
  const locationCandidate = event.UnLocationCode ?? event.Location ?? ''
  return toLookupMapKey(locationCandidate)
}

function toVesselSignature(event: MscEventForSemanticMapping): string | null {
  const detail = event.Detail ?? []
  const vesselName = detail[0]?.trim() ?? ''
  const voyage = detail[1]?.trim() ?? ''
  const imo = event.Vessel?.IMO?.trim() ?? ''

  const vesselUpper = vesselName.toUpperCase()
  const voyageUpper = voyage.toUpperCase()
  const imoUpper = imo.toUpperCase()

  const isPlaceholder = vesselUpper === '' || vesselUpper === 'EMPTY' || vesselUpper === 'LADEN'
  if (isPlaceholder && voyageUpper === '' && imoUpper === '') return null

  if (vesselUpper === '' && voyageUpper === '' && imoUpper === '') return null
  return `${vesselUpper}|${voyageUpper}|${imoUpper}`
}

function isTransshipmentDescription(description: string | null | undefined): boolean {
  const key = toEventDescriptionKey(description)
  return key.includes('transshipment')
}

function findNearestComparableTransshipmentVesselSignature(
  events: readonly MscEventForSemanticMapping[],
  currentIndex: number,
): string | null {
  const currentEvent = events[currentIndex]
  if (!currentEvent) return null

  const currentLocationKey = toEventLocationKey(currentEvent)

  for (let offset = 1; offset < events.length; offset++) {
    const leftIndex = currentIndex - offset
    if (leftIndex >= 0) {
      const leftEvent = events[leftIndex]
      if (leftEvent) {
        const sameLocation =
          currentLocationKey === '' || toEventLocationKey(leftEvent) === currentLocationKey
        if (sameLocation && isTransshipmentDescription(leftEvent.Description)) {
          const signature = toVesselSignature(leftEvent)
          if (signature) return signature
        }
      }
    }

    const rightIndex = currentIndex + offset
    if (rightIndex < events.length) {
      const rightEvent = events[rightIndex]
      if (rightEvent) {
        const sameLocation =
          currentLocationKey === '' || toEventLocationKey(rightEvent) === currentLocationKey
        if (sameLocation && isTransshipmentDescription(rightEvent.Description)) {
          const signature = toVesselSignature(rightEvent)
          if (signature) return signature
        }
      }
    }
  }

  return null
}

/**
 * Contextual mapping for ambiguous MSC transshipment labels.
 *
 * Evidence source for vessel_change (explicit):
 * - current event vessel signature from Detail[0]/Detail[1]/Vessel.IMO
 * - nearest transshipment event in the same location from the same snapshot container stream
 */
function mapMscEventType(
  event: MscEventForSemanticMapping,
  events: readonly MscEventForSemanticMapping[],
  eventIndex: number,
): ObservationType {
  const baseType = mapMscDescription(event.Description)
  if (baseType !== 'OTHER') return baseType

  const descriptionKey = toEventDescriptionKey(event.Description)
  if (descriptionKey !== MSC_TRANSHIPMENT_POSITIONED_IN_KEY) return baseType

  const currentSignature = toVesselSignature(event)
  if (!currentSignature) return 'ARRIVAL'

  const nearbySignature = findNearestComparableTransshipmentVesselSignature(events, eventIndex)
  if (!nearbySignature) return 'ARRIVAL'

  return nearbySignature !== currentSignature ? 'LOAD' : 'ARRIVAL'
}

function toCarrierLabelOrNull(label: string | null | undefined): string | null {
  if (typeof label !== 'string') return null
  // Preserve original provider text for audit/UI transparency;
  // only use trim to detect blank values.
  return label.trim().length > 0 ? label : null
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

  // Parse event date (MSC uses dd/MM/yyyy)
  const parsedEventDate = parseDateDDMMYYYYString(eventDate)
  if (!parsedEventDate) return 'EXPECTED'

  // Determine reference date (current date from payload or snapshot fetch time)
  let referenceDate: Date
  if (currentDate) {
    const parsedCurrentDate = parseDateDDMMYYYYString(currentDate)
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
      for (const [eventIndex, event] of events.entries()) {
        const type = mapMscEventType(event, events, eventIndex)
        const parsedDate = event.Date ? parseDateDDMMYYYYString(event.Date) : null
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
          carrier_label: toCarrierLabelOrNull(event.Description),
          raw_event: event,
        }

        drafts.push(draft)
      }

      // Generate EXPECTED observation from PodEtaDate if present and future
      const podEtaDate = containerInfo.PodEtaDate
      if (podEtaDate && podEtaDate.trim() !== '') {
        const parsedEta = parseDateDDMMYYYYString(podEtaDate)
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
              carrier_label: null,
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
