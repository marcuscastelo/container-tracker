import { describe, expect, it, vi } from 'vitest'
import { findContainersOperationalSummaryProjection } from '~/modules/tracking/application/usecases/find-containers-operational-summary-projection.usecase'
import type { TrackingUseCasesDeps } from '~/modules/tracking/application/usecases/types'
import type { Snapshot } from '~/modules/tracking/domain/model/snapshot'
import type { TrackingAlert } from '~/modules/tracking/features/alerts/domain/model/trackingAlert'
import type { Observation } from '~/modules/tracking/features/observation/domain/model/observation'
import {
  instantFromIsoText,
  resolveTemporalValue,
  temporalCanonicalText,
  temporalValueFromCanonical,
} from '~/shared/time/tests/helpers'

function makeObservation(
  containerId: string,
  containerNumber: string,
  overrides: Partial<Observation> = {},
): Observation {
  return {
    id: `obs-${containerId}`,
    fingerprint: `fp-${containerId}`,
    container_id: containerId,
    container_number: containerNumber,
    type: 'ARRIVAL',
    event_time: resolveTemporalValue(
      overrides.event_time,
      temporalValueFromCanonical('2026-02-20T10:00:00.000Z'),
    ),
    event_time_type: 'EXPECTED',
    location_code: 'BRSSZ',
    location_display: 'Santos',
    vessel_name: null,
    voyage: null,
    is_empty: null,
    confidence: 'high',
    provider: 'msc',
    created_from_snapshot_id: 'snapshot-1',
    created_at: '2026-02-10T10:00:00.000Z',
    retroactive: false,
    ...overrides,
  }
}

function createDeps(observations: readonly Observation[]) {
  const findAllByContainerId = vi.fn(async (containerId: string) =>
    observations.filter((observation) => observation.container_id === containerId),
  )
  const findAllByContainerIds = vi.fn(async (containerIds: readonly string[]) => {
    const requestedIds = new Set(containerIds)
    return observations.filter((observation) => requestedIds.has(observation.container_id))
  })

  const deps: TrackingUseCasesDeps = {
    observationRepository: {
      insertMany: vi.fn(async () => []),
      findAllByContainerId,
      findAllByContainerIds,
      findFingerprintsByContainerId: vi.fn(async () => new Set<string>()),
      listSearchObservations: vi.fn(async () => []),
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

  return { deps, findAllByContainerId, findAllByContainerIds }
}

describe('findContainersOperationalSummaryProjection', () => {
  it('returns summaries for multiple containers using the batch observation read', async () => {
    const observations = [
      makeObservation('c1', 'MSCU1111111'),
      makeObservation('c2', 'MSCU2222222', {
        event_time: temporalValueFromCanonical('2026-02-22T10:00:00.000Z'),
      }),
    ]
    const { deps, findAllByContainerId, findAllByContainerIds } = createDeps(observations)

    const summaries = await findContainersOperationalSummaryProjection(deps, {
      containers: [
        { containerId: 'c1', containerNumber: 'MSCU1111111', podLocationCode: 'BRSSZ' },
        { containerId: 'c2', containerNumber: 'MSCU2222222', podLocationCode: 'BRSSZ' },
      ],
      now: instantFromIsoText('2026-02-15T00:00:00.000Z'),
    })

    expect(findAllByContainerIds).toHaveBeenCalledTimes(1)
    expect(findAllByContainerIds).toHaveBeenCalledWith(['c1', 'c2'])
    expect(findAllByContainerId).not.toHaveBeenCalled()
    expect(summaries.size).toBe(2)
    expect(summaries.get('c1')?.status).toBe('IN_PROGRESS')
    expect(temporalCanonicalText(summaries.get('c1')?.eta?.eventTime ?? null)).toBe(
      '2026-02-20T10:00:00.000Z',
    )
    expect(temporalCanonicalText(summaries.get('c2')?.eta?.eventTime ?? null)).toBe(
      '2026-02-22T10:00:00.000Z',
    )
  })

  it('returns an empty map for empty input without querying repositories', async () => {
    const { deps, findAllByContainerIds } = createDeps([])

    const summaries = await findContainersOperationalSummaryProjection(deps, {
      containers: [],
      now: instantFromIsoText('2026-02-15T00:00:00.000Z'),
    })

    expect(summaries.size).toBe(0)
    expect(findAllByContainerIds).not.toHaveBeenCalled()
  })
})
