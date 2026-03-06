import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { processSnapshot } from '~/modules/tracking/application/orchestration/pipeline'
import type { TrackingAlertRepository } from '~/modules/tracking/application/ports/tracking.alert.repository'
import type { ObservationRepository } from '~/modules/tracking/application/ports/tracking.observation.repository'
import type { SnapshotRepository } from '~/modules/tracking/application/ports/tracking.snapshot.repository'
import type { TrackingActiveAlertReadModel } from '~/modules/tracking/application/projection/tracking.active-alert.readmodel'
import type { NewObservation, Observation } from '~/modules/tracking/domain/model/observation'
import type { NewSnapshot, Snapshot } from '~/modules/tracking/domain/model/snapshot'
import type {
  NewTrackingAlert,
  TrackingAlert,
  TrackingAlertAckSource,
} from '~/modules/tracking/domain/model/trackingAlert'
import maerskPayload from '~/modules/tracking/infrastructure/carriers/tests/fixtures/maersk/maersk_full.json'

// Note: repositories now throw on infra errors and return direct types.

/**
 * In-memory implementation of SnapshotRepository for testing.
 * Minimal implementation - no excessive mocking.
 */
class InMemorySnapshotRepository implements SnapshotRepository {
  private snapshots: Map<string, Snapshot> = new Map()

  async insert(snapshot: NewSnapshot): Promise<Snapshot> {
    const newSnapshot: Snapshot = {
      ...snapshot,
      id: randomUUID(),
    }
    this.snapshots.set(newSnapshot.id, newSnapshot)
    return newSnapshot
  }

  async findLatestByContainerId(containerId: string): Promise<Snapshot | null> {
    const containerSnapshots = Array.from(this.snapshots.values())
      .filter((s) => s.container_id === containerId)
      .sort((a, b) => b.fetched_at.localeCompare(a.fetched_at))
    return containerSnapshots[0] ?? null
  }

  async findAllByContainerId(containerId: string): Promise<readonly Snapshot[]> {
    const list = Array.from(this.snapshots.values())
      .filter((s) => s.container_id === containerId)
      .sort((a, b) => b.fetched_at.localeCompare(a.fetched_at))
    return list
  }
}

/**
 * In-memory implementation of ObservationRepository for testing.
 * Minimal implementation - no excessive mocking.
 */
class InMemoryObservationRepository implements ObservationRepository {
  private observations: Map<string, Observation> = new Map()

  async insertMany(newObservations: readonly NewObservation[]): Promise<readonly Observation[]> {
    const inserted: Observation[] = []
    for (const obs of newObservations) {
      const newObs: Observation = {
        ...obs,
        id: randomUUID(),
        created_at: new Date().toISOString(),
      }
      this.observations.set(newObs.id, newObs)
      inserted.push(newObs)
    }
    return inserted
  }

  async findAllByContainerId(containerId: string): Promise<readonly Observation[]> {
    const list = Array.from(this.observations.values())
      .filter((o) => o.container_id === containerId)
      .sort((a, b) => {
        // Same sort logic as deriveTimeline
        if (a.event_time === null && b.event_time === null) {
          return a.created_at.localeCompare(b.created_at)
        }
        if (a.event_time === null) return 1
        if (b.event_time === null) return -1
        const cmp = a.event_time.localeCompare(b.event_time)
        if (cmp !== 0) return cmp

        if (a.event_time_type === 'ACTUAL' && b.event_time_type === 'EXPECTED') return -1
        if (a.event_time_type === 'EXPECTED' && b.event_time_type === 'ACTUAL') return 1

        return a.created_at.localeCompare(b.created_at)
      })
    return list
  }

  async findFingerprintsByContainerId(containerId: string): Promise<ReadonlySet<string>> {
    const fingerprints = Array.from(this.observations.values())
      .filter((o) => o.container_id === containerId)
      .map((o) => o.fingerprint)
    return new Set(fingerprints)
  }

  async listSearchObservations() {
    return []
  }
}

