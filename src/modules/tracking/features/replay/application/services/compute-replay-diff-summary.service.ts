import { TRACKING_CHRONOLOGY_COMPARE_OPTIONS } from '~/modules/tracking/domain/temporal/tracking-temporal'
import type { TrackingAlert } from '~/modules/tracking/features/alerts/domain/model/trackingAlert'
import type { Observation } from '~/modules/tracking/features/observation/domain/model/observation'
import {
  EMPTY_REPLAY_DIFF_SUMMARY,
  type ReplayDiffSummary,
  type ReplayTemporalConflict,
} from '~/modules/tracking/features/replay/domain/replay-diff'
import { deriveStatus } from '~/modules/tracking/features/status/domain/derive/deriveStatus'
import { deriveTimeline } from '~/modules/tracking/features/timeline/domain/derive/deriveTimeline'
import { systemClock } from '~/shared/time/clock'
import { toComparableInstant } from '~/shared/time/compare-temporal'

function findContainerNumber(
  fallbackContainerNumber: string,
  observations: readonly Observation[],
): string {
  const firstWithNumber = observations.find(
    (observation) => observation.container_number.trim().length > 0,
  )
  return firstWithNumber?.container_number ?? fallbackContainerNumber
}

function toStatusLabel(command: {
  readonly containerId: string
  readonly containerNumber: string
  readonly observations: readonly Observation[]
}): string {
  const now = systemClock.now()
  const timeline = deriveTimeline(
    command.containerId,
    command.containerNumber,
    command.observations,
    now,
  )
  return deriveStatus(timeline)
}

function toAlertFingerprintSet(alerts: readonly TrackingAlert[]): ReadonlySet<string> {
  const set = new Set<string>()
  for (const alert of alerts) {
    if (alert.alert_fingerprint !== null) {
      set.add(alert.alert_fingerprint)
      continue
    }

    set.add(`${alert.type}:${alert.detected_at}:${alert.message_key}`)
  }
  return set
}

function createTemporalConflictFingerprintKey(observation: Observation): string {
  const identityParts = [
    observation.type,
    observation.raw_event_time ?? 'null',
    observation.location_code ?? observation.location_display ?? 'null',
    observation.vessel_name ?? 'null',
    observation.voyage ?? 'null',
  ]

  return identityParts.join('|')
}

function toComparableInstantIso(observation: Observation): string | null {
  if (observation.event_time === null) return null

  return toComparableInstant(
    observation.event_time,
    TRACKING_CHRONOLOGY_COMPARE_OPTIONS,
  ).toIsoString()
}

function collectTemporalConflicts(command: {
  readonly current: readonly Observation[]
  readonly candidate: readonly Observation[]
}): readonly ReplayTemporalConflict[] {
  const currentByFingerprintKey = new Map<string, Set<string>>()
  const currentRawEventTimeByFingerprintKey = new Map<string, string | null>()

  for (const observation of command.current) {
    const fingerprintKey = createTemporalConflictFingerprintKey(observation)
    currentRawEventTimeByFingerprintKey.set(fingerprintKey, observation.raw_event_time ?? null)
    const instantIso = toComparableInstantIso(observation)
    const existing = currentByFingerprintKey.get(fingerprintKey)
    if (existing) {
      existing.add(instantIso ?? 'null')
    } else {
      currentByFingerprintKey.set(fingerprintKey, new Set([instantIso ?? 'null']))
    }
  }

  const candidateByFingerprintKey = new Map<string, Set<string>>()
  for (const observation of command.candidate) {
    const fingerprintKey = createTemporalConflictFingerprintKey(observation)
    const instantIso = toComparableInstantIso(observation)
    const existing = candidateByFingerprintKey.get(fingerprintKey)
    if (existing) {
      existing.add(instantIso ?? 'null')
    } else {
      candidateByFingerprintKey.set(fingerprintKey, new Set([instantIso ?? 'null']))
    }
  }

  const conflicts: ReplayTemporalConflict[] = []

  for (const [fingerprintKey, currentInstants] of currentByFingerprintKey.entries()) {
    const candidateInstants = candidateByFingerprintKey.get(fingerprintKey)
    if (!candidateInstants) continue

    const currentValues = Array.from(currentInstants).sort()
    const candidateValues = Array.from(candidateInstants).sort()

    if (currentValues.length === candidateValues.length) {
      const equalsAll = currentValues.every((value, index) => value === candidateValues[index])
      if (equalsAll) continue
    }

    const beforeValue = currentValues[0] ?? 'null'
    const afterValue = candidateValues[0] ?? 'null'

    conflicts.push({
      fingerprintKey,
      rawEventTime: currentRawEventTimeByFingerprintKey.get(fingerprintKey) ?? null,
      beforeInstant: beforeValue === 'null' ? null : beforeValue,
      afterInstant: afterValue === 'null' ? null : afterValue,
    })
  }

  return conflicts
}

export function computeReplayDiffSummary(command: {
  readonly containerId: string
  readonly containerNumber: string
  readonly snapshotCount: number
  readonly currentGenerationId: string | null
  readonly candidateGenerationId: string | null
  readonly currentObservations: readonly Observation[]
  readonly candidateObservations: readonly Observation[]
  readonly currentAlerts: readonly TrackingAlert[]
  readonly candidateAlerts: readonly TrackingAlert[]
}): ReplayDiffSummary {
  if (command.currentGenerationId === null && command.candidateGenerationId === null) {
    return {
      ...EMPTY_REPLAY_DIFF_SUMMARY,
      snapshotCount: command.snapshotCount,
    }
  }

  const currentFingerprints = new Set(
    command.currentObservations.map((observation) => observation.fingerprint),
  )
  const candidateFingerprints = new Set(
    command.candidateObservations.map((observation) => observation.fingerprint),
  )

  const addedObservationFingerprints = Array.from(candidateFingerprints).filter(
    (fingerprint) => !currentFingerprints.has(fingerprint),
  )
  const removedObservationFingerprints = Array.from(currentFingerprints).filter(
    (fingerprint) => !candidateFingerprints.has(fingerprint),
  )

  const currentStatus = toStatusLabel({
    containerId: command.containerId,
    containerNumber: findContainerNumber(command.containerNumber, command.currentObservations),
    observations: command.currentObservations,
  })
  const candidateStatus = toStatusLabel({
    containerId: command.containerId,
    containerNumber: findContainerNumber(command.containerNumber, command.candidateObservations),
    observations: command.candidateObservations,
  })

  const currentAlertFingerprints = toAlertFingerprintSet(command.currentAlerts)
  const candidateAlertFingerprints = toAlertFingerprintSet(command.candidateAlerts)

  const alertsChanged =
    currentAlertFingerprints.size !== candidateAlertFingerprints.size ||
    Array.from(currentAlertFingerprints).some(
      (fingerprint) => !candidateAlertFingerprints.has(fingerprint),
    )

  return {
    snapshotCount: command.snapshotCount,
    currentGenerationId: command.currentGenerationId,
    candidateGenerationId: command.candidateGenerationId,
    observationsCurrentCount: command.currentObservations.length,
    observationsCandidateCount: command.candidateObservations.length,
    alertsCurrentCount: command.currentAlerts.length,
    alertsCandidateCount: command.candidateAlerts.length,
    addedObservationFingerprints,
    removedObservationFingerprints,
    statusChanged: currentStatus !== candidateStatus,
    statusBefore: currentStatus,
    statusAfter: candidateStatus,
    alertsChanged,
    potentialTemporalConflicts: collectTemporalConflicts({
      current: command.currentObservations,
      candidate: command.candidateObservations,
    }),
  }
}
