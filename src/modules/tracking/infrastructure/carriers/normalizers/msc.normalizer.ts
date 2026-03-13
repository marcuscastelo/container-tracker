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
 *   - "Full Transshipment Positioned In" → TERMINAL_MOVE
 *   - "Full Transshipment Positioned Out" → TERMINAL_MOVE
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
  'full transshipment positioned in': 'TERMINAL_MOVE',
  'full transshipment positioned out': 'TERMINAL_MOVE',
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

const INVALID_VESSEL_VALUES = new Set(['LADEN', 'EMPTY'])
const VESSEL_EVENT_TYPES: readonly ObservationType[] = ['LOAD', 'DISCHARGE', 'ARRIVAL', 'DEPARTURE']
const MSC_NORMALIZER_VERSION = 'msc-v2'

type ParsedMscDetail = {
  readonly vessel_name: string | null
  readonly voyage: string | null
  readonly is_empty: boolean | null
}

type MscVesselInfo = {
  readonly IMO?: string | null | undefined
} | null

function mapMscDescription(description: string | null | undefined): ObservationType {
  if (!description) return 'OTHER'
  const key = toLookupMapKey(description)
  return MSC_DESCRIPTION_MAP[key] ?? 'OTHER'
}

function sanitizeVesselName(vesselName: string | null): string | null {
  if (typeof vesselName !== 'string') return null
  const trimmed = vesselName.trim()
  if (trimmed.length === 0) return null
  if (INVALID_VESSEL_VALUES.has(trimmed.toUpperCase())) return null
  return trimmed
}

function normalizeDetailValue(detailValue: string | null | undefined): string | null {
  if (typeof detailValue !== 'string') return null
  const trimmed = detailValue.trim()
  return trimmed.length > 0 ? trimmed : null
}

function supportsVesselAndVoyage(type: ObservationType): boolean {
  return VESSEL_EVENT_TYPES.includes(type)
}

function hasImo(vessel: MscVesselInfo | undefined): boolean {
  const imo = vessel?.IMO?.trim() ?? ''
  return imo.length > 0
}

function parseLoadState(detailValue: string | null): boolean | null {
  if (typeof detailValue !== 'string') return null
  const normalized = detailValue.trim().toUpperCase()
  if (normalized === 'EMPTY') return true
  if (normalized === 'LADEN') return false
  return null
}

function parseMscDetail(
  type: ObservationType,
  detail: readonly string[] | null | undefined,
  vessel: MscVesselInfo | undefined,
): ParsedMscDetail {
  const first = normalizeDetailValue(detail && detail.length > 0 ? (detail[0] ?? null) : null)
  const second = normalizeDetailValue(detail && detail.length > 1 ? (detail[1] ?? null) : null)
  const loadState = parseLoadState(first)

  const isVesselContext = supportsVesselAndVoyage(type) || hasImo(vessel)
  if (isVesselContext) {
    return {
      vessel_name: sanitizeVesselName(first),
      voyage: second,
      is_empty: loadState,
    }
  }

  if (loadState !== null) {
    return {
      vessel_name: null,
      voyage: null,
      is_empty: loadState,
    }
  }

  return {
    vessel_name: null,
    voyage: null,
    is_empty: null,
  }
}

function withNormalizerVersion(rawEvent: unknown): unknown {
  if (typeof rawEvent !== 'object' || rawEvent === null || Array.isArray(rawEvent)) {
    return { normalizer_version: MSC_NORMALIZER_VERSION }
  }
  return {
    ...rawEvent,
    normalizer_version: MSC_NORMALIZER_VERSION,
  }
}

function toCarrierLabelOrNull(label: string | null | undefined): string | null {
  if (typeof label !== 'string') return null
  // Preserve original provider text for audit/UI transparency;
  // only use trim to detect blank values.
  return label.trim().length > 0 ? label : null
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
      for (const event of events) {
        const type = mapMscDescription(event.Description)
        const parsedDate = event.Date ? parseDateDDMMYYYYString(event.Date) : null
        const eventTime = parsedDate ? parsedDate.toISOString() : null
        const locationCode = event.UnLocationCode ?? null
        const locationDisplay = event.Location ?? null
        const parsedDetail = parseMscDetail(type, event.Detail, event.Vessel)

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
          vessel_name: parsedDetail.vessel_name,
          voyage: parsedDetail.voyage,
          is_empty: parsedDetail.is_empty,
          confidence,
          provider: 'msc',
          snapshot_id: snapshot.id,
          carrier_label: toCarrierLabelOrNull(event.Description),
          raw_event: withNormalizerVersion(event),
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
              raw_event: withNormalizerVersion({ source: 'PodEtaDate', value: podEtaDate }),
            }

            drafts.push(etaDraft)
          }
        }
      }
    }
  }

  return drafts
}
