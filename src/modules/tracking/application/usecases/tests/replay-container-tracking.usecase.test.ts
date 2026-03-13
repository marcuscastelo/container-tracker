import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'

import { createTrackingUseCases } from '~/modules/tracking/application/tracking.usecases'
import type { TrackingAlertRepository } from '~/modules/tracking/application/ports/tracking.alert.repository'
import type { ObservationRepository } from '~/modules/tracking/application/ports/tracking.observation.repository'
import type { SnapshotRepository } from '~/modules/tracking/application/ports/tracking.snapshot.repository'
import type { TrackingUseCasesDeps } from '~/modules/tracking/application/usecases/types'
import type { NewSnapshot, Snapshot } from '~/modules/tracking/domain/model/snapshot'
import type { TrackingActiveAlertReadModel } from '~/modules/tracking/features/alerts/application/projection/tracking.active-alert.readmodel'
import type {
  NewTrackingAlert,
  TrackingAlert,
  TrackingAlertAckSource,
} from '~/modules/tracking/features/alerts/domain/model/trackingAlert'
import { resolveAlertLifecycleState } from '~/modules/tracking/features/alerts/domain/model/trackingAlert'
import type {
  NewObservation,
  Observation,
} from '~/modules/tracking/features/observation/domain/model/observation'
import maerskPayload from '~/modules/tracking/infrastructure/carriers/tests/fixtures/maersk/maersk_full.json'

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

  async findByIds(containerId: string, snapshotIds: readonly string[]): Promise<readonly Snapshot[]> {
    const requestedIds = new Set(snapshotIds)
    return [...this.snapshots.values()].filter(
      (snapshot) => snapshot.container_id === containerId && requestedIds.has(snapshot.id),
    )
  }
}

class InMemoryObservationRepository implements ObservationRepository {
  private observations = new Map<string, Observation>()

  async insertMany(observations: readonly NewObservation[]): Promise<readonly Observation[]> {
    const createdAt = new Date('2026-02-03T12:00:00.000Z')
    return observations.map((observation, index) => {
      const created: Observation = {
        ...observation,
        id: randomUUID(),
        created_at: new Date(createdAt.getTime() + index).toISOString(),
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
      (alert) => alert.container_id === containerId && resolveAlertLifecycleState(alert) === 'ACTIVE',
    )
  }

  async findByContainerId(containerId: string): Promise<readonly TrackingAlert[]> {
    return [...this.alerts.values()].filter((alert) => alert.container_id === containerId)
  }

  async findContainerNumbersByIds(containerIds: readonly string[]): Promise<ReadonlyMap<string, string>> {
    const result = new Map<string, string>()
    for (const containerId of containerIds) {
      const firstAlert = [...this.alerts.values()].find((alert) => alert.container_id === containerId)
      if (firstAlert) {
        result.set(containerId, 'MNBU3094033')
      }
    }
    return result
  }

  async findActiveTypesByContainerId(containerId: string): Promise<ReadonlySet<string>> {
    return new Set(
      [...this.alerts.values()]
        .filter((alert) => alert.container_id === containerId && resolveAlertLifecycleState(alert) === 'ACTIVE')
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

describe('replayContainerTracking', () => {
  it('replays snapshots chronologically and flags duplicate observations from later snapshots', async () => {
    const containerId = randomUUID()
    const deps = createDeps()
    const trackingUseCases = createTrackingUseCases(deps)
    const referenceNow = new Date()

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

    const replay = await trackingUseCases.replayContainerTracking(
      containerId,
      referenceNow,
    )

    expect(replay.totalSnapshots).toBe(2)
    expect(replay.totalObservations).toBeGreaterThan(0)
    expect(replay.steps[0]?.stage).toBe('SNAPSHOT')
    expect(replay.steps[0]?.snapshotId).toBe(earlierSnapshot.snapshot.id)
    expect(replay.steps.some((step) => step.snapshotId === laterSnapshot.snapshot.id)).toBe(true)

    const discardedDuplicateStep = replay.steps.find(
      (step) =>
        step.stage === 'OBSERVATION' &&
        typeof step.output === 'object' &&
        step.output !== null &&
        'kind' in step.output &&
        step.output.kind === 'discarded',
    )

    expect(discardedDuplicateStep).toBeDefined()
    expect(replay.productionComparison.timelineMatches).toBe(true)
    expect(replay.productionComparison.statusMatches).toBe(true)
    expect(replay.productionComparison.alertsMatch).toBe(true)
    expect(replay.finalTimeline.length).toBeGreaterThan(0)
  })

  it('reports matching final state when production snapshots were ingested in chronological order', async () => {
    const containerId = randomUUID()
    const deps = createDeps()
    const trackingUseCases = createTrackingUseCases(deps)
    const referenceNow = new Date()

    await trackingUseCases.saveAndProcess(
      containerId,
      'MNBU3094033',
      'maersk',
      maerskPayload,
      null,
      '2026-02-03T15:00:00.000Z',
    )
    await trackingUseCases.saveAndProcess(
      containerId,
      'MNBU3094033',
      'maersk',
      maerskPayload,
      null,
      '2026-02-03T16:00:00.000Z',
    )

    const replay = await trackingUseCases.replayContainerTracking(containerId, referenceNow)

    expect(replay.productionComparison.timelineMatches).toBe(true)
    expect(replay.productionComparison.statusMatches).toBe(true)
    expect(replay.productionComparison.alertsMatch).toBe(true)
  })
})
