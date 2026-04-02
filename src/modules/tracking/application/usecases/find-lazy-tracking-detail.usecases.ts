import {
  buildShipmentAlertIncidentsReadModel,
  type ShipmentAlertIncidentsReadModel,
} from '~/modules/tracking/application/projection/tracking.shipment-alert-incidents.readmodel'
import type { TrackingUseCasesDeps } from '~/modules/tracking/application/usecases/types'
import { computeFingerprint } from '~/modules/tracking/domain/identity/fingerprint'
import type { Snapshot } from '~/modules/tracking/domain/model/snapshot'
import { normalizeSnapshot } from '~/modules/tracking/features/observation/application/orchestration/normalizeSnapshot'
import { toTrackingObservationProjections } from '~/modules/tracking/features/observation/application/projection/tracking.observation.projection'
import type { Observation } from '~/modules/tracking/features/observation/domain/model/observation'
import type { TrackingSeriesHistory } from '~/modules/tracking/features/timeline/application/projection/tracking.timeline.readmodel'
import { deriveTimelineWithSeriesReadModel } from '~/modules/tracking/features/timeline/application/projection/tracking.timeline.readmodel'
import type { Instant } from '~/shared/time/instant'

type ContainerTarget = {
  readonly containerId: string
  readonly containerNumber: string
}

function hasCarrierLabel(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0
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

async function loadObservation(
  deps: TrackingUseCasesDeps,
  containerId: string,
  observationId: string,
): Promise<Observation | null> {
  if (deps.observationRepository.findById) {
    return deps.observationRepository.findById(containerId, observationId)
  }

  const observations = await deps.observationRepository.findAllByContainerId(containerId)
  return observations.find((observation) => observation.id === observationId) ?? null
}

async function loadSpecificSnapshots(
  deps: TrackingUseCasesDeps,
  containerId: string,
  snapshotIds: readonly string[],
): Promise<readonly Snapshot[]> {
  if (snapshotIds.length === 0) return []

  if (deps.snapshotRepository.findByIds) {
    return deps.snapshotRepository.findByIds(containerId, snapshotIds)
  }

  const allSnapshots = await deps.snapshotRepository.findAllByContainerId(containerId)
  const snapshotIdsSet = new Set(snapshotIds)
  return allSnapshots.filter((snapshot) => snapshotIdsSet.has(snapshot.id))
}

function enrichObservationCarrierLabel(
  observation: Observation,
  snapshots: readonly Snapshot[],
): Observation {
  if (observation.type !== 'OTHER' || hasCarrierLabel(observation.carrier_label)) {
    return observation
  }

  const labelsBySnapshotId = new Map<string, ReadonlyMap<string, string>>()
  for (const snapshot of snapshots) {
    labelsBySnapshotId.set(snapshot.id, buildCarrierLabelByFingerprint(snapshot))
  }

  const recoveredLabel = labelsBySnapshotId
    .get(observation.created_from_snapshot_id)
    ?.get(observation.fingerprint)

  if (!hasCarrierLabel(recoveredLabel)) {
    return observation
  }

  return {
    ...observation,
    carrier_label: recoveredLabel,
  }
}

async function loadAllAlertsByContainerId(
  deps: TrackingUseCasesDeps,
  containers: readonly ContainerTarget[],
) {
  const containerIds = containers.map((container) => container.containerId)
  if (containerIds.length === 0) return []

  if (deps.trackingAlertRepository.findByContainerIds) {
    return deps.trackingAlertRepository.findByContainerIds(containerIds)
  }

  const results = await Promise.all(
    containers.map((container) =>
      deps.trackingAlertRepository.findByContainerId(container.containerId),
    ),
  )
  return results.flat()
}

export async function findTimelineItemSeriesHistory(
  deps: TrackingUseCasesDeps,
  command: {
    readonly containerId: string
    readonly timelineItemId: string
    readonly now: Instant
  },
): Promise<TrackingSeriesHistory | null> {
  const observations = await deps.observationRepository.findAllByContainerId(command.containerId)
  const timeline = deriveTimelineWithSeriesReadModel(
    toTrackingObservationProjections(observations),
    command.now,
    { includeSeriesHistory: true },
  )
  const item = timeline.find((timelineItem) => timelineItem.id === command.timelineItemId)
  return item?.seriesHistory ?? null
}

export async function findObservationInspectorProjection(
  deps: TrackingUseCasesDeps,
  command: {
    readonly containerId: string
    readonly observationId: string
  },
): Promise<Observation | null> {
  const observation = await loadObservation(deps, command.containerId, command.observationId)
  if (observation === null) return null

  if (
    observation.type !== 'OTHER' ||
    hasCarrierLabel(observation.carrier_label) ||
    observation.created_from_snapshot_id.length === 0
  ) {
    return observation
  }

  const snapshots = await loadSpecificSnapshots(deps, command.containerId, [
    observation.created_from_snapshot_id,
  ])
  return enrichObservationCarrierLabel(observation, snapshots)
}

export async function findContainersRecognizedAlertIncidentsProjection(
  deps: TrackingUseCasesDeps,
  command: {
    readonly containers: readonly ContainerTarget[]
  },
): Promise<ShipmentAlertIncidentsReadModel> {
  const allAlerts = await loadAllAlertsByContainerId(deps, command.containers)

  return buildShipmentAlertIncidentsReadModel({
    containers: command.containers.map((container) => ({
      containerId: container.containerId,
      containerNumber: container.containerNumber,
      alerts: allAlerts.filter((alert) => alert.container_id === container.containerId),
    })),
  })
}
