import type { TransshipmentInfo } from '~/modules/tracking/domain/logistics/transshipment'
import { computeAlertFingerprint } from '~/modules/tracking/features/alerts/domain/identity/alertFingerprint'
import type {
  NewTrackingAlert,
  TrackingAlert,
} from '~/modules/tracking/features/alerts/domain/model/trackingAlert'
import type { Observation } from '~/modules/tracking/features/observation/domain/model/observation'
import type { ContainerStatus } from '~/modules/tracking/features/status/domain/model/containerStatus'
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

const TERMINAL_STATUSES: readonly ContainerStatus[] = ['DELIVERED', 'EMPTY_RETURNED']

function resolveObservationLocationDisplay(observation: Observation | null | undefined): string {
  const locationDisplay = observation?.location_display?.trim() ?? ''
  if (locationDisplay.length > 0) return locationDisplay

  const locationCode = observation?.location_code?.trim() ?? ''
  if (locationCode.length > 0) return locationCode

  return 'unknown location'
}

/**
 * Find consecutive DISCHARGE → LOAD pairs where the vessel changed.
 *
 * Rules:
 * - Only ACTUAL observations are considered
 * - Only LOAD and DISCHARGE events are relevant
 * - Both vessel names must be present and different
 * - ARRIVAL/DEPARTURE are irrelevant for vessel-change detection
 * - Ordering is deterministic: event_time → type → location_code → fingerprint
 *
 * @see docs/TRACKING_INVARIANTS.md
 */
function findTransshipmentPairs(timeline: Timeline): readonly TransshipmentPair[] {
  const events = [...timeline.observations]
    .filter((o) => (o.type === 'LOAD' || o.type === 'DISCHARGE') && o.event_time_type === 'ACTUAL')
    .sort((a, b) => {
      const timeCompare = (a.event_time ?? '').localeCompare(b.event_time ?? '')
      if (timeCompare !== 0) return timeCompare
      const typeCompare = a.type.localeCompare(b.type)
      if (typeCompare !== 0) return typeCompare
      const locCompare = (a.location_code ?? '').localeCompare(b.location_code ?? '')
      if (locCompare !== 0) return locCompare
      return a.fingerprint.localeCompare(b.fingerprint)
    })

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
 *   - NO_MOVEMENT: if daysSinceLastEvent > threshold (default 7 days)
 *   - ETA_MISSING: no ETA-related data available
 *   - Deduplication: by TYPE across full alert history (ACK does not reset idempotency)
 *
 * @param timeline - Derived timeline
 * @param status - Current derived status
 * @param existingAlerts - Alert history for this container (active + acknowledged)
 * @param isBackfill - Whether this derivation is part of a backfill/onboarding
 * @param now - Current time (injectable for testing)
 * @returns Array of new alert descriptors to persist
 *
 * @see docs/master-consolidated-0209.md §4.5
 */
export function deriveAlerts(
  timeline: Timeline,
  status: ContainerStatus,
  existingAlerts: readonly TrackingAlert[],
  isBackfill: boolean = false,
  now: Date = new Date(),
): NewTrackingAlert[] {
  const alerts: NewTrackingAlert[] = []
  const nowIso = now.toISOString()

  // Build deduplication sets
  // - FACT alerts: deduplicate by fingerprint across full history (ACK must not reset idempotency)
  // - MONITORING alerts: deduplicate by type across full history (ACK must not reset idempotency)
  const existingFactFingerprints = new Set(
    existingAlerts
      .filter((a) => a.category === 'fact' && a.alert_fingerprint !== null)
      .map((a) => a.alert_fingerprint)
      .filter((fp): fp is string => fp !== null),
  )
  const existingMonitoringTypes = new Set(
    existingAlerts.filter((a) => a.category === 'monitoring').map((a) => a.type),
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
      })
    }
  }

  // === MONITORING ALERTS (never retroactive) ===
  if (!isBackfill) {
    // 3. No movement detection
    const NO_MOVEMENT_THRESHOLD_DAYS = 7
    const lastEventWithTime = [...timeline.observations]
      .filter((o) => o.event_time !== null)
      .sort((a, b) => (b.event_time ?? '').localeCompare(a.event_time ?? ''))[0]

    if (lastEventWithTime?.event_time) {
      const lastEventDate = new Date(lastEventWithTime.event_time)
      const daysSinceLastEvent = (now.getTime() - lastEventDate.getTime()) / (1000 * 60 * 60 * 24)

      // Only alert if container is not in a terminal state
      const isTerminal = TERMINAL_STATUSES.includes(status)

      if (
        daysSinceLastEvent > NO_MOVEMENT_THRESHOLD_DAYS &&
        !isTerminal &&
        !existingMonitoringTypes.has('NO_MOVEMENT')
      ) {
        const daysWithoutMovement = Math.floor(daysSinceLastEvent)
        alerts.push({
          container_id: timeline.container_id,
          category: 'monitoring',
          type: 'NO_MOVEMENT',
          severity: 'warning',
          message_key: 'alerts.noMovementDetected',
          message_params: {
            days: daysWithoutMovement,
            lastEventDate: lastEventWithTime.event_time.slice(0, 10),
          },
          detected_at: nowIso,
          triggered_at: nowIso,
          source_observation_fingerprints: [lastEventWithTime.fingerprint],
          alert_fingerprint: null, // Monitoring alerts don't use fingerprint dedup
          retroactive: false,
          provider: null,
          acked_at: null,
          acked_by: null,
          acked_source: null,
        })
      }
    }
  }

  return alerts
}
