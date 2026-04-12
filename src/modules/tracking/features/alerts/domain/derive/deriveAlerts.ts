import { normalizeVesselName } from '~/modules/tracking/domain/identity/normalizeVesselName'
import type { TransshipmentInfo } from '~/modules/tracking/domain/logistics/transshipment'
import { TRACKING_CHRONOLOGY_COMPARE_OPTIONS } from '~/modules/tracking/domain/temporal/tracking-temporal'
import { computeAlertFingerprint } from '~/modules/tracking/features/alerts/domain/identity/alertFingerprint'
import type {
  NewTrackingAlert,
  TrackingAlertDerivationState,
  TrackingAlertResolvedReason,
} from '~/modules/tracking/features/alerts/domain/model/trackingAlert'
import type { Observation } from '~/modules/tracking/features/observation/domain/model/observation'
import type { ContainerStatus } from '~/modules/tracking/features/status/domain/model/containerStatus'
import { compareObservationsChronologically } from '~/modules/tracking/features/timeline/domain/derive/deriveTimeline'
import type { Timeline } from '~/modules/tracking/features/timeline/domain/model/timeline'
import { systemClock } from '~/shared/time/clock'
import { toComparableInstant } from '~/shared/time/compare-temporal'
import type { Instant } from '~/shared/time/instant'

/**
 * Internal representation of a confirmed transshipment event.
 * Used to drive both TransshipmentInfo derivation and per-pair alert generation.
 */
type TransshipmentPair = {
  readonly dischargeObs: Observation
  readonly loadObs: Observation
  readonly port: string
  readonly vesselFrom: string
  readonly vesselTo: string
}

type TransshipmentOccurrence = {
  readonly dischargeObs: Observation
  readonly loadObs: Observation
  readonly port: string
  readonly vesselFrom: string
  readonly vesselTo: string
  readonly sourceObservationFingerprints: readonly string[]
  readonly alertFingerprint: string
}

export type DerivedTransshipmentOccurrence = {
  readonly port: string
  readonly vesselFrom: string
  readonly vesselTo: string
  readonly detectedAt: string
  readonly sourceObservationFingerprints: readonly string[]
  readonly alertFingerprint: string
}

type MonitoringAutoResolution = {
  readonly alertId: string
  readonly reason: TrackingAlertResolvedReason
}

type DerivedAlertTransitions = {
  readonly newAlerts: readonly NewTrackingAlert[]
  readonly monitoringAutoResolutions: readonly MonitoringAutoResolution[]
}

function resolveObservationLocationDisplay(observation: Observation | null | undefined): string {
  const locationDisplay = observation?.location_display?.trim() ?? ''
  if (locationDisplay.length > 0) return locationDisplay

  const locationCode = observation?.location_code?.trim() ?? ''
  if (locationCode.length > 0) return locationCode

  return 'unknown location'
}

function toDetectedAtIso(value: Observation['event_time'], fallback: Instant): string {
  if (value === null) return fallback.toIsoString()
  return toComparableInstant(value, TRACKING_CHRONOLOGY_COMPARE_OPTIONS).toIsoString()
}

function toObservationTimeKey(observation: Observation): string {
  if (observation.event_time === null) {
    return `null:${observation.created_at}`
  }

  return toComparableInstant(
    observation.event_time,
    TRACKING_CHRONOLOGY_COMPARE_OPTIONS,
  ).toIsoString()
}

function normalizeAlertVesselPart(value: string): string {
  const normalized = normalizeVesselName(value)
  if (normalized !== null) return normalized
  return value.trim().toUpperCase()
}

function computeTransshipmentOccurrenceFingerprint(pair: TransshipmentPair): string {
  return computeAlertFingerprint('TRANSSHIPMENT', [
    `port:${pair.port}`,
    `from:${normalizeAlertVesselPart(pair.vesselFrom)}`,
    `to:${normalizeAlertVesselPart(pair.vesselTo)}`,
    `discharge:${toObservationTimeKey(pair.dischargeObs)}`,
    `load:${toObservationTimeKey(pair.loadObs)}`,
  ])
}