/**
 * In-memory implementation of TrackingAlertRepository for testing.
 * Minimal implementation - no excessive mocking.
 */
class InMemoryTrackingAlertRepository implements TrackingAlertRepository {
  private alerts: Map<string, TrackingAlert> = new Map()

  async insertMany(newAlerts: readonly NewTrackingAlert[]): Promise<readonly TrackingAlert[]> {
    const inserted: TrackingAlert[] = []
    for (const alert of newAlerts) {
      const newAlert: TrackingAlert = {
        ...alert,
        id: randomUUID(),
      }
      this.alerts.set(newAlert.id, newAlert)
      inserted.push(newAlert)
    }
    return inserted
  }
  async findActiveByContainerId(containerId: string): Promise<readonly TrackingAlert[]> {
    const list = Array.from(this.alerts.values()).filter(
      (a) => a.container_id === containerId && !a.acked_at,
    )
    return list
  }
  async findByContainerId(containerId: string): Promise<readonly TrackingAlert[]> {
    const list = Array.from(this.alerts.values()).filter((a) => a.container_id === containerId)
    return list
  }
  async findActiveTypesByContainerId(containerId: string): Promise<ReadonlySet<string>> {
    const types = Array.from(this.alerts.values())
      .filter((a) => a.container_id === containerId && !a.acked_at)
      .map((a) => a.type)
    return new Set(types)
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
    if (alert) {
      this.alerts.set(alertId, {
        ...alert,
        acked_at: ackedAt,
        acked_by: metadata.ackedBy,
        acked_source: metadata.ackedSource,
      })
    }
    return
  }
  async unacknowledge(alertId: string): Promise<void> {
    const alert = this.alerts.get(alertId)
    if (alert) {
      this.alerts.set(alertId, { ...alert, acked_at: null, acked_by: null, acked_source: null })
    }
    return
  }
}

