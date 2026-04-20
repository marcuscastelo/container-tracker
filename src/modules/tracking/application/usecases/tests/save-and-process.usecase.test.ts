import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import type { TrackingAlertRepository } from '~/modules/tracking/application/ports/tracking.alert.repository'
import type { TrackingContainmentRepository } from '~/modules/tracking/application/ports/tracking.containment.repository'
import type { ObservationRepository } from '~/modules/tracking/application/ports/tracking.observation.repository'
import type { SnapshotRepository } from '~/modules/tracking/application/ports/tracking.snapshot.repository'
import { saveAndProcess } from '~/modules/tracking/application/usecases/save-and-process.usecase'
import type { TrackingUseCasesDeps } from '~/modules/tracking/application/usecases/types'
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
import {
  type ActivateTrackingContainmentCommand,
  TRACKING_CONTAINMENT_REASON_CODE,
  type TrackingContainmentState,
} from '~/modules/tracking/features/containment/domain/model/trackingContainment'
import type {
  NewObservation,
  Observation,
} from '~/modules/tracking/features/observation/domain/model/observation'
import { compareObservationsChronologically } from '~/modules/tracking/features/timeline/domain/derive/deriveTimeline'
import { Instant } from '~/shared/time/instant'

class InMemorySnapshotRepository implements SnapshotRepository {
  private readonly snapshots = new Map<string, Snapshot>()

  async insert(snapshot: NewSnapshot): Promise<Snapshot> {
    const persistedSnapshot: Snapshot = {
      ...snapshot,
      id: randomUUID(),
    }
    this.snapshots.set(persistedSnapshot.id, persistedSnapshot)
    return persistedSnapshot
  }

  async findLatestByContainerId(containerId: string): Promise<Snapshot | null> {
    return (await this.findAllByContainerId(containerId))[0] ?? null
  }

  async findAllByContainerId(containerId: string): Promise<readonly Snapshot[]> {
    return [...this.snapshots.values()]
      .filter((snapshot) => snapshot.container_id === containerId)
      .sort((left, right) => right.fetched_at.localeCompare(left.fetched_at))
  }
}

class InMemoryObservationRepository implements ObservationRepository {
  private readonly observations = new Map<string, Observation>()

