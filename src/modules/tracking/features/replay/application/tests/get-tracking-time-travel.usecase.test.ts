import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import type { TrackingAlertRepository } from '~/modules/tracking/application/ports/tracking.alert.repository'
import type { ObservationRepository } from '~/modules/tracking/application/ports/tracking.observation.repository'
import type { SnapshotRepository } from '~/modules/tracking/application/ports/tracking.snapshot.repository'
import { createTrackingUseCases } from '~/modules/tracking/application/tracking.usecases'
import type { TrackingUseCasesDeps } from '~/modules/tracking/application/usecases/types'
import type { NewSnapshot, Snapshot } from '~/modules/tracking/domain/model/snapshot'
import type { TrackingActiveAlertReadModel } from '~/modules/tracking/features/alerts/application/projection/tracking.active-alert.readmodel'
import { deriveAlerts } from '~/modules/tracking/features/alerts/domain/derive/deriveAlerts'
import type {
  NewTrackingAlert,
  TrackingAlert,
  TrackingAlertAckSource,
  TrackingAlertDerivationState,
} from '~/modules/tracking/features/alerts/domain/model/trackingAlert'
import { resolveAlertLifecycleState } from '~/modules/tracking/features/alerts/domain/model/trackingAlert'
import { toTrackingObservationProjections } from '~/modules/tracking/features/observation/application/projection/tracking.observation.projection'
import type {
  NewObservation,
  Observation,
} from '~/modules/tracking/features/observation/domain/model/observation'
import type { TrackingTimelineItem } from '~/modules/tracking/features/timeline/application/projection/tracking.timeline.readmodel'
import { deriveTimelineWithSeriesReadModel } from '~/modules/tracking/features/timeline/application/projection/tracking.timeline.readmodel'
import maerskPayload from '~/modules/tracking/infrastructure/carriers/tests/fixtures/maersk/maersk_full.json'
import { Instant } from '~/shared/time/instant'
import { instantFromIsoText } from '~/shared/time/tests/helpers'

class InMemorySnapshotRepository implements SnapshotRepository {
  private snapshots = new Map<string, Snapshot>()

  async insert(snapshot: NewSnapshot): Promise<Snapshot> {
    const created: Snapshot = {
      ...snapshot,
      id: randomUUID(),
    }
    this.snapshots.set(created.id, created)
    return created
  }

  async findLatestByContainerId(containerId: string): Promise<Snapshot | null> {
    const snapshots = await this.findAllByContainerId(containerId)
    return snapshots[0] ?? null
  }

  async findAllByContainerId(containerId: string): Promise<readonly Snapshot[]> {
    return [...this.snapshots.values()]
      .filter((snapshot) => snapshot.container_id === containerId)
      .sort((left, right) => right.fetched_at.localeCompare(left.fetched_at))
  }

  async findByIds(
    containerId: string,
    snapshotIds: readonly string[],
  ): Promise<readonly Snapshot[]> {
    const requestedIds = new Set(snapshotIds)
    return [...this.snapshots.values()].filter(
      (snapshot) => snapshot.container_id === containerId && requestedIds.has(snapshot.id),
    )
  }
}

class InMemoryObservationRepository implements ObservationRepository {
  private observations = new Map<string, Observation>()

  async insertMany(observations: readonly NewObservation[]): Promise<readonly Observation[]> {
    const createdAt = instantFromIsoText('2026-02-03T12:00:00.000Z')
    return observations.map((observation, index) => {
      const created: Observation = {
        ...observation,
        id: randomUUID(),
        created_at: Instant.fromEpochMs(createdAt.toEpochMs() + index).toIsoString(),
      }
      this.observations.set(created.id, created)
      return created
    })
  }

  async findAllByContainerId(containerId: string): Promise<readonly Observation[]> {
    return [...this.observations.values()]
      .filter((observation) => observation.container_id === containerId)
      .sort((left, right) => left.created_at.localeCompare(right.created_at))
  }

  async findFingerprintsByContainerId(containerId: string): Promise<ReadonlySet<string>> {
    return new Set(
      [...this.observations.values()]
        .filter((observation) => observation.container_id === containerId)
        .map((observation) => observation.fingerprint),
    )
  }

