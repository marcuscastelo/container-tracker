import { randomUUID } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import { processSnapshot } from '~/modules/tracking/application/orchestration/pipeline'
import type { TrackingAlertRepository } from '~/modules/tracking/application/ports/tracking.alert.repository'
import type { ObservationRepository } from '~/modules/tracking/application/ports/tracking.observation.repository'
import type { SnapshotRepository } from '~/modules/tracking/application/ports/tracking.snapshot.repository'
import type { TrackingValidationLifecycleRepository } from '~/modules/tracking/application/ports/tracking.validation-lifecycle.repository'
import { buildScenario } from '~/modules/tracking/dev/scenario-lab/scenario.builder'
import type { ScenarioBuildResult } from '~/modules/tracking/dev/scenario-lab/scenario.types'
import type { NewSnapshot, Snapshot } from '~/modules/tracking/domain/model/snapshot'
import type { TrackingActiveAlertReadModel } from '~/modules/tracking/features/alerts/application/projection/tracking.active-alert.readmodel'
import type {
  NewTrackingAlert,
  TrackingAlert,
  TrackingAlertAckSource,
  TrackingAlertDerivationState,
} from '~/modules/tracking/features/alerts/domain/model/trackingAlert'
import { resolveAlertLifecycleState } from '~/modules/tracking/features/alerts/domain/model/trackingAlert'
import type {
  NewObservation,
  Observation,
} from '~/modules/tracking/features/observation/domain/model/observation'
import { compareObservationsChronologically } from '~/modules/tracking/features/timeline/domain/derive/deriveTimeline'
import type {
  TrackingValidationLifecycleState,
  TrackingValidationLifecycleTransition,
} from '~/modules/tracking/features/validation/domain/model/trackingValidationLifecycle'
import { toTrackingValidationLifecycleState } from '~/modules/tracking/features/validation/domain/model/trackingValidationLifecycle'
import { InfrastructureError } from '~/shared/errors/httpErrors'
import { Instant } from '~/shared/time/instant'

class InMemorySnapshotRepository implements SnapshotRepository {
  async insert(snapshot: NewSnapshot): Promise<Snapshot> {
    return {
      ...snapshot,
      id: randomUUID(),
    }
  }

  async findLatestByContainerId(): Promise<Snapshot | null> {
    return null
  }

  async findAllByContainerId(): Promise<readonly Snapshot[]> {
    return []
  }
}

class InMemoryObservationRepository implements ObservationRepository {
  private observations = new Map<string, Observation>()

  async insertMany(newObservations: readonly NewObservation[]): Promise<readonly Observation[]> {
    const baseCreatedAt = Instant.fromIso('2026-04-03T10:00:00.000Z').toEpochMs()
    return newObservations.map((observation, index) => {
      const persistedObservation: Observation = {
        ...observation,
        id: randomUUID(),
        created_at: Instant.fromEpochMs(baseCreatedAt + index).toIsoString(),
      }
      this.observations.set(persistedObservation.id, persistedObservation)
      return persistedObservation
    })
  }

  async findAllByContainerId(containerId: string): Promise<readonly Observation[]> {
    return [...this.observations.values()]
      .filter((observation) => observation.container_id === containerId)
      .sort(compareObservationsChronologically)
  }

