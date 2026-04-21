import { processSnapshot } from '~/modules/tracking/application/orchestration/pipeline'
import type { TrackingAlertRepository } from '~/modules/tracking/application/ports/tracking.alert.repository'
import type { ObservationRepository } from '~/modules/tracking/application/ports/tracking.observation.repository'
import type { SnapshotRepository } from '~/modules/tracking/application/ports/tracking.snapshot.repository'
import type { TrackingSearchObservationProjection } from '~/modules/tracking/application/projection/tracking.search.readmodel'
import { isKnownProvider, type Provider } from '~/modules/tracking/domain/model/provider'
import type { Snapshot } from '~/modules/tracking/domain/model/snapshot'
import type {
  NewTrackingAlert,
  TrackingAlert,
  TrackingAlertDerivationState,
  TrackingAlertResolvedReason,
} from '~/modules/tracking/features/alerts/domain/model/trackingAlert'
import { resolveAlertLifecycleState } from '~/modules/tracking/features/alerts/domain/model/trackingAlert'
import type {
  NewObservation,
  Observation,
} from '~/modules/tracking/features/observation/domain/model/observation'
import { compareObservationsChronologically } from '~/modules/tracking/features/timeline/domain/derive/deriveTimeline'
import { Instant } from '~/shared/time/instant'

function compareSnapshotsChronologically(left: Snapshot, right: Snapshot): number {
  const fetchedAtCompare = left.fetched_at.localeCompare(right.fetched_at)
  if (fetchedAtCompare !== 0) {
    return fetchedAtCompare
  }

  return left.id.localeCompare(right.id)
}

function compareObservationChronology(left: Observation, right: Observation): number {
  const chronology = compareObservationsChronologically(left, right)
  if (chronology !== 0) {
    return chronology
  }

  return left.id.localeCompare(right.id)
}

function toReplayObservationProvider(provider: Observation['provider']): Provider {
  if (isKnownProvider(provider)) {
    return provider
  }

  return 'msc'
}

function toReplayAlertProvider(provider: TrackingAlert['provider']): Provider | null {
  if (provider === null) return null
  if (isKnownProvider(provider)) return provider
  return null
}

class InMemorySnapshotRepository implements SnapshotRepository {
  private readonly snapshotsByContainerId: Map<string, readonly Snapshot[]>

  constructor(snapshots: readonly Snapshot[]) {
    const grouped = new Map<string, Snapshot[]>()
    for (const snapshot of snapshots) {
      const existing = grouped.get(snapshot.container_id)
      if (existing) {
        existing.push(snapshot)
      } else {
        grouped.set(snapshot.container_id, [snapshot])
      }
    }

    this.snapshotsByContainerId = new Map(
      Array.from(grouped.entries()).map(([containerId, value]) => [
        containerId,
        [...value].sort(compareSnapshotsChronologically),
      ]),
    )
  }

  async insert(_snapshot: never): Promise<Snapshot> {
    throw new Error('InMemorySnapshotRepository.insert is not supported in replay execution')
  }

  async findLatestByContainerId(containerId: string): Promise<Snapshot | null> {
    const snapshots = this.snapshotsByContainerId.get(containerId) ?? []
    if (snapshots.length === 0) {
      return null
    }

    return snapshots[snapshots.length - 1] ?? null
  }

  async findAllByContainerId(containerId: string): Promise<readonly Snapshot[]> {
    return this.snapshotsByContainerId.get(containerId) ?? []
  }

  async findByIds(
    containerId: string,
    snapshotIds: readonly string[],
  ): Promise<readonly Snapshot[]> {
    const requested = new Set(snapshotIds)
    return (this.snapshotsByContainerId.get(containerId) ?? []).filter((snapshot) =>
      requested.has(snapshot.id),
    )
  }
}

class InMemoryObservationRepository implements ObservationRepository {
  private readonly observations: Observation[] = []
  private sequence = 0

  constructor(
    private readonly containerId: string,
    private readonly snapshotFetchedAtById: ReadonlyMap<string, string>,
  ) {}

