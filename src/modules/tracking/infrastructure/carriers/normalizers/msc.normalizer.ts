import type { Snapshot } from '~/modules/tracking/domain/model/snapshot'
import type {
  Confidence,
  EventTimeType,
  ObservationDraft,
} from '~/modules/tracking/features/observation/domain/model/observationDraft'
import type { ObservationType } from '~/modules/tracking/features/observation/domain/model/observationType'
import { toLookupMapKey } from '~/modules/tracking/infrastructure/carriers/normalizers/lookup-key'
import { buildDateOnlyTrackingTemporal } from '~/modules/tracking/infrastructure/carriers/normalizers/tracking-temporal-resolution'
import { MscApiSchema } from '~/modules/tracking/infrastructure/carriers/schemas/api/msc.api.schema'
import { parseInstantFromIso } from '~/shared/time/parsing'
import { parseDateDDMMYYYYString } from '~/shared/utils/parseDate'

type MscSemanticRule = {
  readonly type: ObservationType
  readonly eventTimeTypeStrategy: 'date-derived' | 'forced-expected'
}

/**
 * Maps MSC event Description strings to canonical ObservationType.
 *
 * MSC descriptions observed in real payloads:
 *   - "Empty to Shipper" → GATE_OUT
 *   - "Export received at CY" → GATE_IN
 *   - "Export Loaded on Vessel" → LOAD
 *   - "Estimated Time of Arrival" → ARRIVAL (EXPECTED)
 *   - "Estimated Time of Departure" → DEPARTURE (EXPECTED)
 *   - "Full Intended Transshipment" → TRANSSHIPMENT_INTENDED (EXPECTED)
 *   - "Full Transshipment Loaded" → LOAD
 *   - "Full Transshipment Discharged" → DISCHARGE
 *   - "Full Transshipment Positioned In" → TRANSSHIPMENT_POSITIONED_IN
 *   - "Full Transshipment Positioned Out" → TRANSSHIPMENT_POSITIONED_OUT
 *   - "Import Discharged from Vessel" → DISCHARGE
 *   - "Delivered" → DELIVERY
 *
 * This mapping will grow as we see more MSC event types.
 */
const MSC_EVENT_RULES: Readonly<Record<string, MscSemanticRule>> = {
  'empty to shipper': {
    type: 'GATE_OUT',
    eventTimeTypeStrategy: 'date-derived',
  },
  'export received at cy': {
    type: 'GATE_IN',
    eventTimeTypeStrategy: 'date-derived',
  },
  'export loaded on vessel': {
    type: 'LOAD',
    eventTimeTypeStrategy: 'date-derived',
  },
  'estimated time of arrival': {
    type: 'ARRIVAL',
    eventTimeTypeStrategy: 'forced-expected',
  },
  'estimated time of departure': {
    type: 'DEPARTURE',
    eventTimeTypeStrategy: 'forced-expected',
  },
  'full intended transshipment': {
    type: 'TRANSSHIPMENT_INTENDED',
    eventTimeTypeStrategy: 'forced-expected',
  },
  'full transshipment loaded': {
    type: 'LOAD',
    eventTimeTypeStrategy: 'date-derived',
  },
  'full transshipment discharged': {
    type: 'DISCHARGE',
    eventTimeTypeStrategy: 'date-derived',
  },
  'full transshipment positioned in': {
    type: 'TRANSSHIPMENT_POSITIONED_IN',
    eventTimeTypeStrategy: 'date-derived',
  },
  'full transshipment positioned out': {
    type: 'TRANSSHIPMENT_POSITIONED_OUT',
    eventTimeTypeStrategy: 'date-derived',
  },
  'import discharged from vessel': {
    type: 'DISCHARGE',
    eventTimeTypeStrategy: 'date-derived',
  },
  'import to consignee': {
    type: 'DELIVERY',
    eventTimeTypeStrategy: 'date-derived',
  },
  delivered: {
    type: 'DELIVERY',
    eventTimeTypeStrategy: 'date-derived',
  },
  'gate in': {
    type: 'GATE_IN',
    eventTimeTypeStrategy: 'date-derived',
  },
  'gate out': {
    type: 'GATE_OUT',
    eventTimeTypeStrategy: 'date-derived',
  },
  'customs hold': {
    type: 'CUSTOMS_HOLD',
    eventTimeTypeStrategy: 'date-derived',
  },
  'customs release': {
    type: 'CUSTOMS_RELEASE',
    eventTimeTypeStrategy: 'date-derived',
  },
  'empty return': {
    type: 'EMPTY_RETURN',
    eventTimeTypeStrategy: 'date-derived',
  },
  'empty received at cy': {
    type: 'EMPTY_RETURN',
    eventTimeTypeStrategy: 'date-derived',
  },
  'container returned empty': {
    type: 'EMPTY_RETURN',
    eventTimeTypeStrategy: 'date-derived',
  },
  'devolucao de conteiner vazio': {
    type: 'EMPTY_RETURN',
    eventTimeTypeStrategy: 'date-derived',
  },
}

const INVALID_VESSEL_VALUES = new Set(['LADEN', 'EMPTY', 'TBN'])
const VESSEL_EVENT_TYPES: readonly ObservationType[] = ['LOAD', 'DISCHARGE', 'ARRIVAL', 'DEPARTURE']
const MSC_NORMALIZER_VERSION = 'msc-v3'

type ParsedMscDetail = {
  readonly vessel_name: string | null
  readonly voyage: string | null
  readonly is_empty: boolean | null
}

type MscVesselInfo = {
  readonly IMO?: string | null | undefined
} | null

