import { normalizeSnapshot } from '~/modules/tracking/application/orchestration/normalizeSnapshot'
import { toTrackingObservationProjections } from '~/modules/tracking/application/projection/tracking.observation.projection'
import {
  deriveTrackingOperationalSummary,
  type TrackingOperationalSummary,
} from '~/modules/tracking/application/projection/tracking.operational-summary.readmodel'
import type { TrackingUseCasesDeps } from '~/modules/tracking/application/usecases/types'
import { deriveTransshipment } from '~/modules/tracking/domain/derive/deriveAlerts'
import { deriveStatus } from '~/modules/tracking/domain/derive/deriveStatus'
import { deriveTimeline } from '~/modules/tracking/domain/derive/deriveTimeline'
import { computeFingerprint } from '~/modules/tracking/domain/identity/fingerprint'
import type { TransshipmentInfo } from '~/modules/tracking/domain/logistics/transshipment'
import type { ContainerStatus } from '~/modules/tracking/domain/model/containerStatus'
import type { Observation } from '~/modules/tracking/domain/model/observation'
import type { Snapshot } from '~/modules/tracking/domain/model/snapshot'
import type { Timeline } from '~/modules/tracking/domain/model/timeline'
import type { TrackingAlert } from '~/modules/tracking/domain/model/trackingAlert'

/**
 * Command to retrieve the full tracking summary for a container.
 */
export type GetContainerSummaryCommand = {
  readonly containerId: string
  readonly containerNumber: string
  readonly podLocationCode?: string | null
  readonly now?: Date
  readonly includeAcknowledgedAlerts?: boolean
}

/**
 * Result — all derived tracking data for a single container.
 *
 * This is a formal Result DTO (application boundary contract),
 * NOT a ViewModel. Presenters/UI should transform this as needed.
 */
export type GetContainerSummaryResult = {
  readonly containerId: string
  readonly containerNumber: string
  readonly observations: readonly Observation[]
  readonly timeline: Timeline
  readonly status: ContainerStatus
  readonly transshipment: TransshipmentInfo
  readonly alerts: readonly TrackingAlert[]
  readonly operational: TrackingOperationalSummary
}

function hasCarrierLabel(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function collectSnapshotIdsForCarrierLabelEnrichment(
  observations: readonly Observation[],
): readonly string[] {
  const snapshotIds = new Set<string>()
  for (const observation of observations) {
    if (
      observation.type === 'OTHER' &&
      !hasCarrierLabel(observation.carrier_label) &&
      observation.created_from_snapshot_id.length > 0
    ) {
      snapshotIds.add(observation.created_from_snapshot_id)
    }
  }
  return [...snapshotIds]
}

function setCarrierLabelIfMissing(
  labelsByFingerprint: Map<string, string>,
  fingerprint: string,
  carrierLabel: string,
): void {
  if (!labelsByFingerprint.has(fingerprint)) {
    labelsByFingerprint.set(fingerprint, carrierLabel)
  }
}

function buildCarrierLabelByFingerprint(snapshot: Snapshot): ReadonlyMap<string, string> {
  const labelsByFingerprint = new Map<string, string>()
  const drafts = normalizeSnapshot(snapshot)

  for (const draft of drafts) {
    if (!hasCarrierLabel(draft.carrier_label)) continue
    setCarrierLabelIfMissing(labelsByFingerprint, computeFingerprint(draft), draft.carrier_label)

    // Legacy observations may have been fingerprinted as OTHER before semantic mapping was expanded.
    if (draft.type !== 'OTHER') {
      const legacyOtherFingerprint = computeFingerprint({
        ...draft,
        type: 'OTHER',
      })
      setCarrierLabelIfMissing(labelsByFingerprint, legacyOtherFingerprint, draft.carrier_label)
    }
  }

  return labelsByFingerprint
}

function enrichCarrierLabelsFromSnapshots(
  observations: readonly Observation[],
  snapshots: readonly Snapshot[],
): readonly Observation[] {
  if (observations.length === 0 || snapshots.length === 0) return observations

  const labelsBySnapshotId = new Map<string, ReadonlyMap<string, string>>()
  for (const snapshot of snapshots) {
    labelsBySnapshotId.set(snapshot.id, buildCarrierLabelByFingerprint(snapshot))
  }

  let hasChanges = false
  const enriched = observations.map((observation) => {
    if (observation.type !== 'OTHER' || hasCarrierLabel(observation.carrier_label)) {
      return observation
    }

    const labelsForSnapshot = labelsBySnapshotId.get(observation.created_from_snapshot_id)
    const recoveredLabel = labelsForSnapshot?.get(observation.fingerprint)

    if (!hasCarrierLabel(recoveredLabel)) {
      return observation
    }

    hasChanges = true
    return {
      ...observation,
      carrier_label: recoveredLabel,
    }
  })

  return hasChanges ? enriched : observations
}

async function loadSnapshotsForCarrierLabelEnrichment(
  deps: TrackingUseCasesDeps,
  containerId: string,
  snapshotIds: readonly string[],
): Promise<readonly Snapshot[]> {
  if (snapshotIds.length === 0) return []

  if (deps.snapshotRepository.findByIds) {
    return deps.snapshotRepository.findByIds(containerId, snapshotIds)
  }

  const allSnapshots = await deps.snapshotRepository.findAllByContainerId(containerId)
  if (allSnapshots.length === 0) return allSnapshots

  const neededSnapshotIds = new Set(snapshotIds)
  return allSnapshots.filter((snapshot) => neededSnapshotIds.has(snapshot.id))
}

/**
 * Get the full tracking summary for a container.
 *
 * Fetches observations and alerts from persistence,
 * then derives timeline, status, and transshipment info.
 */
export async function getContainerSummary(
  deps: TrackingUseCasesDeps,
  cmd: GetContainerSummaryCommand,
): Promise<GetContainerSummaryResult> {
  const referenceNow = cmd.now ?? new Date()
  const includeAcknowledgedAlerts = cmd.includeAcknowledgedAlerts ?? false
  const [observationsRaw, alerts] = await Promise.all([
    deps.observationRepository.findAllByContainerId(cmd.containerId),
    includeAcknowledgedAlerts
      ? deps.trackingAlertRepository.findByContainerId(cmd.containerId)
      : deps.trackingAlertRepository.findActiveByContainerId(cmd.containerId),
  ])

  const snapshotIdsToEnrich = collectSnapshotIdsForCarrierLabelEnrichment(observationsRaw)
  const observations =
    snapshotIdsToEnrich.length > 0
      ? enrichCarrierLabelsFromSnapshots(
          observationsRaw,
          await loadSnapshotsForCarrierLabelEnrichment(deps, cmd.containerId, snapshotIdsToEnrich),
        )
      : observationsRaw

  const timeline = deriveTimeline(cmd.containerId, cmd.containerNumber, observations, referenceNow)
  const status = deriveStatus(timeline)
  const transshipment = deriveTransshipment(timeline)
  const operational = deriveTrackingOperationalSummary({
    observations: toTrackingObservationProjections(observations),
    status,
    transshipment,
    podLocationCode: cmd.podLocationCode ?? null,
    now: referenceNow,
  })

  return {
    containerId: cmd.containerId,
    containerNumber: cmd.containerNumber,
    observations,
    timeline,
    status,
    transshipment,
    alerts,
    operational,
  }
}