  async insertMany(newObservations: readonly NewObservation[]): Promise<readonly Observation[]> {
    const baseCreatedAt = Instant.fromIso('2026-04-01T10:00:00.000Z').toEpochMs()

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
  private readonly alerts = new Map<string, TrackingAlert>()

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

class InMemoryTrackingContainmentRepository implements TrackingContainmentRepository {
  private readonly activeStatesByContainerId = new Map<string, TrackingContainmentState>()
  readonly activations: ActivateTrackingContainmentCommand[] = []

  async findActiveByContainerId(containerId: string): Promise<TrackingContainmentState | null> {
    return this.activeStatesByContainerId.get(containerId) ?? null
  }

  async findActiveByContainerIds(
    containerIds: readonly string[],
  ): Promise<ReadonlyMap<string, TrackingContainmentState>> {
    const requestedIds = new Set(containerIds)
    return new Map(
      [...this.activeStatesByContainerId.entries()].filter(([containerId]) =>
        requestedIds.has(containerId),
      ),
    )
  }

  async activate(command: ActivateTrackingContainmentCommand): Promise<void> {
    this.activations.push(command)
    if (this.activeStatesByContainerId.has(command.containerId)) {
      return
    }

    this.activeStatesByContainerId.set(command.containerId, {
      active: true,
      reasonCode: TRACKING_CONTAINMENT_REASON_CODE,
      activatedAt: command.activatedAt,
      provider: command.provider,
      snapshotId: command.snapshotId,
      lifecycleKey: `${TRACKING_CONTAINMENT_REASON_CODE}:${command.containerId}`,
      stateFingerprint: command.stateFingerprint,
      evidenceSummary: command.evidenceSummary,
    })
  }
}

function createDeps(): TrackingUseCasesDeps & {
  readonly trackingContainmentRepository: InMemoryTrackingContainmentRepository
} {
  return {
    snapshotRepository: new InMemorySnapshotRepository(),
    observationRepository: new InMemoryObservationRepository(),
    trackingAlertRepository: new InMemoryTrackingAlertRepository(),
    trackingContainmentRepository: new InMemoryTrackingContainmentRepository(),
    syncMetadataRepository: {
      listByContainerNumbers: async () => [],
    },
  }
}

function getSingleContainerNumber(buildResult: ScenarioBuildResult): string {
  const [container] = buildResult.scenario.containers
  if (container === undefined) {
    throw new Error('Scenario build must contain at least one container')
  }

  const containerNumber = buildResult.containerNumbersByKey.get(container.key)
  if (containerNumber === undefined) {
    throw new Error(`Missing container number for key ${container.key}`)
  }

  return containerNumber
}

async function processScenarioStep(command: {
  readonly deps: TrackingUseCasesDeps
  readonly buildResult: ScenarioBuildResult
  readonly containerId: string
  readonly containerNumber: string
}) {
  let lastResult: Awaited<ReturnType<typeof saveAndProcess>> | null = null

  for (const scenarioSnapshot of command.buildResult.snapshots) {
    lastResult = await saveAndProcess(command.deps, {
      containerId: command.containerId,
      containerNumber: command.containerNumber,
      provider: scenarioSnapshot.provider,
      payload: scenarioSnapshot.payload,
      fetchedAt: scenarioSnapshot.fetchedAt,
    })
  }

  if (lastResult === null) {
    throw new Error('Scenario step must contain at least one snapshot')
  }

  return lastResult
}

function createManualAlert(
  containerId: string,
  sourceObservationFingerprint: string,
): NewTrackingAlert {
  return {
    container_id: containerId,
    category: 'monitoring',
    type: 'ETA_PASSED',
    severity: 'warning',
    message_key: 'alerts.etaPassed',
    message_params: {},
    detected_at: '2026-04-02T12:00:00.000Z',
    triggered_at: '2026-04-02T12:00:00.000Z',
    source_observation_fingerprints: [sourceObservationFingerprint],
    alert_fingerprint: null,
    retroactive: false,
    provider: null,
    acked_at: null,
    acked_by: null,
    acked_source: null,
  }
}

describe('saveAndProcess container reuse containment', () => {
  it.each([
    ['delivery_post_completion_continued', 'DELIVERED'],
    ['empty_return_post_completion_continued', 'EMPTY_RETURNED'],
  ] as const)('keeps snapshots auditably persisted while freezing semantic updates for %s', async (scenarioId, expectedStatus) => {
    const deps = createDeps()
    const containerId = randomUUID()
    const runToken = `containment-${scenarioId}`

    const step1 = buildScenario({
      command: { scenarioId, step: 1 },
      runToken,
    })
    const containerNumber = getSingleContainerNumber(step1)
    const step1Result = await processScenarioStep({
      deps,
      buildResult: step1,
      containerId,
      containerNumber,
    })
    const baselineObservations = await deps.observationRepository.findAllByContainerId(containerId)
    const baselineSnapshots = await deps.snapshotRepository.findAllByContainerId(containerId)
    const baselineAlertFingerprint = baselineObservations[0]?.fingerprint

    if (baselineAlertFingerprint === undefined) {
      throw new Error('Expected at least one observation after strong-completion step')
    }

    await deps.trackingAlertRepository.insertMany([
      createManualAlert(containerId, baselineAlertFingerprint),
    ])

    const step2 = buildScenario({
      command: { scenarioId, step: 2 },
      runToken,
      containerNumbersByKey: step1.containerNumbersByKey,
    })
    const activatingResult = await processScenarioStep({
      deps,
      buildResult: step2,
      containerId,
      containerNumber,
    })
    const latestScenarioSnapshot = step2.snapshots[step2.snapshots.length - 1]?.fetchedAt ?? null
    if (latestScenarioSnapshot === null) {
      throw new Error('Scenario step 2 must contain at least one snapshot')
    }

    const blockedReplayResult = await saveAndProcess(deps, {
      containerId,
      containerNumber,
      provider: step2.snapshots[step2.snapshots.length - 1]?.provider ?? 'maersk',
      payload: step2.snapshots[step2.snapshots.length - 1]?.payload ?? {},
      fetchedAt: '2026-05-01T12:00:00.000Z',
    })

    const snapshotsAfterContainment =
      await deps.snapshotRepository.findAllByContainerId(containerId)
    const observationsAfterContainment =
      await deps.observationRepository.findAllByContainerId(containerId)
    const alertsAfterContainment = await deps.trackingAlertRepository.findByContainerId(containerId)

    expect(step1Result.pipeline.status).toBe(expectedStatus)
    expect(activatingResult.pipeline.newObservations).toEqual([])
    expect(blockedReplayResult.pipeline.newObservations).toEqual([])
    expect(activatingResult.pipeline.newAlerts).toEqual([])
    expect(blockedReplayResult.pipeline.newAlerts).toEqual([])
    expect(activatingResult.pipeline.timeline).toMatchObject({
      container_id: step1Result.pipeline.timeline.container_id,
      container_number: step1Result.pipeline.timeline.container_number,
      observations: step1Result.pipeline.timeline.observations,
      holes: step1Result.pipeline.timeline.holes,
    })
    expect(blockedReplayResult.pipeline.timeline).toMatchObject({
      container_id: step1Result.pipeline.timeline.container_id,
      container_number: step1Result.pipeline.timeline.container_number,
      observations: step1Result.pipeline.timeline.observations,
      holes: step1Result.pipeline.timeline.holes,
    })
    expect(activatingResult.pipeline.status).toBe(step1Result.pipeline.status)
    expect(blockedReplayResult.pipeline.status).toBe(step1Result.pipeline.status)
    expect(activatingResult.pipeline.trackingValidation).toEqual({
      hasIssues: false,
      highestSeverity: null,
      findingCount: 0,
      activeIssues: [],
      topIssue: null,
    })
    expect(blockedReplayResult.pipeline.trackingValidation).toEqual({
      hasIssues: false,
      highestSeverity: null,
      findingCount: 0,
      activeIssues: [],
      topIssue: null,
    })
    expect(snapshotsAfterContainment).toHaveLength(
      baselineSnapshots.length + step2.snapshots.length + 1,
    )
    expect(observationsAfterContainment).toHaveLength(baselineObservations.length)
    expect(alertsAfterContainment).toHaveLength(1)
    expect(deps.trackingContainmentRepository.activations).toHaveLength(1)
    expect(deps.trackingContainmentRepository.activations[0]).toMatchObject({
      containerId,
      activatedAt: latestScenarioSnapshot,
    })
    await expect(
      deps.trackingContainmentRepository.findActiveByContainerId(containerId),
    ).resolves.toMatchObject({
      active: true,
      reasonCode: 'CONTAINER_REUSED_AFTER_COMPLETION',
      activatedAt: latestScenarioSnapshot,
    })
  })
})