function lookupMscSemanticRule(description: string | null | undefined): MscSemanticRule | null {
  if (!description) return null
  const key = toLookupMapKey(description)
  return MSC_EVENT_RULES[key] ?? null
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

function normalizeLocationDisplay(value: string | null | undefined): string {
  return typeof value === 'string' ? toLookupMapKey(value) : ''
}

function sameCalendarDateValue(
  left: ObservationDraft['event_time'],
  right: ObservationDraft['event_time'],
): boolean {
  if (left === null || right === null) return left === right
  if (left.kind !== 'date' || right.kind !== 'date') return false
  return left.value.toIsoDate() === right.value.toIsoDate()
}

function locationsMatch(
  draft: Pick<ObservationDraft, 'location_code' | 'location_display'>,
  locationCode: string | null,
  locationDisplay: string | null,
): boolean {
  const normalizedDraftCode = draft.location_code?.trim().toUpperCase() ?? ''
  const normalizedTargetCode = locationCode?.trim().toUpperCase() ?? ''
  if (
    normalizedDraftCode.length > 0 &&
    normalizedTargetCode.length > 0 &&
    normalizedDraftCode === normalizedTargetCode
  ) {
    return true
  }

  const normalizedDraftDisplay = normalizeLocationDisplay(draft.location_display)
  const normalizedTargetDisplay = normalizeLocationDisplay(locationDisplay)
  return normalizedDraftDisplay.length > 0 && normalizedDraftDisplay === normalizedTargetDisplay
}

function hasExplicitArrivalEtaForPod(command: {
  readonly drafts: readonly ObservationDraft[]
  readonly podEtaEventTime: ObservationDraft['event_time']
  readonly podLocationCode: string | null
  readonly podLocationDisplay: string | null
}): boolean {
  return command.drafts.some((draft) => {
    if (draft.type !== 'ARRIVAL' || draft.event_time_type !== 'EXPECTED') return false
    if (
      typeof draft.carrier_label !== 'string' ||
      toLookupMapKey(draft.carrier_label) !== 'estimated time of arrival'
    ) {
      return false
    }
    if (!sameCalendarDateValue(draft.event_time, command.podEtaEventTime)) return false
    return locationsMatch(draft, command.podLocationCode, command.podLocationDisplay)
  })
}

function computeConfidence(
  eventTime: ObservationDraft['event_time'],
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
  strategy: MscSemanticRule['eventTimeTypeStrategy'] = 'date-derived',
): EventTimeType {
  if (strategy === 'forced-expected') return 'EXPECTED'

  // If no event date, treat as EXPECTED (provisional)
  if (!eventDate) return 'EXPECTED'

  // Parse event date (MSC uses dd/MM/yyyy)
  const parsedEventDate = parseDateDDMMYYYYString(eventDate)
  if (!parsedEventDate) return 'EXPECTED'

  // Determine reference date (current date from payload or snapshot fetch time)
  let referenceDate = currentDate ? parseDateDDMMYYYYString(currentDate) : null
  if (currentDate) {
    referenceDate = parseDateDDMMYYYYString(currentDate)
  }

  if (!referenceDate) {
    const fetchedAt = parseInstantFromIso(snapshotFetchedAt)
    if (!fetchedAt) return 'EXPECTED'
    referenceDate = fetchedAt.toCalendarDate('UTC')
  }

  if (parsedEventDate.compare(referenceDate) <= 0) {
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
      const containerDrafts: ObservationDraft[] = []

      // Process historical/confirmed events from Events array
      for (const event of events) {
        const semanticRule = lookupMscSemanticRule(event.Description)
        const type = semanticRule?.type ?? 'OTHER'
        const parsedDate = event.Date ? parseDateDDMMYYYYString(event.Date) : null
        const locationCode = event.UnLocationCode ?? null
        const locationDisplay = event.Location ?? null
        const temporal = buildDateOnlyTrackingTemporal({
          date: parsedDate,
          rawEventTime: event.Date ?? null,
          locationCode,
          locationDisplay,
        })
        const eventTime = temporal.event_time
        const parsedDetail = parseMscDetail(type, event.Detail, event.Vessel)

        // Determine ACTUAL vs EXPECTED based on date comparison
        const eventTimeType = determineEventTimeType(
          event.Date,
          currentDate,
          snapshot.fetched_at,
          semanticRule?.eventTimeTypeStrategy ?? 'date-derived',
        )

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
          raw_event_time: temporal.raw_event_time ?? null,
          event_time_source: temporal.event_time_source ?? null,
          raw_event: withNormalizerVersion(event),
        }

        containerDrafts.push(draft)
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
            const etaTemporal = buildDateOnlyTrackingTemporal({
              date: parsedEta,
              rawEventTime: podEtaDate,
              locationCode: podLocationCode,
              locationDisplay: podLocation,
            })
            const etaEventTime = etaTemporal.event_time

            if (
              hasExplicitArrivalEtaForPod({
                drafts: containerDrafts,
                podEtaEventTime: etaEventTime,
                podLocationCode,
                podLocationDisplay: podLocation,
              })
            ) {
              drafts.push(...containerDrafts)
              continue
            }

            const etaDraft: ObservationDraft = {
              container_number: containerNumber,
              type: 'ARRIVAL', // ETA implies arrival at POD
              event_time: etaEventTime,
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
              raw_event_time: etaTemporal.raw_event_time ?? null,
              event_time_source: etaTemporal.event_time_source ?? null,
              raw_event: withNormalizerVersion({ source: 'PodEtaDate', value: podEtaDate }),
            }

            containerDrafts.push(etaDraft)
          }
        }
      }

      drafts.push(...containerDrafts)
    }
  }

  return drafts
}