  async insertMany(observations: readonly NewObservation[]): Promise<readonly Observation[]> {
    const inserted: Observation[] = []

    for (const observation of observations) {
      this.sequence += 1
      const snapshotFetchedAt = this.snapshotFetchedAtById.get(observation.created_from_snapshot_id)
      const baseEpochMs = snapshotFetchedAt ? Instant.fromIso(snapshotFetchedAt).toEpochMs() : 0

      const persisted: Observation = {
        id: `replay-observation-${this.sequence}`,
        fingerprint: observation.fingerprint,
        container_id: observation.container_id,
        container_number: observation.container_number,
        type: observation.type,
        event_time: observation.event_time,
        event_time_type: observation.event_time_type,
        location_code: observation.location_code,
        location_display: observation.location_display,
        vessel_name: observation.vessel_name,
        voyage: observation.voyage,
        is_empty: observation.is_empty,
        confidence: observation.confidence,
        provider: toReplayObservationProvider(observation.provider),
        created_from_snapshot_id: observation.created_from_snapshot_id,
        carrier_label: observation.carrier_label ?? null,
        raw_event_time: observation.raw_event_time ?? null,
        event_time_source: observation.event_time_source ?? null,
        created_at: Instant.fromEpochMs(baseEpochMs + this.sequence).toIsoString(),
        retroactive: observation.retroactive ?? false,
      }

      this.observations.push(persisted)
      inserted.push(persisted)
    }

    return inserted
  }

  async findAllByContainerId(containerId: string): Promise<readonly Observation[]> {
    if (containerId !== this.containerId) {
      return []
    }

    return [...this.observations].sort(compareObservationChronology)
  }

  async findAllByContainerIds(containerIds: readonly string[]): Promise<readonly Observation[]> {
    const requested = new Set(containerIds)
    if (!requested.has(this.containerId)) {
      return []
    }

    return [...this.observations].sort(compareObservationChronology)
  }

  async findById(containerId: string, observationId: string): Promise<Observation | null> {
    if (containerId !== this.containerId) {
      return null
    }

    const found = this.observations.find((observation) => observation.id === observationId)
    return found ?? null
  }

  async findFingerprintsByContainerId(containerId: string): Promise<ReadonlySet<string>> {
    if (containerId !== this.containerId) {
      return new Set<string>()
    }

    return new Set(this.observations.map((observation) => observation.fingerprint))
  }

  async listSearchObservations(): Promise<readonly TrackingSearchObservationProjection[]> {
    return []
  }
}

class InMemoryTrackingAlertRepository implements TrackingAlertRepository {
  private readonly alerts: TrackingAlert[] = []
  private sequence = 0

  constructor(
    private readonly containerId: string,
    private readonly containerNumber: string,
  ) {}

  async insertMany(alerts: readonly NewTrackingAlert[]): Promise<readonly TrackingAlert[]> {
    const inserted: TrackingAlert[] = []

    for (const alert of alerts) {
      this.sequence += 1
      const persisted: TrackingAlert = {
        ...alert,
        id: `replay-alert-${this.sequence}`,
        lifecycle_state: alert.lifecycle_state ?? 'ACTIVE',
        source_observation_fingerprints: [...alert.source_observation_fingerprints],
        provider: toReplayAlertProvider(alert.provider),
        resolved_at: alert.resolved_at ?? null,
        resolved_reason: alert.resolved_reason ?? null,
      }

      this.alerts.push(persisted)
      inserted.push(persisted)
    }

    return inserted
  }

  async findActiveByContainerId(containerId: string): Promise<readonly TrackingAlert[]> {
    if (containerId !== this.containerId) {
      return []
    }

    return this.alerts.filter((alert) => resolveAlertLifecycleState(alert) === 'ACTIVE')
  }

  async findActiveByContainerIds(
    containerIds: readonly string[],
  ): Promise<readonly TrackingAlert[]> {
    const requested = new Set(containerIds)
    if (!requested.has(this.containerId)) {
      return []
    }

    return this.alerts.filter((alert) => resolveAlertLifecycleState(alert) === 'ACTIVE')
  }

  async findByContainerId(containerId: string): Promise<readonly TrackingAlert[]> {
    if (containerId !== this.containerId) {
      return []
    }

    return [...this.alerts]
  }

  async findByContainerIds(containerIds: readonly string[]): Promise<readonly TrackingAlert[]> {
    const requested = new Set(containerIds)
    if (!requested.has(this.containerId)) {
      return []
    }

    return [...this.alerts]
  }