function computeLegacyTransshipmentFingerprint(command: {
  readonly dischargeObs: Observation
  readonly loadObs: Observation
}): string {
  return computeAlertFingerprint('TRANSSHIPMENT', [
    command.dischargeObs.fingerprint,
    command.loadObs.fingerprint,
  ])
}

function computeTransshipmentSemanticDedupKey(command: {
  readonly port: string
  readonly vesselFrom: string
  readonly vesselTo: string
  readonly detectedAt: string
}): string {
  return [
    `port:${command.port.toUpperCase()}`,
    `from:${normalizeAlertVesselPart(command.vesselFrom)}`,
    `to:${normalizeAlertVesselPart(command.vesselTo)}`,
    `detected:${command.detectedAt}`,
  ].join('|')
}

function toExistingTransshipmentSemanticDedupKey(
  alert: TrackingAlertDerivationState,
): string | null {
  if (alert.type !== 'TRANSSHIPMENT') return null

  const messageParams = alert.message_params
  if (!('port' in messageParams)) return null
  if (!('fromVessel' in messageParams)) return null
  if (!('toVessel' in messageParams)) return null

  return computeTransshipmentSemanticDedupKey({
    port: messageParams.port,
    vesselFrom: messageParams.fromVessel,
    vesselTo: messageParams.toVessel,
    detectedAt: alert.detected_at,
  })
}

function mergeObservationFingerprints(
  current: readonly string[],
  incoming: readonly string[],
): readonly string[] {
  return [...new Set([...current, ...incoming])].sort()
}

function collapseTransshipmentOccurrences(
  pairs: readonly TransshipmentPair[],
): readonly TransshipmentOccurrence[] {
  const occurrences: TransshipmentOccurrence[] = []

  for (const pair of pairs) {
    const alertFingerprint = computeTransshipmentOccurrenceFingerprint(pair)
    const evidence = [pair.dischargeObs.fingerprint, pair.loadObs.fingerprint]
    const previousOccurrence = occurrences[occurrences.length - 1]

    if (previousOccurrence?.alertFingerprint === alertFingerprint) {
      occurrences[occurrences.length - 1] = {
        ...previousOccurrence,
        sourceObservationFingerprints: mergeObservationFingerprints(
          previousOccurrence.sourceObservationFingerprints,
          evidence,
        ),
      }
      continue
    }

    occurrences.push({
      dischargeObs: pair.dischargeObs,
      loadObs: pair.loadObs,
      port: pair.port,
      vesselFrom: pair.vesselFrom,
      vesselTo: pair.vesselTo,
      sourceObservationFingerprints: evidence,
      alertFingerprint,
    })
  }

  return occurrences
}

/**
 * Find consecutive DISCHARGE → LOAD pairs where the vessel changed.
 *
 * Rules:
 * - Only ACTUAL observations are considered
 * - Only LOAD and DISCHARGE events are relevant
 * - Both vessel names must be present and different
 * - ARRIVAL/DEPARTURE are irrelevant for vessel-change detection
 * - Ordering follows canonical observation chronology (null event_time last)
 *   with stable timeline order as the final tiebreaker
 *
 * @see docs/TRACKING_INVARIANTS.md
 */
function findTransshipmentPairs(timeline: Timeline): readonly TransshipmentPair[] {
  const events = timeline.observations
    .map((observation, timelineIndex) => ({ observation, timelineIndex }))
    .filter(
      (entry) =>
        (entry.observation.type === 'LOAD' || entry.observation.type === 'DISCHARGE') &&
        entry.observation.event_time_type === 'ACTUAL',
    )
    .sort((a, b) => {
      const chronologyCompare = compareObservationsChronologically(a.observation, b.observation)
      if (chronologyCompare !== 0) return chronologyCompare
      return a.timelineIndex - b.timelineIndex
    })
    .map((entry) => entry.observation)

  const pairs: TransshipmentPair[] = []

  for (let i = 0; i < events.length - 1; i++) {
    const prev = events[i]
    const curr = events[i + 1]

    if (prev === undefined || curr === undefined) continue
    if (prev.type !== 'DISCHARGE' || curr.type !== 'LOAD') continue

    const vesselFrom = prev.vessel_name?.trim() ?? ''
    const vesselTo = curr.vessel_name?.trim() ?? ''
    const normalizedVesselFrom = normalizeVesselName(prev.vessel_name)
    const normalizedVesselTo = normalizeVesselName(curr.vessel_name)

    // Cannot determine transshipment without both vessel names — conservative: skip
    if (normalizedVesselFrom === null || normalizedVesselTo === null) {
      continue
    }

    if (normalizedVesselFrom !== normalizedVesselTo) {
      const port = (curr.location_code ?? prev.location_code ?? 'UNKNOWN').toUpperCase()
      pairs.push({ dischargeObs: prev, loadObs: curr, port, vesselFrom, vesselTo })
    }
  }

  return pairs
}

