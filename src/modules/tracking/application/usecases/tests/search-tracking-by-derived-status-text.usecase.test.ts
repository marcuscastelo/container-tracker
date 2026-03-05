import { describe, expect, it, vi } from 'vitest'
import { searchTrackingByDerivedStatusText } from '~/modules/tracking/application/usecases/search-tracking-by-derived-status-text.usecase'
import type { TrackingUseCasesDeps } from '~/modules/tracking/application/usecases/types'
import type { Observation } from '~/modules/tracking/domain/model/observation'
import type { Snapshot } from '~/modules/tracking/domain/model/snapshot'
import type { TrackingAlert } from '~/modules/tracking/domain/model/trackingAlert'

type ObservationParams = Readonly<{
  id: string
  containerId: string
  containerNumber: string
  type: Observation['type']
  eventTime: string | null
  eventTimeType: Observation['event_time_type']
  vesselName: string | null
  createdAt: string
}>

function makeObservation(params: ObservationParams): Observation {
  return {
    id: params.id,
    fingerprint: `fp-${params.id}`,
    container_id: params.containerId,
    container_number: params.containerNumber,
    type: params.type,
    event_time: params.eventTime,
    event_time_type: params.eventTimeType,
    location_code: 'BRSSZ',
    location_display: 'Santos',
    vessel_name: params.vesselName,
    voyage: null,
    is_empty: null,
    confidence: 'high',
    provider: 'msc',
    created_from_snapshot_id: 'snapshot-1',
    created_at: params.createdAt,
    retroactive: false,
  }
}

function createDeps(
  listSearchObservations: TrackingUseCasesDeps['observationRepository']['listSearchObservations'],
): TrackingUseCasesDeps {
  return {
    observationRepository: {
      insertMany: vi.fn(async () => []),
      findAllByContainerId: vi.fn(async () => []),
      findFingerprintsByContainerId: vi.fn(async () => new Set<string>()),
      listSearchObservations,
    },
    snapshotRepository: {
      insert: vi.fn(async () => {
        throw new Error('not used')
      }),
      findLatestByContainerId: vi.fn(async (): Promise<Snapshot | null> => null),
      findAllByContainerId: vi.fn(async (): Promise<readonly Snapshot[]> => []),
    },
    trackingAlertRepository: {
      insertMany: vi.fn(async () => []),
      findActiveByContainerId: vi.fn(async (): Promise<readonly TrackingAlert[]> => []),
      findActiveTypesByContainerId: vi.fn(async () => new Set<string>()),
      listActiveAlertReadModel: vi.fn(async () => []),
      acknowledge: vi.fn(async () => undefined),
      dismiss: vi.fn(async () => undefined),
    },
    syncMetadataRepository: {
      listByContainerNumbers: vi.fn(async () => []),
    },
  }
}

describe('searchTrackingByDerivedStatusText', () => {
  it('matches exact status text (case-insensitive) and returns tracking projections', async () => {
    const deps = createDeps(async () => [
      {
        processId: 'process-1',
        observation: makeObservation({
          id: 'obs-1',
          containerId: 'container-1',
          containerNumber: 'MSCU1111111',
          type: 'LOAD',
          eventTime: '2026-02-01T00:00:00.000Z',
          eventTimeType: 'ACTUAL',
          vesselName: 'ALPHA VESSEL',
          createdAt: '2026-02-01T00:00:00.000Z',
        }),
      },
      {
        processId: 'process-1',
        observation: makeObservation({
          id: 'obs-2',
          containerId: 'container-1',
          containerNumber: 'MSCU1111111',
          type: 'DEPARTURE',
          eventTime: '2026-02-02T00:00:00.000Z',
          eventTimeType: 'ACTUAL',
          vesselName: 'ALPHA VESSEL',
          createdAt: '2026-02-02T00:00:00.000Z',
        }),
      },
      {
        processId: 'process-1',
        observation: makeObservation({
          id: 'obs-3',
          containerId: 'container-1',
          containerNumber: 'MSCU1111111',
          type: 'ARRIVAL',
          eventTime: '2026-03-30T00:00:00.000Z',
          eventTimeType: 'EXPECTED',
          vesselName: 'ALPHA VESSEL',
          createdAt: '2026-02-10T00:00:00.000Z',
        }),
      },
      {
        processId: 'process-2',
        observation: makeObservation({
          id: 'obs-4',
          containerId: 'container-2',
          containerNumber: 'MSCU2222222',
          type: 'DELIVERY',
          eventTime: '2026-02-15T00:00:00.000Z',
          eventTimeType: 'ACTUAL',
          vesselName: null,
          createdAt: '2026-02-15T00:00:00.000Z',
        }),
      },
    ])

    const result = await searchTrackingByDerivedStatusText(deps, {
      query: '  in_transit ',
      limit: 30,
      now: new Date('2026-03-01T00:00:00.000Z'),
    })

    expect(result).toEqual([
      {
        processId: 'process-1',
        vesselName: 'ALPHA VESSEL',
        latestDerivedStatus: 'IN_TRANSIT',
        latestEta: '2026-03-30T00:00:00.000Z',
      },
    ])
  })

  it('does not match partial status text', async () => {
    const deps = createDeps(async () => [
      {
        processId: 'process-1',
        observation: makeObservation({
          id: 'obs-1',
          containerId: 'container-1',
          containerNumber: 'MSCU1111111',
          type: 'DEPARTURE',
          eventTime: '2026-02-02T00:00:00.000Z',
          eventTimeType: 'ACTUAL',
          vesselName: 'ALPHA VESSEL',
          createdAt: '2026-02-02T00:00:00.000Z',
        }),
      },
    ])

    const result = await searchTrackingByDerivedStatusText(deps, {
      query: 'transit',
      limit: 30,
      now: new Date('2026-03-01T00:00:00.000Z'),
    })

    expect(result).toEqual([])
  })

  it('respects limit and skips repository call for empty query', async () => {
    const listSearchObservations = vi.fn(async () => [
      {
        processId: 'process-1',
        observation: makeObservation({
          id: 'obs-1',
          containerId: 'container-1',
          containerNumber: 'MSCU1111111',
          type: 'DELIVERY',
          eventTime: '2026-02-01T00:00:00.000Z',
          eventTimeType: 'ACTUAL',
          vesselName: null,
          createdAt: '2026-02-01T00:00:00.000Z',
        }),
      },
      {
        processId: 'process-2',
        observation: makeObservation({
          id: 'obs-2',
          containerId: 'container-2',
          containerNumber: 'MSCU2222222',
          type: 'DELIVERY',
          eventTime: '2026-02-02T00:00:00.000Z',
          eventTimeType: 'ACTUAL',
          vesselName: null,
          createdAt: '2026-02-02T00:00:00.000Z',
        }),
      },
    ])
    const deps = createDeps(listSearchObservations)

    const emptyQuery = await searchTrackingByDerivedStatusText(deps, {
      query: '   ',
      limit: 30,
      now: new Date('2026-03-01T00:00:00.000Z'),
    })

    expect(emptyQuery).toEqual([])
    expect(listSearchObservations).not.toHaveBeenCalled()

    const limited = await searchTrackingByDerivedStatusText(deps, {
      query: 'delivered',
      limit: 1,
      now: new Date('2026-03-01T00:00:00.000Z'),
    })

    expect(limited).toHaveLength(1)
  })
})
