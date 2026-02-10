import type { ContainerStatus } from '~/modules/tracking/domain/containerStatus'
import type { Timeline } from '~/modules/tracking/domain/timeline'
import type { NewTrackingAlert } from '~/modules/tracking/domain/trackingAlert'
import type { TransshipmentInfo } from '~/modules/tracking/domain/transshipment'

/**
 * Derive transshipment info from a timeline.
 *
 * Transshipment is NOT a status — it's a derived attribute.
 * Rule: unique ports involved in LOAD/DISCHARGE events.
 * If more than 2 unique ports → transshipment occurred.
 *
 * @see docs/master-consolidated-0209.md §4.4
 */
export function deriveTransshipment(timeline: Timeline): TransshipmentInfo {
  const ports = new Set<string>()

  // Consider LOAD/DISCHARGE events as primary indicators, but also include
  // ARRIVAL/DEPARTURE observations when they carry a location_code. Some
  // carriers (Maersk, etc.) may not emit explicit LOAD/DISCHARGE pairs for
  // transshipment legs — they only show ARRIVAL/DEPARTURE on different
  // vessels. Including these types improves transshipment detection for
  // real-world carrier data while remaining conservative (we still require
  // ACTUAL evidence when creating a fact alert below).
  for (const obs of timeline.observations) {
    const relevantTypes = ['LOAD', 'DISCHARGE', 'ARRIVAL', 'DEPARTURE']
    if (relevantTypes.includes(obs.type) && obs.location_code) {
      ports.add(obs.location_code.toUpperCase())
    }
  }

  const uniquePorts = [...ports]
  const count = Math.max(0, uniquePorts.length - 2)

  return {
    hasTransshipment: count > 0,
    transshipmentCount: count,
    ports: uniquePorts,
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
 *
 * MONITORING alerts:
 *   - NO_MOVEMENT: if daysSinceLastEvent > threshold (default 7 days)
 *   - ETA_MISSING: no ETA-related data available
 *
 * @param timeline - Derived timeline
 * @param status - Current derived status
 * @param existingAlertTypes - Set of alert types already active for this container (to avoid duplicates)
 * @param isBackfill - Whether this derivation is part of a backfill/onboarding
 * @param now - Current time (injectable for testing)
 * @returns Array of new alert descriptors to persist
 *
 * @see docs/master-consolidated-0209.md §4.5
 */
export function deriveAlerts(
  timeline: Timeline,
  status: ContainerStatus,
  existingAlertTypes: ReadonlySet<string>,
  isBackfill: boolean = false,
  now: Date = new Date(),
): NewTrackingAlert[] {
  const alerts: NewTrackingAlert[] = []
  const nowIso = now.toISOString()

  // === FACT-BASED ALERTS ===
  // CRITICAL: Fact-based alerts should only trigger on ACTUAL observations

  // 1. Transshipment detection
  const transshipment = deriveTransshipment(timeline)
  if (transshipment.hasTransshipment && !existingAlertTypes.has('TRANSSHIPMENT')) {
    // Find the ACTUAL observations that indicate transshipment
    const transshipmentObs = timeline.observations.filter(
      (o) =>
        o.event_time_type === 'ACTUAL' &&
        (o.type === 'LOAD' || o.type === 'DISCHARGE') &&
        o.location_code !== null,
    )

    // Only create alert if we have ACTUAL evidence
    if (transshipmentObs.length > 0) {
      const fingerprints = transshipmentObs.map((o) => o.fingerprint)

      // For fact alerts, detected_at = time of the earliest transshipment evidence
      const earliestTime = transshipmentObs
        .filter((o) => o.event_time !== null)
        .sort((a, b) => (a.event_time ?? '').localeCompare(b.event_time ?? ''))[0]?.event_time

      alerts.push({
        container_id: timeline.container_id,
        category: 'fact',
        type: 'TRANSSHIPMENT',
        severity: 'warning',
        message: `Transshipment detected: ${transshipment.transshipmentCount} intermediate port(s) — ${transshipment.ports.join(', ')}`,
        detected_at: earliestTime ?? nowIso,
        triggered_at: nowIso,
        source_observation_fingerprints: fingerprints,
        retroactive: isBackfill,
        provider: null,
        acked_at: null,
        dismissed_at: null,
      })
    }
  }

  // 2. Customs hold - only ACTUAL customs holds should trigger alerts
  const customsHoldObs = timeline.observations.filter(
    (o) => o.type === 'CUSTOMS_HOLD' && o.event_time_type === 'ACTUAL',
  )
  if (customsHoldObs.length > 0 && !existingAlertTypes.has('CUSTOMS_HOLD')) {
    const firstHold = customsHoldObs[0]
    alerts.push({
      container_id: timeline.container_id,
      category: 'fact',
      type: 'CUSTOMS_HOLD',
      severity: 'danger',
      message: `Customs hold detected at ${firstHold?.location_display ?? firstHold?.location_code ?? 'unknown location'}`,
      detected_at: firstHold?.event_time ?? nowIso,
      triggered_at: nowIso,
      source_observation_fingerprints: customsHoldObs.map((o) => o.fingerprint),
      retroactive: isBackfill,
      provider: null,
      acked_at: null,
      dismissed_at: null,
    })
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
      const terminalStatuses: readonly ContainerStatus[] = ['DELIVERED', 'EMPTY_RETURNED']
      const isTerminal = terminalStatuses.includes(status)

      if (
        daysSinceLastEvent > NO_MOVEMENT_THRESHOLD_DAYS &&
        !isTerminal &&
        !existingAlertTypes.has('NO_MOVEMENT')
      ) {
        alerts.push({
          container_id: timeline.container_id,
          category: 'monitoring',
          type: 'NO_MOVEMENT',
          severity: 'warning',
          message: `No movement detected for ${Math.floor(daysSinceLastEvent)} days (last event: ${lastEventWithTime.event_time.slice(0, 10)})`,
          detected_at: nowIso,
          triggered_at: nowIso,
          source_observation_fingerprints: [lastEventWithTime.fingerprint],
          retroactive: false,
          provider: null,
          acked_at: null,
          dismissed_at: null,
        })
      }
    }
  }

  return alerts
}