  async findAllByContainerIds(containerIds: readonly string[]): Promise<readonly Observation[]> {
    const requestedIds = new Set(containerIds)
    return [...this.observations.values()]
      .filter((observation) => requestedIds.has(observation.container_id))
      .sort(compareObservationsChronologically)
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

  async insertMany(newAlerts: readonly NewTrackingAlert[]): Promise<readonly TrackingAlert[]> {
    return newAlerts.map((alert) => {
      const persistedAlert: TrackingAlert = {
        ...alert,
        id: randomUUID(),
      }
      this.alerts.set(persistedAlert.id, persistedAlert)
      return persistedAlert
    })
  }

  async findActiveByContainerId(containerId: string): Promise<readonly TrackingAlert[]> {
    return [...this.alerts.values()].filter(
      (alert) =>
        alert.container_id === containerId && resolveAlertLifecycleState(alert) === 'ACTIVE',
    )
  }

  async findActiveByContainerIds(
    containerIds: readonly string[],
  ): Promise<readonly TrackingAlert[]> {
    const requestedIds = new Set(containerIds)
    return [...this.alerts.values()].filter(
      (alert) =>
        requestedIds.has(alert.container_id) && resolveAlertLifecycleState(alert) === 'ACTIVE',
    )
  }

  async findByContainerId(containerId: string): Promise<readonly TrackingAlert[]> {
    return [...this.alerts.values()].filter((alert) => alert.container_id === containerId)
  }

  async findAlertDerivationStateByContainerId(
    containerId: string,
  ): Promise<readonly TrackingAlertDerivationState[]> {
    return [...this.alerts.values()].filter((alert) => alert.container_id === containerId)
  }

  async findContainerNumbersByIds(): Promise<ReadonlyMap<string, string>> {
    return new Map()
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
    alertId: string,
    ackedAt: string,
    metadata: {
      readonly ackedBy: string | null
      readonly ackedSource: TrackingAlertAckSource | null
    },
  ): Promise<void> {
    const alert = this.alerts.get(alertId)
    if (!alert) return
    this.alerts.set(alertId, {
      ...alert,
      lifecycle_state: 'ACKED',
      acked_at: ackedAt,
      acked_by: metadata.ackedBy,
      acked_source: metadata.ackedSource,
    })
  }

  async unacknowledge(alertId: string): Promise<void> {
    const alert = this.alerts.get(alertId)
    if (!alert) return
    this.alerts.set(alertId, {
      ...alert,
      lifecycle_state: 'ACTIVE',
      acked_at: null,
      acked_by: null,
      acked_source: null,
      resolved_at: null,
      resolved_reason: null,
    })
  }

  async autoResolveMany(): Promise<void> {
    return
  }
}

class InMemoryTrackingValidationLifecycleRepository
  implements TrackingValidationLifecycleRepository
{
  private activeStatesByContainerId = new Map<
    string,
    Map<string, TrackingValidationLifecycleState>
  >()
  readonly transitions: TrackingValidationLifecycleTransition[] = []

  async findActiveStatesByContainerId(
    containerId: string,
  ): Promise<readonly TrackingValidationLifecycleState[]> {
    const states = this.activeStatesByContainerId.get(containerId)
    if (!states) return []
    return [...states.values()].sort((left, right) =>
      left.lifecycleKey.localeCompare(right.lifecycleKey),
    )
  }

  async insertMany(transitions: readonly TrackingValidationLifecycleTransition[]): Promise<void> {
    for (const transition of transitions) {
      this.transitions.push(transition)
      const containerStates =
        this.activeStatesByContainerId.get(transition.containerId) ?? new Map()
      const nextState = toTrackingValidationLifecycleState(transition)
      if (nextState === null) {
        containerStates.delete(transition.lifecycleKey)
      } else {
        containerStates.set(transition.lifecycleKey, nextState)
      }
      this.activeStatesByContainerId.set(transition.containerId, containerStates)
    }
  }
}

class UnavailableTrackingValidationLifecycleRepository
  implements TrackingValidationLifecycleRepository
{
  async findActiveStatesByContainerId(): Promise<readonly TrackingValidationLifecycleState[]> {
    throw new InfrastructureError(
      'Database error on tracking_validation_issue_transitions during findActiveStatesByContainerId',
    )
  }

  async insertMany(): Promise<void> {
    throw new InfrastructureError(
      'Database error on tracking_validation_issue_transitions during insertMany',
    )
  }
}

function createSnapshot(params: {
  containerId: string
  provider: Snapshot['provider']
  fetchedAt: string
  payload: unknown
}): Snapshot {
  return {
    id: randomUUID(),
    container_id: params.containerId,
    provider: params.provider,
    fetched_at: params.fetchedAt,
    payload: params.payload,
    parse_error: null,
  }
}

async function processScenarioBuild(params: {
  buildResult: ScenarioBuildResult
  containerId: string
  lifecycleRepository: InMemoryTrackingValidationLifecycleRepository
  observationRepository: InMemoryObservationRepository
  alertRepository: InMemoryTrackingAlertRepository
  snapshotRepository: InMemorySnapshotRepository
}): Promise<void> {
  const [container] = params.buildResult.scenario.containers
  if (container === undefined) {
    throw new Error('Scenario build must contain at least one container')
  }

  const containerNumber = params.buildResult.containerNumbersByKey.get(container.key)
  if (!containerNumber) {
    throw new Error(`Missing container number for key ${container.key}`)
  }

  for (const scenarioSnapshot of params.buildResult.snapshots) {
    await processSnapshot(
      createSnapshot({
        containerId: params.containerId,
        provider: scenarioSnapshot.provider,
        fetchedAt: scenarioSnapshot.fetchedAt,
        payload: scenarioSnapshot.payload,
      }),
      params.containerId,
      containerNumber,
      {
        snapshotRepository: params.snapshotRepository,
        observationRepository: params.observationRepository,
        trackingAlertRepository: params.alertRepository,
        trackingValidationLifecycleRepository: params.lifecycleRepository,
      },
      false,
    )
  }
}

describe('processSnapshot validation lifecycle integration', () => {
  it('persists activated, changed and resolved transitions for advisory issues without full state snapshots', async () => {
    const runToken = 'phase6ad'
    const containerId = randomUUID()
    const snapshotRepository = new InMemorySnapshotRepository()
    const observationRepository = new InMemoryObservationRepository()
    const alertRepository = new InMemoryTrackingAlertRepository()
    const lifecycleRepository = new InMemoryTrackingValidationLifecycleRepository()

    const step1 = buildScenario({
      command: { scenarioId: 'post_carriage_maritime_inconsistent', step: 1 },
      runToken,
    })
    await processScenarioBuild({
      buildResult: step1,
      containerId,
      lifecycleRepository,
      observationRepository,
      alertRepository,
      snapshotRepository,
    })

    const step2 = buildScenario({
      command: { scenarioId: 'post_carriage_maritime_inconsistent', step: 2 },
      runToken,
      containerNumbersByKey: step1.containerNumbersByKey,
    })
    await processScenarioBuild({
      buildResult: step2,
      containerId,
      lifecycleRepository,
      observationRepository,
      alertRepository,
      snapshotRepository,
    })

    const step3 = buildScenario({
      command: { scenarioId: 'post_carriage_maritime_inconsistent', step: 3 },
      runToken,
      containerNumbersByKey: step1.containerNumbersByKey,
    })
    await processScenarioBuild({
      buildResult: step3,
      containerId,
      lifecycleRepository,
      observationRepository,
      alertRepository,
      snapshotRepository,
    })

    const step4 = buildScenario({
      command: { scenarioId: 'post_carriage_maritime_inconsistent', step: 4 },
      runToken,
      containerNumbersByKey: step1.containerNumbersByKey,
    })
    await processScenarioBuild({
      buildResult: step4,
      containerId,
      lifecycleRepository,
      observationRepository,
      alertRepository,
      snapshotRepository,
    })

    const activeStates = await lifecycleRepository.findActiveStatesByContainerId(containerId)

    expect(activeStates).toEqual([])
    expect(lifecycleRepository.transitions.map((transition) => transition.transitionType)).toEqual([
      'activated',
      'changed',
      'resolved',
    ])
    expect(lifecycleRepository.transitions.map((transition) => transition.issueCode)).toEqual([
      'CANONICAL_TIMELINE_CLASSIFICATION_INCONSISTENT',
      'CANONICAL_TIMELINE_CLASSIFICATION_INCONSISTENT',
      'CANONICAL_TIMELINE_CLASSIFICATION_INCONSISTENT',
    ])
    expect(lifecycleRepository.transitions.map((transition) => transition.severity)).toEqual([
      'ADVISORY',
      'ADVISORY',
      'ADVISORY',
    ])
  })

  it('does not duplicate activated transitions when the same critical condition is reprocessed unchanged', async () => {
    const runToken = 'phase6critical'
    const containerId = randomUUID()
    const snapshotRepository = new InMemorySnapshotRepository()
    const observationRepository = new InMemoryObservationRepository()
    const alertRepository = new InMemoryTrackingAlertRepository()
    const lifecycleRepository = new InMemoryTrackingValidationLifecycleRepository()

    const step1 = buildScenario({
      command: { scenarioId: 'discharge_multiple_actual', step: 1 },
      runToken,
    })

    await processScenarioBuild({
      buildResult: step1,
      containerId,
      lifecycleRepository,
      observationRepository,
      alertRepository,
      snapshotRepository,
    })
    await processScenarioBuild({
      buildResult: step1,
      containerId,
      lifecycleRepository,
      observationRepository,
      alertRepository,
      snapshotRepository,
    })

    expect(lifecycleRepository.transitions).toHaveLength(1)
    expect(lifecycleRepository.transitions[0]).toMatchObject({
      transitionType: 'activated',
      issueCode: 'CONFLICTING_CRITICAL_ACTUALS',
      severity: 'CRITICAL',
    })
  })

  it('keeps canonical validation derivation when lifecycle persistence is unavailable', async () => {
    const runToken = 'phase7resilience'
    const containerId = randomUUID()
    const snapshotRepository = new InMemorySnapshotRepository()
    const observationRepository = new InMemoryObservationRepository()
    const alertRepository = new InMemoryTrackingAlertRepository()
    const lifecycleRepository = new UnavailableTrackingValidationLifecycleRepository()
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    const step2 = buildScenario({
      command: { scenarioId: 'post_carriage_maritime_inconsistent', step: 2 },
      runToken,
    })

    const [container] = step2.scenario.containers
    if (container === undefined) {
      throw new Error('Scenario build must contain at least one container')
    }

    const containerNumber = step2.containerNumbersByKey.get(container.key)
    if (!containerNumber) {
      throw new Error(`Missing container number for key ${container.key}`)
    }

    try {
      let lastResult: Awaited<ReturnType<typeof processSnapshot>> | null = null

      for (const scenarioSnapshot of step2.snapshots) {
        lastResult = await processSnapshot(
          createSnapshot({
            containerId,
            provider: scenarioSnapshot.provider,
            fetchedAt: scenarioSnapshot.fetchedAt,
            payload: scenarioSnapshot.payload,
          }),
          containerId,
          containerNumber,
          {
            snapshotRepository,
            observationRepository,
            trackingAlertRepository: alertRepository,
            trackingValidationLifecycleRepository: lifecycleRepository,
          },
          false,
        )
      }

      expect(lastResult).not.toBeNull()
      expect(lastResult?.trackingValidation).toEqual({
        hasIssues: true,
        highestSeverity: 'ADVISORY',
        findingCount: 1,
        activeIssues: [
          {
            code: 'CANONICAL_TIMELINE_CLASSIFICATION_INCONSISTENT',
            severity: 'ADVISORY',
            reasonKey: 'tracking.validation.canonicalTimelineClassificationInconsistent',
            affectedArea: 'timeline',
            affectedLocation: expect.any(String),
            affectedBlockLabelKey: 'shipmentView.timeline.blocks.postCarriage',
          },
        ],
        topIssue: {
          code: 'CANONICAL_TIMELINE_CLASSIFICATION_INCONSISTENT',
          severity: 'ADVISORY',
          reasonKey: 'tracking.validation.canonicalTimelineClassificationInconsistent',
          affectedArea: 'timeline',
          affectedLocation: expect.any(String),
          affectedBlockLabelKey: 'shipmentView.timeline.blocks.postCarriage',
        },
      })
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'tracking.processSnapshot.validation_lifecycle_unavailable',
        expect.objectContaining({
          containerId,
          containerNumber,
          operation: 'findActiveStatesByContainerId',
        }),
      )
    } finally {
      consoleErrorSpy.mockRestore()
    }
  })
})
