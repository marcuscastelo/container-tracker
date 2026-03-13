import type { TransshipmentInfo } from '~/modules/tracking/domain/logistics/transshipment'
import {
  computeAlertFingerprint,
  computeNoMovementAlertFingerprint,
} from '~/modules/tracking/features/alerts/domain/identity/alertFingerprint'
import type {
  NewTrackingAlert,
  TrackingAlertDerivationState,
  TrackingAlertResolvedReason,
} from '~/modules/tracking/features/alerts/domain/model/trackingAlert'
import { resolveAlertLifecycleState } from '~/modules/tracking/features/alerts/domain/model/trackingAlert'
import type { Observation } from '~/modules/tracking/features/observation/domain/model/observation'
import type { ContainerStatus } from '~/modules/tracking/features/status/domain/model/containerStatus'
import { compareObservationsChronologically } from '~/modules/tracking/features/timeline/domain/derive/deriveTimeline'
import type { Timeline } from '~/modules/tracking/features/timeline/domain/model/timeline'

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

export type MonitoringAutoResolution = {
  readonly alertId: string
  readonly reason: TrackingAlertResolvedReason
}

export type DerivedAlertTransitions = {
  readonly newAlerts: readonly NewTrackingAlert[]
  readonly monitoringAutoResolutions: readonly MonitoringAutoResolution[]
}

const TERMINAL_STATUSES: readonly ContainerStatus[] = ['DELIVERED', 'EMPTY_RETURNED']
const NO_MOVEMENT_BREAKPOINTS_DAYS = [5, 10, 20, 30] as const

function resolveObservationLocationDisplay(observation: Observation | null | undefined): string {
  const locationDisplay = observation?.location_display?.trim() ?? ''
  if (locationDisplay.length > 0) return locationDisplay

  const locationCode = observation?.location_code?.trim() ?? ''
  if (locationCode.length > 0) return locationCode

  return 'unknown location'
}

function toLatestActualEventWithTime(timeline: Timeline): Observation | undefined {
  return [...timeline.observations]
    .filter(
      (observation) => observation.event_time !== null && observation.event_time_type === 'ACTUAL',
    )
    .sort((a, b) => (b.event_time ?? '').localeCompare(a.event_time ?? ''))[0]
}

function toHighestCrossedNoMovementBreakpoint(daysWithoutMovement: number): number | null {
  const eligible = NO_MOVEMENT_BREAKPOINTS_DAYS.filter(
    (thresholdDays) => daysWithoutMovement >= thresholdDays,
  )
  if (eligible.length === 0) return null
  return eligible[eligible.length - 1] ?? null
}

function normalizeNoMovementThresholdDays(rawThresholdDays: number): number {
  const normalizedCandidate = Math.floor(rawThresholdDays)
  const breakpoint = toHighestCrossedNoMovementBreakpoint(normalizedCandidate)
  if (breakpoint !== null) return breakpoint
  return normalizedCandidate
}

function isNoMovementAlertDerivationState(
  alert: TrackingAlertDerivationState,
): alert is TrackingAlertDerivationState & {
  readonly type: 'NO_MOVEMENT'
  readonly category: 'monitoring'
  readonly message_params: {
    readonly threshold_days: number
    readonly days_without_movement: number
    readonly days: number
    readonly lastEventDate: string
  }
} {
  const params = alert.message_params
  return (
    alert.category === 'monitoring' &&
    alert.type === 'NO_MOVEMENT' &&
    'threshold_days' in params &&
    'days_without_movement' in params &&
    'days' in params &&
    'lastEventDate' in params &&
    typeof params.threshold_days === 'number' &&
    typeof params.days_without_movement === 'number' &&
    typeof params.days === 'number' &&
    typeof params.lastEventDate === 'string'
  )
}

function hasNoMovementBreakpointBeenEmittedForCurrentCycle(
  existingAlerts: readonly TrackingAlertDerivationState[],
  thresholdDays: number,
  cycleAnchorDate: string,
  cycleAnchorObservationFingerprint: string,
): boolean {
  for (const alert of existingAlerts) {
    if (!isNoMovementAlertDerivationState(alert)) continue
    const emittedThresholdDays = normalizeNoMovementThresholdDays(
      alert.message_params.threshold_days,
    )
    if (emittedThresholdDays !== thresholdDays) continue
    if (alert.message_params.lastEventDate === cycleAnchorDate) return true

    const hasSameCycleAnchorObservation = alert.source_observation_fingerprints.includes(
      cycleAnchorObservationFingerprint,
    )
    if (hasSameCycleAnchorObservation) return true
  }
  return false
}