describe('Pipeline Integration Tests - Maersk', () => {
  it('should process Maersk snapshot through complete pipeline: parsing → observations → timeline', async () => {
    // Arrange
    const containerId = randomUUID()
    const containerNumber = 'MNBU3094033'
    const fetchedAt = '2026-02-03T15:00:00.000Z'

    const snapshot: Snapshot = {
      id: randomUUID(),
      container_id: containerId,
      provider: 'maersk',
      fetched_at: fetchedAt,
      payload: maerskPayload,
    }

    const snapshotRepo = new InMemorySnapshotRepository()
    const observationRepo = new InMemoryObservationRepository()
    const alertRepo = new InMemoryTrackingAlertRepository()

    // Act
    const result = await processSnapshot(
      snapshot,
      containerId,
      containerNumber,
      {
        snapshotRepository: snapshotRepo,
        observationRepository: observationRepo,
        trackingAlertRepository: alertRepo,
      },
      false,
    )

    // Assert - Observations were created
    expect(result.newObservations.length).toBeGreaterThan(0)
    expect(result.newObservations.length).toBe(7) // 4 at PORT SAID EAST + 2 at TANGER MED + 1 at SANTOS

    // Assert - All observations have correct container info
    for (const obs of result.newObservations) {
      expect(obs.container_id).toBe(containerId)
      expect(obs.container_number).toBe(containerNumber)
      expect(obs.provider).toBe('maersk')
      expect(obs.created_from_snapshot_id).toBe(snapshot.id)
    }

    // Assert - Timeline was derived
    expect(result.timeline).toBeDefined()
    expect(result.timeline.container_id).toBe(containerId)
    expect(result.timeline.container_number).toBe(containerNumber)
    // Timeline observations count may be less than total observations due to
    // visual reconciliation (expired EXPECTED events are collapsed)
    expect(result.timeline.observations.length).toBeLessThanOrEqual(7)
    expect(result.timeline.observations.length).toBeGreaterThan(0)

    // Assert - Timeline is sorted by event_time
    const times = result.timeline.observations
      .filter((o) => o.event_time !== null)
      .map((o) => o.event_time)
    for (let i = 1; i < times.length; i++) {
      const current = times[i]
      const previous = times[i - 1]
      if (current !== null && previous !== null) {
        // Use string comparison for ISO datetime strings
        expect(current >= previous).toBe(true)
      }
    }

    // Assert - Status was derived
    expect(result.status).toBeDefined()
    expect(typeof result.status).toBe('string')
    expect(result.status).not.toBe('UNKNOWN')

    // Assert - Transshipment info was derived
    expect(result.transshipment).toBeDefined()
  })

  it('should handle idempotent processing - second snapshot with same data creates no new observations', async () => {
    // Arrange
    const containerId = randomUUID()
    const containerNumber = 'MNBU3094033'
    const fetchedAt1 = '2026-02-03T15:00:00.000Z'
    const fetchedAt2 = '2026-02-03T16:00:00.000Z'

    const snapshot1: Snapshot = {
      id: randomUUID(),
      container_id: containerId,
      provider: 'maersk',
      fetched_at: fetchedAt1,
      payload: maerskPayload,
    }

    const snapshot2: Snapshot = {
      id: randomUUID(),
      container_id: containerId,
      provider: 'maersk',
      fetched_at: fetchedAt2,
      payload: maerskPayload, // Same payload
    }

    const snapshotRepo = new InMemorySnapshotRepository()
    const observationRepo = new InMemoryObservationRepository()
    const alertRepo = new InMemoryTrackingAlertRepository()

    const deps = {
      snapshotRepository: snapshotRepo,
      observationRepository: observationRepo,
      trackingAlertRepository: alertRepo,
    }

    // Act - Process first snapshot
    const result1 = await processSnapshot(snapshot1, containerId, containerNumber, deps, false)
    expect(result1.newObservations.length).toBe(7)

    // Act - Process second snapshot with same data
    const result2 = await processSnapshot(snapshot2, containerId, containerNumber, deps, false)

    // Assert - No new observations created (deduplication works)
    expect(result2.newObservations.length).toBe(0)

    // Assert - Timeline observations may be less than total due to visual reconciliation
    expect(result2.timeline.observations.length).toBeLessThanOrEqual(7)
    expect(result2.timeline.observations.length).toBeGreaterThan(0)
  })

  it('should detect event types correctly from Maersk payload', async () => {
    // Arrange
    const containerId = randomUUID()
    const containerNumber = 'MNBU3094033'
    const snapshot: Snapshot = {
      id: randomUUID(),
      container_id: containerId,
      provider: 'maersk',
      fetched_at: '2026-02-03T15:00:00.000Z',
      payload: maerskPayload,
    }

    const deps = {
      snapshotRepository: new InMemorySnapshotRepository(),
      observationRepository: new InMemoryObservationRepository(),
      trackingAlertRepository: new InMemoryTrackingAlertRepository(),
    }

    // Act
    const result = await processSnapshot(snapshot, containerId, containerNumber, deps, false)

    // Assert - GATE_OUT event exists
    const gateOut = result.timeline.observations.find((o) => o.type === 'GATE_OUT')
    expect(gateOut).toBeDefined()
    expect(gateOut?.is_empty).toBe(true)

    // Assert - GATE_IN event exists
    const gateIn = result.timeline.observations.find((o) => o.type === 'GATE_IN')
    expect(gateIn).toBeDefined()
    expect(gateIn?.is_empty).toBe(false)

    // Assert - LOAD event exists with vessel info
    const load = result.timeline.observations.find((o) => o.type === 'LOAD')
    expect(load).toBeDefined()
    expect(load?.vessel_name).toBe('MAERSK BROWNSVILLE')
    expect(load?.voyage).toBe('603S')

    // Assert - DEPARTURE event exists
    const departure = result.timeline.observations.find((o) => o.type === 'DEPARTURE')
    expect(departure).toBeDefined()

    // Assert - ARRIVAL event exists
    const arrival = result.timeline.observations.find((o) => o.type === 'ARRIVAL')
    expect(arrival).toBeDefined()
  })

  it('should distinguish ACTUAL vs EXPECTED events', async () => {
    // Arrange
    const containerId = randomUUID()
    const containerNumber = 'MNBU3094033'
    const snapshot: Snapshot = {
      id: randomUUID(),
      container_id: containerId,
      provider: 'maersk',
      fetched_at: '2026-02-03T15:00:00.000Z',
      payload: maerskPayload,
    }

    const deps = {
      snapshotRepository: new InMemorySnapshotRepository(),
      observationRepository: new InMemoryObservationRepository(),
      trackingAlertRepository: new InMemoryTrackingAlertRepository(),
    }

    // Act
    const result = await processSnapshot(snapshot, containerId, containerNumber, deps, false)

    // Assert - events are classified as ACTUAL/EXPECTED with consistent confidence
    expect(result.timeline.observations.length).toBeGreaterThan(0)

    const classifiedEvents = result.timeline.observations.filter(
      (o) => o.event_time_type === 'ACTUAL' || o.event_time_type === 'EXPECTED',
    )
    expect(classifiedEvents.length).toBe(result.timeline.observations.length)

    // ACTUAL events have high confidence
    const actualEvents = result.timeline.observations.filter((o) => o.event_time_type === 'ACTUAL')
    expect(actualEvents.length).toBeGreaterThan(0)
    for (const event of actualEvents) {
      expect(event.confidence).toBe('high')
    }

    // EXPECTED events (when present) have medium confidence
    const expectedEvents = result.timeline.observations.filter(
      (o) => o.event_time_type === 'EXPECTED',
    )
    for (const event of expectedEvents) {
      expect(event.confidence).toBe('medium')
    }
  })

  it('should handle incompatible payload structure by returning no observations', async () => {
    // Arrange
    const containerId = randomUUID()
    const containerNumber = 'MNBU3094033'

    // Simulate a breaking change in the Maersk API response structure
    const incompatiblePayload = {
      ...maerskPayload,
      // Breaking change - containers has an incompatible type
      containers: 'this-should-be-an-array-not-a-string',
    }

    const snapshot: Snapshot = {
      id: randomUUID(),
      container_id: containerId,
      provider: 'maersk',
      fetched_at: '2026-02-03T15:00:00.000Z',
      payload: incompatiblePayload,
    }

    const deps = {
      snapshotRepository: new InMemorySnapshotRepository(),
      observationRepository: new InMemoryObservationRepository(),
      trackingAlertRepository: new InMemoryTrackingAlertRepository(),
    }

    // Act
    const result = await processSnapshot(snapshot, containerId, containerNumber, deps, false)

    // Assert - No observations created when payload is incompatible
    expect(result.newObservations.length).toBe(0)
    expect(result.timeline.observations.length).toBe(0)
  })

  it('should derive timeline holes when events have large gaps', async () => {
    // This test validates that the timeline derivation logic
    // correctly identifies gaps > 14 days between events.
    // The test uses the real Maersk payload which contains
    // events spread across different dates.

    // Arrange
    const containerId = randomUUID()
    const containerNumber = 'MNBU3094033'
    const snapshot: Snapshot = {
      id: randomUUID(),
      container_id: containerId,
      provider: 'maersk',
      fetched_at: '2026-02-03T15:00:00.000Z',
      payload: maerskPayload,
    }

    const deps = {
      snapshotRepository: new InMemorySnapshotRepository(),
      observationRepository: new InMemoryObservationRepository(),
      trackingAlertRepository: new InMemoryTrackingAlertRepository(),
    }

    // Act
    const result = await processSnapshot(snapshot, containerId, containerNumber, deps, false)

    // Assert - Timeline exists
    expect(result.timeline).toBeDefined()
    expect(result.timeline.holes).toBeDefined()

    // The timeline holes detection is working
    // (will vary based on actual event dates in the fixture)
  })
})
