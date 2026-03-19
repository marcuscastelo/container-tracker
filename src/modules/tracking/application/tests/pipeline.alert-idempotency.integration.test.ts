import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { processSnapshot } from '~/modules/tracking/application/orchestration/pipeline'
import type { TrackingAlertRepository } from '~/modules/tracking/application/ports/tracking.alert.repository'
import type { ObservationRepository } from '~/modules/tracking/application/ports/tracking.observation.repository'
import type { SnapshotRepository } from '~/modules/tracking/application/ports/tracking.snapshot.repository'
import type { NewSnapshot, Snapshot } from '~/modules/tracking/domain/model/snapshot'
import type { TrackingActiveAlertReadModel } from '~/modules/tracking/features/alerts/application/projection/tracking.active-alert.readmodel'
import { computeAlertFingerprint } from '~/modules/tracking/features/alerts/domain/identity/alertFingerprint'
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
import { Instant } from '~/shared/time/instant'
import { resolveTemporalValue, temporalValueFromCanonical } from '~/shared/time/tests/helpers'

class InMemorySnapshotRepository implements SnapshotRepository {
  private readonly snapshots: Snapshot[] = []

  async insert(snapshot: NewSnapshot): Promise<Snapshot> {
    const created: Snapshot = {
      ...snapshot,
      id: randomUUID(),
    }
    this.snapshots.push(created)
    return created
  }

  async findLatestByContainerId(containerId: string): Promise<Snapshot | null> {
    const latest =
      [...this.snapshots]
        .filter((snapshot) => snapshot.container_id === containerId)
        .sort((a, b) => b.fetched_at.localeCompare(a.fetched_at))[0] ?? null
    return latest
  }

  async findAllByContainerId(containerId: string): Promise<readonly Snapshot[]> {
    return [...this.snapshots]
      .filter((snapshot) => snapshot.container_id === containerId)
      .sort((a, b) => b.fetched_at.localeCompare(a.fetched_at))
  }
}

class InMemoryObservationRepository implements ObservationRepository {
  private readonly observations: Observation[] = []

  constructor(initialObservations: readonly Observation[] = []) {
    this.observations.push(...initialObservations)
  }

  async insertMany(newObservations: readonly NewObservation[]): Promise<readonly Observation[]> {
    const baseCreatedAt = Instant.fromIso('2026-03-09T12:00:00.000Z').toEpochMs()
    const created = newObservations.map((observation, index) => ({
      ...observation,
      id: randomUUID(),
      created_at: Instant.fromEpochMs(baseCreatedAt + index).toIsoString(),
    }))
    this.observations.push(...created)
    return created
  }

  async findAllByContainerId(containerId: string): Promise<readonly Observation[]> {
    return [...this.observations]
      .filter((observation) => observation.container_id === containerId)
      .sort(compareObservationsChronologically)
  }

  async findFingerprintsByContainerId(containerId: string): Promise<ReadonlySet<string>> {
    return new Set(
      this.observations
        .filter((observation) => observation.container_id === containerId)
        .map((observation) => observation.fingerprint),
    )
  }

  async listSearchObservations() {
    return []
  }
}

class InMemoryTrackingAlertRepository implements TrackingAlertRepository {
  private readonly alerts: TrackingAlert[] = []

  constructor(initialAlerts: readonly TrackingAlert[] = []) {
    this.alerts.push(...initialAlerts)
  }

  async insertMany(newAlerts: readonly NewTrackingAlert[]): Promise<readonly TrackingAlert[]> {
    const created = newAlerts.map((alert) => ({
      ...alert,
      id: randomUUID(),
    }))
    this.alerts.push(...created)
    return created
  }

  async findActiveByContainerId(containerId: string): Promise<readonly TrackingAlert[]> {
    return this.alerts.filter(
      (alert) =>
        alert.container_id === containerId && resolveAlertLifecycleState(alert) === 'ACTIVE',
    )
  }

