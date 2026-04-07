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
  const pairs = findTransshipmentPairs(timeline)
  const ports = [...new Set(pairs.map((p) => p.port))]

  return {
    hasTransshipment: pairs.length > 0,
    transshipmentCount: pairs.length,
    ports,
  }
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

  // === FACT-BASED ALERTS ===
  // CRITICAL: Fact-based alerts should only trigger on ACTUAL observations

  // 1. Transshipment detection — one alert per confirmed DISCHARGE → LOAD vessel-change pair
  const transshipmentPairs = findTransshipmentPairs(timeline)
  for (const pair of transshipmentPairs) {
    const pairFingerprints = [pair.dischargeObs.fingerprint, pair.loadObs.fingerprint]
    const alertFingerprint = computeAlertFingerprint('TRANSSHIPMENT', pairFingerprints)

    // Deduplicate by fingerprint — same DISCHARGE+LOAD pair must not create duplicate alerts
    if (!existingFactFingerprints.has(alertFingerprint)) {
      // detected_at = time the LOAD onto the new vessel was confirmed
      const detectedAt = toDetectedAtIso(pair.loadObs.event_time, now)

      alerts.push({
        lifecycle_state: 'ACTIVE',
        container_id: timeline.container_id,
        category: 'fact',
        type: 'TRANSSHIPMENT',
        severity: 'warning',
        message_key: 'alerts.transshipmentDetected',
        message_params: {
          port: pair.port,
          fromVessel: pair.vesselFrom,
          toVessel: pair.vesselTo,
        },
        detected_at: detectedAt,
        triggered_at: nowIso,
        source_observation_fingerprints: pairFingerprints,
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