/**
 * Derive transshipment info from a timeline.
 *
 * Transshipment is NOT a status — it's a derived attribute.
 * Definition: a transshipment occurs only when a container is DISCHARGED from vessel A
 * and LOADED onto vessel B, where vessel A ≠ vessel B.
 *
 * Rules:
 * - Only ACTUAL observations are considered
 * - Only LOAD and DISCHARGE events are relevant
 * - Port calls (ARRIVAL/DEPARTURE) without vessel change are NOT transshipment
 * - Restow (DISCHARGE + LOAD on the same vessel) is NOT transshipment
 * - Carrier data without vessel names → transshipment unknown (conservative: false)
 *
 * @see docs/TRACKING_INVARIANTS.md
 */
export function deriveTransshipment(timeline: Timeline): TransshipmentInfo {
  const occurrences = collapseTransshipmentOccurrences(findTransshipmentPairs(timeline))
  const ports = [...new Set(occurrences.map((occurrence) => occurrence.port))]

  return {
    hasTransshipment: occurrences.length > 0,
    transshipmentCount: occurrences.length,
    ports,
  }
}

export function deriveTransshipmentOccurrences(
  timeline: Timeline,
  now: Instant = systemClock.now(),
): readonly DerivedTransshipmentOccurrence[] {
  return collapseTransshipmentOccurrences(findTransshipmentPairs(timeline)).map((occurrence) => ({
    port: occurrence.port,
    vesselFrom: occurrence.vesselFrom,
    vesselTo: occurrence.vesselTo,
    detectedAt: toDetectedAtIso(occurrence.loadObs.event_time, now),
    sourceObservationFingerprints: [...occurrence.sourceObservationFingerprints],
    alertFingerprint: occurrence.alertFingerprint,
  }))
}

/**
 * Derive tracking alerts from timeline, status, and existing alerts.
 *
 * Alert derivation rules (from master doc §3 and §4.5):
 *
 * FACT-BASED alerts:
 *   - TRANSSHIPMENT: if hasTransshipment and not already alerted
 *   - CUSTOMS_HOLD: if any CUSTOMS_HOLD observation exists and not already alerted
 *   - Deduplication: by alert_fingerprint (type + evidence)
 *
 * MONITORING alerts:
 *   - ETA_MISSING: no ETA-related data available
 *   - Deduplication: deterministic fingerprint for episode-aware monitoring alerts
 *
 * @param timeline - Derived timeline
 * @param status - Current derived status
 * @param existingAlerts - Alert history for this container (active + acknowledged)
 * @param isBackfill - Whether this derivation is part of a backfill/onboarding
 * @param now - Current time (injectable for testing)
 * @returns Array of new alert descriptors to persist
 *
 * @see docs/ALERT_POLICY.md
 */