  async findByContainerId(containerId: string): Promise<readonly TrackingAlert[]> {
    return this.alerts.filter((alert) => alert.container_id === containerId)
  }

  async findAlertDerivationStateByContainerId(
    containerId: string,
  ): Promise<readonly TrackingAlertDerivationState[]> {
    return this.alerts.filter((alert) => alert.container_id === containerId)
  }

  async findContainerNumbersByIds(
    _containerIds: readonly string[],
  ): Promise<ReadonlyMap<string, string>> {
    return new Map()
  }

  async findActiveTypesByContainerId(containerId: string): Promise<ReadonlySet<string>> {
    return new Set(
      this.alerts
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
    const index = this.alerts.findIndex(
      (alert) => alert.id === alertId && resolveAlertLifecycleState(alert) === 'ACTIVE',
    )
    if (index < 0) {
      return
    }

    const current = this.alerts[index]
    if (current === undefined) {
      return
    }

    this.alerts[index] = {
      ...current,
      lifecycle_state: 'ACKED',
      acked_at: ackedAt,
      acked_by: metadata.ackedBy,
      acked_source: metadata.ackedSource,
      resolved_at: null,
      resolved_reason: null,
    }
  }

  async unacknowledge(alertId: string): Promise<void> {
    const index = this.alerts.findIndex(
      (alert) => alert.id === alertId && resolveAlertLifecycleState(alert) === 'ACKED',
    )
    if (index < 0) {
      return
    }

    const current = this.alerts[index]
    if (current === undefined) {
      return
    }

    this.alerts[index] = {
      ...current,
      lifecycle_state: 'ACTIVE',
      acked_at: null,
      acked_by: null,
      acked_source: null,
      resolved_at: null,
      resolved_reason: null,
    }
  }

  async autoResolveMany(command: {
    readonly alertIds: readonly string[]
    readonly resolvedAt: string
    readonly reason: 'condition_cleared' | 'terminal_state'
  }): Promise<void> {
    for (const alertId of command.alertIds) {
      const index = this.alerts.findIndex((alert) => alert.id === alertId)
      if (index < 0) continue
      const current = this.alerts[index]
      if (current === undefined) continue
      if (resolveAlertLifecycleState(current) !== 'ACTIVE') continue
      this.alerts[index] = {
        ...current,
        lifecycle_state: 'AUTO_RESOLVED',
        resolved_at: command.resolvedAt,
        resolved_reason: command.reason,
        acked_at: null,
        acked_by: null,
        acked_source: null,
      }
    }
  }
}

function makeObservation(
  containerId: string,
  containerNumber: string,
  overrides: Partial<Observation>,
): Observation {
  return {
    id: randomUUID(),
    fingerprint: randomUUID(),
    container_id: containerId,
    container_number: containerNumber,
    type: 'OTHER',
    event_time: resolveTemporalValue(
      overrides.event_time,
      temporalValueFromCanonical('2025-11-01T00:00:00.000Z'),
    ),
    event_time_type: 'ACTUAL',
    location_code: 'SGSIN',
    location_display: 'SINGAPORE, SG',
    vessel_name: null,
    voyage: null,
    is_empty: null,
    confidence: 'high',
    provider: 'msc',
    created_from_snapshot_id: randomUUID(),
    created_at: '2025-11-01T00:00:00.000Z',
    ...overrides,
  }
}

function makeTransshipmentObservations(
  containerId: string,
  containerNumber: string,
  dischargeFingerprint: string,
  loadFingerprint: string,
): readonly Observation[] {
  return [
    makeObservation(containerId, containerNumber, {
      type: 'LOAD',
      fingerprint: 'fp-origin-load',
      event_time: temporalValueFromCanonical('2025-10-15T00:00:00.000Z'),
      location_code: 'CNSHA',
      location_display: 'SHANGHAI, CN',
      vessel_name: 'Vessel A',
    }),
    makeObservation(containerId, containerNumber, {
      type: 'DISCHARGE',
      fingerprint: dischargeFingerprint,
      event_time: temporalValueFromCanonical('2025-12-01T00:00:00.000Z'),
      location_code: 'SGSIN',
      location_display: 'SINGAPORE, SG',
      vessel_name: 'Vessel A',
    }),
    makeObservation(containerId, containerNumber, {
      type: 'LOAD',
      fingerprint: loadFingerprint,
      event_time: temporalValueFromCanonical('2025-12-03T00:00:00.000Z'),
      location_code: 'SGSIN',
      location_display: 'SINGAPORE, SG',
      vessel_name: 'Vessel B',
    }),
    makeObservation(containerId, containerNumber, {
      type: 'ARRIVAL',
      fingerprint: 'fp-recent-arrival',
      event_time: temporalValueFromCanonical('2099-01-01T00:00:00.000Z'),
      location_code: 'BRSSZ',
      location_display: 'SANTOS, BR',
      vessel_name: 'Vessel B',
    }),
  ]
}

function makeTransshipmentAlert(params: {
  readonly containerId: string
  readonly dischargeFingerprint: string
  readonly loadFingerprint: string
  readonly ackedAt: string | null
}): TrackingAlert {
  return {
    id: randomUUID(),
    container_id: params.containerId,
    category: 'fact',
    type: 'TRANSSHIPMENT',
    severity: 'warning',
    message_key: 'alerts.transshipmentDetected',
    message_params: {
      port: 'SGSIN',
      fromVessel: 'Vessel A',
      toVessel: 'Vessel B',
    },
    detected_at: '2025-12-03T00:00:00.000Z',
    triggered_at: '2025-12-03T01:00:00.000Z',
    source_observation_fingerprints: [params.dischargeFingerprint, params.loadFingerprint],
    alert_fingerprint: computeAlertFingerprint('TRANSSHIPMENT', [
      params.dischargeFingerprint,
      params.loadFingerprint,
    ]),
    retroactive: false,
    provider: null,
    acked_at: params.ackedAt,
    acked_by: params.ackedAt === null ? null : 'operator@test',
    acked_source: params.ackedAt === null ? null : 'dashboard',
  }
}

function makeSnapshot(containerId: string): Snapshot {
  return {
    id: randomUUID(),
    container_id: containerId,
    provider: 'msc',
    fetched_at: '2026-03-09T00:00:00.000Z',
    payload: {},
  }
}

describe('processSnapshot alert idempotency with ACK', () => {
  const containerNumber = 'CXDU2058677'

  it('does not re-emit the same transshipment fingerprint after ACK', async () => {
    const containerId = randomUUID()
    const dischargeFingerprint = 'fp-discharge-1'
    const loadFingerprint = 'fp-load-1'

    const snapshotRepository = new InMemorySnapshotRepository()
    const observationRepository = new InMemoryObservationRepository(
      makeTransshipmentObservations(
        containerId,
        containerNumber,
        dischargeFingerprint,
        loadFingerprint,
      ),
    )
    const trackingAlertRepository = new InMemoryTrackingAlertRepository([
      makeTransshipmentAlert({
        containerId,
        dischargeFingerprint,
        loadFingerprint,
        ackedAt: '2026-03-08T15:00:00.000Z',
      }),
    ])

    const result = await processSnapshot(
      makeSnapshot(containerId),
      containerId,
      containerNumber,
      { snapshotRepository, observationRepository, trackingAlertRepository },
      false,
    )

    expect(result.newAlerts).toHaveLength(0)
    expect(await trackingAlertRepository.findByContainerId(containerId)).toHaveLength(1)
  })

  it('emits a new alert when the transshipment fingerprint changes', async () => {
    const containerId = randomUUID()
    const oldDischargeFingerprint = 'fp-discharge-old'
    const oldLoadFingerprint = 'fp-load-old'
    const newDischargeFingerprint = 'fp-discharge-new'
    const newLoadFingerprint = 'fp-load-new'

    const snapshotRepository = new InMemorySnapshotRepository()
    const observationRepository = new InMemoryObservationRepository(
      makeTransshipmentObservations(
        containerId,
        containerNumber,
        newDischargeFingerprint,
        newLoadFingerprint,
      ),
    )
    const trackingAlertRepository = new InMemoryTrackingAlertRepository([
      makeTransshipmentAlert({
        containerId,
        dischargeFingerprint: oldDischargeFingerprint,
        loadFingerprint: oldLoadFingerprint,
        ackedAt: '2026-03-08T15:00:00.000Z',
      }),
    ])

    const result = await processSnapshot(
      makeSnapshot(containerId),
      containerId,
      containerNumber,
      { snapshotRepository, observationRepository, trackingAlertRepository },
      false,
    )

    expect(result.newAlerts).toHaveLength(1)
    expect(result.newAlerts[0]?.alert_fingerprint).toBe(
      computeAlertFingerprint('TRANSSHIPMENT', [newDischargeFingerprint, newLoadFingerprint]),
    )
    expect(await trackingAlertRepository.findByContainerId(containerId)).toHaveLength(2)
  })

  it('keeps idempotency when reprocessing the same fact without ACK', async () => {
    const containerId = randomUUID()
    const dischargeFingerprint = 'fp-discharge-1'
    const loadFingerprint = 'fp-load-1'

    const snapshotRepository = new InMemorySnapshotRepository()
    const observationRepository = new InMemoryObservationRepository(
      makeTransshipmentObservations(
        containerId,
        containerNumber,
        dischargeFingerprint,
        loadFingerprint,
      ),
    )
    const trackingAlertRepository = new InMemoryTrackingAlertRepository()
    const deps = { snapshotRepository, observationRepository, trackingAlertRepository }

    const firstResult = await processSnapshot(
      makeSnapshot(containerId),
      containerId,
      containerNumber,
      deps,
      false,
    )
    const secondResult = await processSnapshot(
      makeSnapshot(containerId),
      containerId,
      containerNumber,
      deps,
      false,
    )

    expect(firstResult.newAlerts).toHaveLength(1)
    expect(secondResult.newAlerts).toHaveLength(0)
    expect(await trackingAlertRepository.findByContainerId(containerId)).toHaveLength(1)
  })

  it('keeps alert identity unchanged after ACK and still blocks duplicate emission', async () => {
    const containerId = randomUUID()
    const dischargeFingerprint = 'fp-discharge-1'
    const loadFingerprint = 'fp-load-1'

    const snapshotRepository = new InMemorySnapshotRepository()
    const observationRepository = new InMemoryObservationRepository(
      makeTransshipmentObservations(
        containerId,
        containerNumber,
        dischargeFingerprint,
        loadFingerprint,
      ),
    )
    const trackingAlertRepository = new InMemoryTrackingAlertRepository()
    const deps = { snapshotRepository, observationRepository, trackingAlertRepository }

    const firstResult = await processSnapshot(
      makeSnapshot(containerId),
      containerId,
      containerNumber,
      deps,
      false,
    )
    const firstAlert = firstResult.newAlerts[0]
    expect(firstAlert).toBeDefined()

    if (firstAlert === undefined) {
      throw new Error('expected initial transshipment alert to exist')
    }

    const firstFingerprint = firstAlert.alert_fingerprint
    await trackingAlertRepository.acknowledge(firstAlert.id, '2026-03-08T15:00:00.000Z', {
      ackedBy: 'operator@test',
      ackedSource: 'dashboard',
    })

    const afterAck = await trackingAlertRepository.findByContainerId(containerId)
    expect(afterAck).toHaveLength(1)
    expect(afterAck[0]?.alert_fingerprint).toBe(firstFingerprint)
    expect(afterAck[0]?.acked_at).toBe('2026-03-08T15:00:00.000Z')

    const secondResult = await processSnapshot(
      makeSnapshot(containerId),
      containerId,
      containerNumber,
      deps,
      false,
    )
    expect(secondResult.newAlerts).toHaveLength(0)
    expect(await trackingAlertRepository.findByContainerId(containerId)).toHaveLength(1)
  })
})