  async findAlertDerivationStateByContainerId(
    containerId: string,
  ): Promise<readonly TrackingAlertDerivationState[]> {
    if (containerId !== this.containerId) {
      return []
    }

    return this.alerts.map((alert) => ({
      id: alert.id,
      category: alert.category,
      type: alert.type,
      message_params: alert.message_params,
      detected_at: alert.detected_at,
      source_observation_fingerprints: [...alert.source_observation_fingerprints],
      alert_fingerprint: alert.alert_fingerprint,
      acked_at: alert.acked_at,
      resolved_at: alert.resolved_at ?? null,
    }))
  }

  async findContainerNumbersByIds(
    containerIds: readonly string[],
  ): Promise<ReadonlyMap<string, string>> {
    const map = new Map<string, string>()

    for (const containerId of containerIds) {
      if (containerId === this.containerId) {
        map.set(containerId, this.containerNumber)
      }
    }

    return map
  }

  async findActiveTypesByContainerId(containerId: string): Promise<ReadonlySet<string>> {
    if (containerId !== this.containerId) {
      return new Set<string>()
    }

    return new Set(
      this.alerts
        .filter((alert) => resolveAlertLifecycleState(alert) === 'ACTIVE')
        .map((alert) => alert.type),
    )
  }

  async listActiveAlertReadModel() {
    return []
  }

  async acknowledge(
    alertId: string,
    ackedAt: string,
    metadata: {
      readonly ackedBy: string | null
      readonly ackedSource: TrackingAlert['acked_source']
    },
  ): Promise<void> {
    for (const alert of this.alerts) {
      if (alert.id !== alertId) continue
      if (resolveAlertLifecycleState(alert) !== 'ACTIVE') continue

      alert.lifecycle_state = 'ACKED'
      alert.acked_at = ackedAt
      alert.acked_by = metadata.ackedBy
      alert.acked_source = metadata.ackedSource
      alert.resolved_at = null
      alert.resolved_reason = null
    }
  }

  async unacknowledge(alertId: string): Promise<void> {
    for (const alert of this.alerts) {
      if (alert.id !== alertId) continue
      if (resolveAlertLifecycleState(alert) !== 'ACKED') continue

      alert.lifecycle_state = 'ACTIVE'
      alert.acked_at = null
      alert.acked_by = null
      alert.acked_source = null
      alert.resolved_at = null
      alert.resolved_reason = null
    }
  }

  async autoResolveMany(command: {
    readonly alertIds: readonly string[]
    readonly resolvedAt: string
    readonly reason: TrackingAlertResolvedReason
  }): Promise<void> {
    const targetIds = new Set(command.alertIds)

    for (const alert of this.alerts) {
      if (!targetIds.has(alert.id)) continue
      if (alert.category !== 'monitoring') continue
      if (resolveAlertLifecycleState(alert) !== 'ACTIVE') continue

      alert.lifecycle_state = 'AUTO_RESOLVED'
      alert.resolved_at = command.resolvedAt
      alert.resolved_reason = command.reason
      alert.acked_at = null
      alert.acked_by = null
      alert.acked_source = null
    }
  }
}

export async function executeContainerReplay(command: {
  readonly containerId: string
  readonly containerNumber: string
  readonly snapshots: readonly Snapshot[]
  readonly onHeartbeat: (snapshot: Snapshot) => Promise<void>
}): Promise<{
  readonly snapshots: readonly Snapshot[]
  readonly observations: readonly Observation[]
  readonly alerts: readonly TrackingAlert[]
}> {
  const sortedSnapshots = [...command.snapshots].sort(compareSnapshotsChronologically)
  const snapshotFetchedAtById = new Map(
    sortedSnapshots.map((snapshot) => [snapshot.id, snapshot.fetched_at] as const),
  )

  const snapshotRepository = new InMemorySnapshotRepository(sortedSnapshots)
  const observationRepository = new InMemoryObservationRepository(
    command.containerId,
    snapshotFetchedAtById,
  )
  const trackingAlertRepository = new InMemoryTrackingAlertRepository(
    command.containerId,
    command.containerNumber,
  )

  for (const snapshot of sortedSnapshots) {
    await command.onHeartbeat(snapshot)

    await processSnapshot(
      snapshot,
      command.containerId,
      command.containerNumber,
      {
        snapshotRepository,
        observationRepository,
        trackingAlertRepository,
      },
      true,
      Instant.fromIso(snapshot.fetched_at),
    )
  }

  const observations = await observationRepository.findAllByContainerId(command.containerId)
  const alerts = await trackingAlertRepository.findByContainerId(command.containerId)

  return {
    snapshots: sortedSnapshots,
    observations,
    alerts,
  }
}