function isMonitoringActiveAlert(alert: TrackingAlertDerivationState): boolean {
  return alert.category === 'monitoring' && resolveAlertLifecycleState(alert) === 'ACTIVE'
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

    const vesselFrom = prev.vessel_name?.trim() || null
    const vesselTo = curr.vessel_name?.trim() || null

    // Cannot determine transshipment without both vessel names — conservative: skip
    if (vesselFrom === null || vesselTo === null) continue

    if (vesselFrom !== vesselTo) {
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
 *   - NO_MOVEMENT: breakpoint escalation at 5 / 10 / 20 / 30 days since latest ACTUAL event
 *     - Emits only the highest crossed breakpoint
 *     - Acknowledgment does not allow re-emission of the same breakpoint in the same cycle
 *     - Cycle resets when a new ACTUAL event becomes the latest movement anchor
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
  status: ContainerStatus,
  existingAlerts: readonly TrackingAlertDerivationState[],
  isBackfill: boolean = false,
  now: Date = new Date(),
): DerivedAlertTransitions {
  const alerts: NewTrackingAlert[] = []
  const monitoringAutoResolutions: MonitoringAutoResolution[] = []
  const nowIso = now.toISOString()

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
      const detectedAt = pair.loadObs.event_time ?? nowIso

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
        detected_at: firstHold?.event_time ?? nowIso,
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

  // === MONITORING ALERTS (never retroactive) ===
  if (!isBackfill) {
    const isTerminal = TERMINAL_STATUSES.includes(status)
    const activeMonitoringAlerts = existingAlerts.filter(isMonitoringActiveAlert)

    const activeNoMovementAlertIds = activeMonitoringAlerts
      .filter((alert) => alert.type === 'NO_MOVEMENT')
      .map((alert) => alert.id)

    let hasNoMovementCondition = false
    if (!isTerminal) {
      // 3. No movement breakpoint escalation
      const lastActualEvent = toLatestActualEventWithTime(timeline)

      if (lastActualEvent?.event_time) {
        const lastEventDate = new Date(lastActualEvent.event_time)
        const daysSinceLastEvent = (now.getTime() - lastEventDate.getTime()) / (1000 * 60 * 60 * 24)
        const daysWithoutMovement = Math.floor(daysSinceLastEvent)
        const highestCrossedBreakpoint = toHighestCrossedNoMovementBreakpoint(daysWithoutMovement)

        if (highestCrossedBreakpoint !== null) {
          hasNoMovementCondition = true
          // Use a stable movement identity as cycle anchor. Prefer the
          // observation fingerprint (strong identity) and fall back to the
          // full event_time timestamp when fingerprint is absent. Using
          // a calendar date alone can cause false suppression when
          // late-arriving ACTUAL observations change the latest movement
          // within the same day.
          const cycleAnchorObservationFingerprint = lastActualEvent.fingerprint

          // Compute the legacy date-based cycle anchor first (used for the
          // persisted fingerprint) and retain the observation fingerprint for
          // cycle emission checks. This keeps deterministic fingerprints
          // compatible with existing expectations while also allowing us to
          // detect anchor changes via the stronger observation fingerprint.
          const cycleAnchorDate = lastActualEvent.event_time.slice(0, 10)

          const monitoringFingerprint = computeNoMovementAlertFingerprint(
            timeline.container_id,
            highestCrossedBreakpoint,
            cycleAnchorDate,
          )

          const alreadyEmittedForCycle = hasNoMovementBreakpointBeenEmittedForCurrentCycle(
            existingAlerts,
            highestCrossedBreakpoint,
            // keep legacy date param for backward compatibility checks inside
            // the helper; the helper also considers source observation
            // fingerprints when available
            cycleAnchorDate,
            cycleAnchorObservationFingerprint,
          )

          if (!alreadyEmittedForCycle) {
            alerts.push({
              lifecycle_state: 'ACTIVE',
              container_id: timeline.container_id,
              category: 'monitoring',
              type: 'NO_MOVEMENT',
              severity: 'warning',
              message_key: 'alerts.noMovementDetected',
              message_params: {
                threshold_days: highestCrossedBreakpoint,
                days_without_movement: daysWithoutMovement,
                // Keep `days` for compatibility with current UI translation keys.
                days: daysWithoutMovement,
                lastEventDate: cycleAnchorDate,
              },
              detected_at: nowIso,
              triggered_at: nowIso,
              source_observation_fingerprints: [cycleAnchorObservationFingerprint],
              alert_fingerprint: monitoringFingerprint,
              retroactive: false,
              provider: null,
              acked_at: null,
              acked_by: null,
              acked_source: null,
              resolved_at: null,
              resolved_reason: null,
            })
          }
        }
      }
    }

    if (activeNoMovementAlertIds.length > 0 && (isTerminal || !hasNoMovementCondition)) {
      const reason: TrackingAlertResolvedReason = isTerminal
        ? 'terminal_state'
        : 'condition_cleared'
      for (const alertId of activeNoMovementAlertIds) {
        monitoringAutoResolutions.push({ alertId, reason })
      }
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
  now: Date = new Date(),
): readonly NewTrackingAlert[] {
  return deriveAlertTransitions(timeline, status, existingAlerts, isBackfill, now).newAlerts
}