export function deriveAlertTransitions(
  timeline: Timeline,
  _status: ContainerStatus,
  existingAlerts: readonly TrackingAlertDerivationState[],
  isBackfill: boolean = false,
  now: Instant = systemClock.now(),
): DerivedAlertTransitions {
  const alerts: NewTrackingAlert[] = []
  const monitoringAutoResolutions: MonitoringAutoResolution[] = []
  const nowIso = now.toIsoString()

  // Build deduplication set for FACT alerts.
  // Monitoring alerts with breakpoint semantics are handled with dedicated cycle-aware checks.
  const existingFactFingerprints = new Set(
    existingAlerts
      .filter((a) => a.category === 'fact' && a.alert_fingerprint !== null)
      .map((a) => a.alert_fingerprint)
      .filter((fp): fp is string => fp !== null),
  )
  const existingTransshipmentSemanticDedupKeys = new Set(
    existingAlerts
      .map(toExistingTransshipmentSemanticDedupKey)
      .filter((key): key is string => key !== null),
  )

  // === FACT-BASED ALERTS ===
  // CRITICAL: Fact-based alerts should only trigger on ACTUAL observations

  // 1. Transshipment detection — one alert per confirmed DISCHARGE → LOAD vessel-change pair
  const transshipmentOccurrences = collapseTransshipmentOccurrences(findTransshipmentPairs(timeline))
  for (const occurrence of transshipmentOccurrences) {
    // detected_at = time the LOAD onto the new vessel was confirmed
    const detectedAt = toDetectedAtIso(occurrence.loadObs.event_time, now)
    const legacyFingerprint = computeLegacyTransshipmentFingerprint({
      dischargeObs: occurrence.dischargeObs,
      loadObs: occurrence.loadObs,
    })
    const semanticDedupKey = computeTransshipmentSemanticDedupKey({
      port: occurrence.port,
      vesselFrom: occurrence.vesselFrom,
      vesselTo: occurrence.vesselTo,
      detectedAt,
    })

    // Backward compatibility during fingerprint rollout:
    // - recognize alerts created with the older raw-observation fingerprint scheme
    // - also dedupe semantically equivalent persisted alerts across re-ingests
    if (existingFactFingerprints.has(occurrence.alertFingerprint)) continue
    if (existingFactFingerprints.has(legacyFingerprint)) continue
    if (existingTransshipmentSemanticDedupKeys.has(semanticDedupKey)) continue

    alerts.push({
      lifecycle_state: 'ACTIVE',
      container_id: timeline.container_id,
      category: 'fact',
      type: 'TRANSSHIPMENT',
      severity: 'warning',
      message_key: 'alerts.transshipmentDetected',
      message_params: {
        port: occurrence.port,
        fromVessel: occurrence.vesselFrom,
        toVessel: occurrence.vesselTo,
      },
      detected_at: detectedAt,
      triggered_at: nowIso,
      source_observation_fingerprints: [...occurrence.sourceObservationFingerprints],
      alert_fingerprint: occurrence.alertFingerprint,
      retroactive: isBackfill,
      provider: null,
      acked_at: null,
      acked_by: null,
      acked_source: null,
      resolved_at: null,
      resolved_reason: null,
    })
  }

  // 2. Customs hold - only ACTUAL customs holds should trigger alerts
  const customsHoldObs = timeline.observations.filter(
    (o) => o.type === 'CUSTOMS_HOLD' && o.event_time_type === 'ACTUAL',
  )
  if (customsHoldObs.length > 0) {
    const fingerprints = customsHoldObs.map((o) => o.fingerprint)
    const alertFingerprint = computeAlertFingerprint('CUSTOMS_HOLD', fingerprints)

    // Deduplicate by fingerprint (not just TYPE)
    if (!existingFactFingerprints.has(alertFingerprint)) {
      const firstHold = customsHoldObs[0]
      const locationText = resolveObservationLocationDisplay(firstHold)

      alerts.push({
        lifecycle_state: 'ACTIVE',
        container_id: timeline.container_id,
        category: 'fact',
        type: 'CUSTOMS_HOLD',
        severity: 'danger',
        message_key: 'alerts.customsHoldDetected',
        message_params: {
          location: locationText,
        },
        detected_at: toDetectedAtIso(firstHold?.event_time ?? null, now),
        triggered_at: nowIso,
        source_observation_fingerprints: fingerprints,
        alert_fingerprint: alertFingerprint,
        retroactive: isBackfill,
        provider: null,
        acked_at: null,
        acked_by: null,
        acked_source: null,
        resolved_at: null,
        resolved_reason: null,
      })
    }
  }

  return {
    newAlerts: alerts,
    monitoringAutoResolutions,
  }
}

export function deriveAlerts(
  timeline: Timeline,
  status: ContainerStatus,
  existingAlerts: readonly TrackingAlertDerivationState[],
  isBackfill: boolean = false,
  now: Instant = systemClock.now(),
): readonly NewTrackingAlert[] {
  return deriveAlertTransitions(timeline, status, existingAlerts, isBackfill, now).newAlerts
}
