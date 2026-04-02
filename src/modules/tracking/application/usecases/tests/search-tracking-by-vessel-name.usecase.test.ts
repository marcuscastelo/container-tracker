import { describe, expect, it, vi } from 'vitest'
import { searchTrackingByVesselName } from '~/modules/tracking/application/usecases/search-tracking-by-vessel-name.usecase'
import type { TrackingUseCasesDeps } from '~/modules/tracking/application/usecases/types'
import type { Snapshot } from '~/modules/tracking/domain/model/snapshot'
import type { TrackingAlert } from '~/modules/tracking/features/alerts/domain/model/trackingAlert'
import type { Observation } from '~/modules/tracking/features/observation/domain/model/observation'
import {
  instantFromIsoText,
  resolveTemporalValue,
  temporalDtoFromCanonical,
} from '~/shared/time/tests/helpers'

type ObservationParams = Readonly<{
  id: string
  containerId: string
  containerNumber: string
  type: Observation['type']
  eventTime: string | Observation['event_time']
  eventTimeType: Observation['event_time_type']
  vesselName: string | null
  createdAt: string
  locationCode?: string | null
  locationDisplay?: string | null
}>

function makeObservation(params: ObservationParams): Observation {
  return {
    id: params.id,
    fingerprint: `fp-${params.id}`,
    container_id: params.containerId,
    container_number: params.containerNumber,
    type: params.type,
    event_time: resolveTemporalValue(params.eventTime, null),
    event_time_type: params.eventTimeType,
    location_code: params.locationCode ?? null,
    location_display: params.locationDisplay ?? null,
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
      findAllByContainerIds: vi.fn(async () => []),
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
      findActiveByContainerIds: vi.fn(async (): Promise<readonly TrackingAlert[]> => []),
      findByContainerId: vi.fn(async (): Promise<readonly TrackingAlert[]> => []),
      findAlertDerivationStateByContainerId: vi.fn(async () => []),
      findContainerNumbersByIds: vi.fn(async () => new Map<string, string>()),
      findActiveTypesByContainerId: vi.fn(async () => new Set<string>()),
      listActiveAlertReadModel: vi.fn(async () => []),
      acknowledge: vi.fn(async () => undefined),
      unacknowledge: vi.fn(async () => undefined),
      autoResolveMany: vi.fn(async () => undefined),
    },
    syncMetadataRepository: {
      listByContainerNumbers: vi.fn(async () => []),
    },
  }
}

describe('searchTrackingByVesselName', () => {
  it('matches vessel name and returns tracking-derived projection fields', async () => {
    const deps = createDeps(async () => [
      {
        processId: 'process-1',
        observation: makeObservation({
          id: 'obs-1',
          containerId: 'container-1',
          containerNumber: 'MSCU1111111',
          type: 'GATE_IN',
          eventTime: '2026-02-01T00:00:00.000Z',
          eventTimeType: 'ACTUAL',
          vesselName: null,
          createdAt: '2026-02-01T00:00:00.000Z',
          locationCode: 'BRSSZ',
          locationDisplay: 'Santos',
        }),
      },
      {
        processId: 'process-1',
        observation: makeObservation({
          id: 'obs-2',
          containerId: 'container-1',
          containerNumber: 'MSCU1111111',
          type: 'LOAD',
          eventTime: '2026-02-05T00:00:00.000Z',
          eventTimeType: 'ACTUAL',
          vesselName: 'MAERSK BROWNSVILLE',
          createdAt: '2026-02-05T00:00:00.000Z',
          locationCode: 'BRSSZ',
          locationDisplay: 'Santos',
        }),
      },
      {
        processId: 'process-1',
        observation: makeObservation({
          id: 'obs-3',
          containerId: 'container-1',
          containerNumber: 'MSCU1111111',
          type: 'ARRIVAL',
          eventTime: '2026-03-20T00:00:00.000Z',
          eventTimeType: 'EXPECTED',
          vesselName: 'MAERSK BROWNSVILLE',
          createdAt: '2026-02-20T00:00:00.000Z',
          locationCode: 'BRSSZ',
          locationDisplay: 'Santos',
        }),
      },
      {
        processId: 'process-2',
        observation: makeObservation({
          id: 'obs-4',
          containerId: 'container-2',
          containerNumber: 'MSCU2222222',
          type: 'LOAD',
          eventTime: '2026-02-06T00:00:00.000Z',
          eventTimeType: 'ACTUAL',
          vesselName: 'CMA CGM LIBRA',
          createdAt: '2026-02-06T00:00:00.000Z',
          locationCode: 'BRRIO',
          locationDisplay: 'Rio de Janeiro',
        }),
      },
    ])

    const result = await searchTrackingByVesselName(deps, {
      query: 'brown',
      limit: 30,
      now: instantFromIsoText('2026-03-01T00:00:00.000Z'),
    })

    expect(result).toEqual([
      {
        processId: 'process-1',
        vesselName: 'MAERSK BROWNSVILLE',
        latestDerivedStatus: 'LOADED',
        latestEta: temporalDtoFromCanonical('2026-03-20T00:00:00.000Z'),
      },
    ])
  })

  it('respects limit after matching', async () => {
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
        processId: 'process-2',
        observation: makeObservation({
          id: 'obs-2',
          containerId: 'container-2',
          containerNumber: 'MSCU2222222',
          type: 'LOAD',
          eventTime: '2026-02-02T00:00:00.000Z',
          eventTimeType: 'ACTUAL',
          vesselName: 'BETA VESSEL',
          createdAt: '2026-02-02T00:00:00.000Z',
        }),
      },
    ])

    const result = await searchTrackingByVesselName(deps, {
      query: 'vessel',
      limit: 1,
      now: instantFromIsoText('2026-03-01T00:00:00.000Z'),
    })

    expect(result).toHaveLength(1)
  })

  it('returns empty results for empty query without loading projections', async () => {
    const listSearchObservations = vi.fn(async () => [])
    const deps = createDeps(listSearchObservations)

    const result = await searchTrackingByVesselName(deps, {
      query: '   ',
      limit: 30,
      now: instantFromIsoText('2026-03-01T00:00:00.000Z'),
    })

    expect(result).toEqual([])
    expect(listSearchObservations).not.toHaveBeenCalled()
  })
})