  async listSearchObservations() {
    return []
  }
}

class InMemoryTrackingAlertRepository implements TrackingAlertRepository {
  private alerts = new Map<string, TrackingAlert>()
  async findAlertDerivationStateByContainerId(
    containerId: string,
  ): Promise<readonly TrackingAlertDerivationState[]> {
    return [...this.alerts.values().filter((alert) => alert.container_id === containerId)].map(
      (alert) => ({
        id: alert.id,
        type: alert.type,
        category: alert.category,
        source_observation_fingerprints: alert.source_observation_fingerprints,
        alert_fingerprint: alert.alert_fingerprint,
        active: resolveAlertLifecycleState(alert) === 'ACTIVE',
        acked_at: alert.acked_at,
        message_params: alert.message_params,
      }),
    )
  }
  async insertMany(alerts: readonly NewTrackingAlert[]): Promise<readonly TrackingAlert[]> {
    return alerts.map((alert) => {
      const created: TrackingAlert = {
        ...alert,
        id: randomUUID(),
      }
      this.alerts.set(created.id, created)
      return created
    })
  }

  async findActiveByContainerId(containerId: string): Promise<readonly TrackingAlert[]> {
    return [...this.alerts.values()].filter(
      (alert) =>
        alert.container_id === containerId && resolveAlertLifecycleState(alert) === 'ACTIVE',
    )
  }

  async findByContainerId(containerId: string): Promise<readonly TrackingAlert[]> {
    return [...this.alerts.values()].filter((alert) => alert.container_id === containerId)
  }

  async findContainerNumbersByIds(
    containerIds: readonly string[],
  ): Promise<ReadonlyMap<string, string>> {
    const result = new Map<string, string>()
    for (const containerId of containerIds) {
      const firstAlert = [...this.alerts.values()].find(
        (alert) => alert.container_id === containerId,
      )
      if (firstAlert) {
        result.set(containerId, 'MNBU3094033')
      }
    }
    return result
  }

  async findActiveTypesByContainerId(containerId: string): Promise<ReadonlySet<string>> {
    return new Set(
      [...this.alerts.values()]
        .filter(
          (alert) =>
            alert.container_id === containerId && resolveAlertLifecycleState(alert) === 'ACTIVE',
        )
        .map((alert) => alert.type),
    )
  }

  async listActiveAlertReadModel(): Promise<readonly TrackingActiveAlertReadModel[]> {
    return []
  }

  async acknowledge(
    _alertId: string,
    _ackedAt: string,
    _metadata: {
      readonly ackedBy: string | null
      readonly ackedSource: TrackingAlertAckSource | null
    },
  ): Promise<void> {}

  async unacknowledge(_alertId: string): Promise<void> {}

  async autoResolveMany(command: {
    readonly alertIds: readonly string[]
    readonly resolvedAt: string
    readonly reason: 'condition_cleared' | 'terminal_state'
  }): Promise<void> {
    for (const alertId of command.alertIds) {
      const existing = this.alerts.get(alertId)
      if (!existing) continue
      this.alerts.set(alertId, {
        ...existing,
        lifecycle_state: 'AUTO_RESOLVED',
        resolved_at: command.resolvedAt,
        resolved_reason: command.reason,
      })
    }
  }
}

function createDeps(): TrackingUseCasesDeps {
  return {
    snapshotRepository: new InMemorySnapshotRepository(),
    observationRepository: new InMemoryObservationRepository(),
    trackingAlertRepository: new InMemoryTrackingAlertRepository(),
    syncMetadataRepository: {
      async listByContainerNumbers() {
        return []
      },
    },
  }
}

function normalizeTimelineForParity(
  timeline: readonly TrackingTimelineItem[],
): readonly Record<string, unknown>[] {
  return timeline.map((item) => ({
    type: item.type,
    carrierLabel: item.carrierLabel ?? null,
    location: item.location ?? null,
    eventTime: item.eventTime,
    eventTimeType: item.eventTimeType,
    derivedState: item.derivedState,
    vesselName: item.vesselName ?? null,
    voyage: item.voyage ?? null,
    seriesHistory: item.seriesHistory
      ? {
          hasActualConflict: item.seriesHistory.hasActualConflict,
          classified: item.seriesHistory.classified.map((seriesItem) => ({
            type: seriesItem.type,
            event_time: seriesItem.event_time,
            event_time_type: seriesItem.event_time_type,
            created_at: seriesItem.created_at,
            seriesLabel: seriesItem.seriesLabel,
          })),
        }
      : null,
  }))
}

