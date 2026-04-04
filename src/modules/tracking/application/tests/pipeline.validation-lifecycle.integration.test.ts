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
import { PIL_MISSING_TABLE_PAYLOAD } from '~/modules/tracking/infrastructure/carriers/tests/helpers/pil.fixture'
import { InfrastructureError } from '~/shared/errors/httpErrors'
import { Instant } from '~/shared/time/instant'
import { temporalValueFromCanonical } from '~/shared/time/tests/helpers'

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

function createNewObservation(params: {
  readonly fingerprint: string
  readonly containerId: string
  readonly containerNumber: string
  readonly type: Observation['type']
  readonly eventTime: Parameters<typeof temporalValueFromCanonical>[0]
  readonly eventTimeType: Observation['event_time_type']
  readonly locationCode: string | null
  readonly locationDisplay: string | null
  readonly vesselName: string | null
  readonly voyage: string | null
  readonly snapshotId: string
}): NewObservation {
  return {
    fingerprint: params.fingerprint,
    container_id: params.containerId,
    container_number: params.containerNumber,
    type: params.type,
    event_time: temporalValueFromCanonical(params.eventTime),
    event_time_type: params.eventTimeType,
    location_code: params.locationCode,
    location_display: params.locationDisplay,
    vessel_name: params.vesselName,
    voyage: params.voyage,
    is_empty: false,
    confidence: 'high',
    provider: 'pil',
    created_from_snapshot_id: params.snapshotId,
    carrier_label: params.type,
    raw_event_time: params.eventTime,
    event_time_source: 'carrier_local_port_time',
    retroactive: false,
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

  it('persists lifecycle activation for duplicated canonical voyage segments without leaking debug evidence', async () => {
    const containerId = randomUUID()
    const containerNumber = 'PCIU8712104'
    const snapshotRepository = new InMemorySnapshotRepository()
    const observationRepository = new InMemoryObservationRepository()
    const alertRepository = new InMemoryTrackingAlertRepository()
    const lifecycleRepository = new InMemoryTrackingValidationLifecycleRepository()
    const seedSnapshotId = randomUUID()

    await observationRepository.insertMany([
      createNewObservation({
        fingerprint: 'fp-load-legacy',
        containerId,
        containerNumber,
        type: 'LOAD',
        eventTime: '2026-03-14T04:10:00.000Z',
        eventTimeType: 'ACTUAL',
        locationCode: null,
        locationDisplay: 'QINGDAO',
        vesselName: 'CMA CGM KRYPTON',
        voyage: 'VCGK0001W',
        snapshotId: seedSnapshotId,
      }),
      createNewObservation({
        fingerprint: 'fp-discharge-legacy',
        containerId,
        containerNumber,
        type: 'DISCHARGE',
        eventTime: '2026-03-20T10:00:00.000Z',
        eventTimeType: 'EXPECTED',
        locationCode: null,
        locationDisplay: 'SANTOS',
        vesselName: 'CMA CGM KRYPTON',
        voyage: 'VCGK0001W',
        snapshotId: seedSnapshotId,
      }),
      createNewObservation({
        fingerprint: 'fp-load-coded',
        containerId,
        containerNumber,
        type: 'LOAD',
        eventTime: '2026-03-21T04:10:00.000Z',
        eventTimeType: 'ACTUAL',
        locationCode: 'CNTAO',
        locationDisplay: 'QINGDAO',
        vesselName: 'CMA CGM KRYPTON',
        voyage: 'VCGK0001W',
        snapshotId: seedSnapshotId,
      }),
      createNewObservation({
        fingerprint: 'fp-discharge-coded',
        containerId,
        containerNumber,
        type: 'DISCHARGE',
        eventTime: '2026-04-23T19:00:00.000Z',
        eventTimeType: 'EXPECTED',
        locationCode: 'BRSSZ',
        locationDisplay: 'SANTOS',
        vesselName: 'CMA CGM KRYPTON',
        voyage: 'VCGK0001W',
        snapshotId: seedSnapshotId,
      }),
    ])

    const result = await processSnapshot(
      createSnapshot({
        containerId,
        provider: 'pil',
        fetchedAt: '2026-04-24T10:00:00.000Z',
        payload: PIL_MISSING_TABLE_PAYLOAD,
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

    expect(result.trackingValidation).toEqual({
      hasIssues: true,
      highestSeverity: 'CRITICAL',
      findingCount: 1,
      activeIssues: [
        {
          code: 'CANONICAL_TIMELINE_SEGMENT_DUPLICATED',
          severity: 'CRITICAL',
          reasonKey: 'tracking.validation.canonicalTimelineSegmentDuplicated',
          affectedArea: 'timeline',
          affectedLocation: 'QINGDAO',
          affectedBlockLabelKey: 'shipmentView.timeline.blocks.voyage',
        },
      ],
      topIssue: {
        code: 'CANONICAL_TIMELINE_SEGMENT_DUPLICATED',
        severity: 'CRITICAL',
        reasonKey: 'tracking.validation.canonicalTimelineSegmentDuplicated',
        affectedArea: 'timeline',
        affectedLocation: 'QINGDAO',
        affectedBlockLabelKey: 'shipmentView.timeline.blocks.voyage',
      },
    })
    expect(lifecycleRepository.transitions).toHaveLength(1)
    expect(lifecycleRepository.transitions[0]).toMatchObject({
      transitionType: 'activated',
      issueCode: 'CANONICAL_TIMELINE_SEGMENT_DUPLICATED',
      severity: 'CRITICAL',
      affectedScope: 'TIMELINE',
      evidenceSummary: expect.stringContaining('CMA CGM KRYPTON / VCGK0001W'),
    })
    expect(lifecycleRepository.transitions[0]).not.toHaveProperty('debugEvidence')
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