describe('getTrackingTimeTravel', () => {
  it('builds chronological checkpoints and keeps exact latest parity for the same referenceNow', async () => {
    const containerId = randomUUID()
    const deps = createDeps()
    const trackingUseCases = createTrackingUseCases(deps)
    const referenceNow = instantFromIsoText('2026-02-03T18:30:00.000Z')

    const laterSnapshot = await trackingUseCases.saveAndProcess(
      containerId,
      'MNBU3094033',
      'maersk',
      maerskPayload,
      null,
      '2026-02-03T16:00:00.000Z',
    )
    const earlierSnapshot = await trackingUseCases.saveAndProcess(
      containerId,
      'MNBU3094033',
      'maersk',
      maerskPayload,
      null,
      '2026-02-03T15:00:00.000Z',
    )

    const timeTravel = await trackingUseCases.getTrackingTimeTravel({
      containerId,
      now: referenceNow,
    })
    const latestLiveSummary = await trackingUseCases.getContainerSummary(
      containerId,
      'MNBU3094033',
      null,
      referenceNow,
    )

    expect(timeTravel.syncCount).toBe(2)
    expect(timeTravel.selectedSnapshotId).toBe(laterSnapshot.snapshot.id)
    expect(timeTravel.referenceNow).toBe(referenceNow.toIsoString())
    expect(timeTravel.syncs[0]?.snapshotId).toBe(earlierSnapshot.snapshot.id)
    expect(timeTravel.syncs[0]?.diffFromPrevious.kind).toBe('initial')
    expect(timeTravel.syncs[1]?.diffFromPrevious.kind).toBe('comparison')

    const latestSync = timeTravel.syncs[1]
    expect(latestSync?.status).toBe(latestLiveSummary.status)
    expect(normalizeTimelineForParity(latestSync?.timeline ?? [])).toEqual(
      normalizeTimelineForParity(
        deriveTimelineWithSeriesReadModel(
          toTrackingObservationProjections(latestLiveSummary.observations),
          referenceNow,
        ),
      ),
    )
    const expectedAlerts = deriveAlerts(
      latestLiveSummary.timeline,
      latestLiveSummary.status,
      [],
      false,
      referenceNow,
    )
    expect(latestSync?.alerts.map((alert) => alert.alert_fingerprint ?? alert.type).sort()).toEqual(
      expectedAlerts.map((alert) => alert.alert_fingerprint ?? alert.type).sort(),
    )
  })

  it('returns snapshot-scoped debug steps while preserving cumulative checkpoint state', async () => {
    const containerId = randomUUID()
    const deps = createDeps()
    const trackingUseCases = createTrackingUseCases(deps)

    await trackingUseCases.saveAndProcess(
      containerId,
      'MNBU3094033',
      'maersk',
      maerskPayload,
      null,
      '2026-02-03T15:00:00.000Z',
    )
    const laterSnapshot = await trackingUseCases.saveAndProcess(
      containerId,
      'MNBU3094033',
      'maersk',
      maerskPayload,
      null,
      '2026-02-03T16:00:00.000Z',
    )

    const debug = await trackingUseCases.getTrackingReplayDebug({
      containerId,
      snapshotId: laterSnapshot.snapshot.id,
      now: instantFromIsoText('2026-02-03T18:30:00.000Z'),
    })

    expect(debug.snapshotId).toBe(laterSnapshot.snapshot.id)
    expect(debug.totalSteps).toBeGreaterThan(0)
    expect(debug.steps.every((step) => step.snapshotId === laterSnapshot.snapshot.id)).toBe(true)
    expect(debug.checkpoint.snapshotId).toBe(laterSnapshot.snapshot.id)
    expect(debug.totalObservations).toBeGreaterThan(0)
  })
})
