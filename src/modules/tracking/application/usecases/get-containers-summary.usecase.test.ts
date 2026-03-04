import { describe, expect, it, vi } from 'vitest'
import { getContainersSummary } from '~/modules/tracking/application/usecases/get-containers-summary.usecase'
import type { TrackingUseCasesDeps } from '~/modules/tracking/application/usecases/types'
import type { Observation } from '~/modules/tracking/domain/model/observation'
import type { Snapshot } from '~/modules/tracking/domain/model/snapshot'
import type { TrackingAlert } from '~/modules/tracking/domain/model/trackingAlert'

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
    event_time: '2026-02-20T10:00:00.000Z',
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
    ...overrides,
  }
}

function createDeps(
  findAllByContainerId: TrackingUseCasesDeps['observationRepository']['findAllByContainerId'],
): TrackingUseCasesDeps {
  return {
    observationRepository: {
      insertMany: vi.fn(async () => []),
      findAllByContainerId,
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
      findActiveTypesByContainerId: vi.fn(async () => new Set<string>()),
      listActiveAlertReadModel: vi.fn(async () => []),
      acknowledge: vi.fn(async () => undefined),
      dismiss: vi.fn(async () => undefined),
    },
  }
}

describe('getContainersSummary', () => {
  it('returns summaries for multiple containers', async () => {
    const deps = createDeps(async (containerId) => {
      if (containerId === 'c1') {
        return [makeObservation('c1', 'MSCU1111111')]
      }
      return [
        makeObservation('c2', 'MSCU2222222', {
          event_time: '2026-02-22T10:00:00.000Z',
        }),
      ]
    })

    const summaries = await getContainersSummary(deps, {
      containers: [
        { containerId: 'c1', containerNumber: 'MSCU1111111', podLocationCode: 'BRSSZ' },
        { containerId: 'c2', containerNumber: 'MSCU2222222', podLocationCode: 'BRSSZ' },
      ],
      now: new Date('2026-02-15T00:00:00.000Z'),
    })

    expect(summaries.size).toBe(2)
    expect(summaries.get('c1')?.status).toBe('IN_PROGRESS')
    expect(summaries.get('c1')?.eta?.eventTimeIso).toBe('2026-02-20T10:00:00.000Z')
    expect(summaries.get('c2')?.eta?.eventTimeIso).toBe('2026-02-22T10:00:00.000Z')
  })

  it('keeps partial success and marks dataIssue=true for failed containers', async () => {
    const deps = createDeps(async (containerId) => {
      if (containerId === 'c2') {
        throw new Error('database unavailable')
      }
      return [makeObservation(containerId, 'MSCU1111111')]
    })

    const summaries = await getContainersSummary(deps, {
      containers: [
        { containerId: 'c1', containerNumber: 'MSCU1111111', podLocationCode: 'BRSSZ' },
        { containerId: 'c2', containerNumber: 'MSCU2222222', podLocationCode: 'BRSSZ' },
      ],
      now: new Date('2026-02-15T00:00:00.000Z'),
    })

    expect(summaries.size).toBe(2)
    expect(summaries.get('c1')?.dataIssue).toBe(false)
    expect(summaries.get('c2')?.dataIssue).toBe(true)
    expect(summaries.get('c2')?.status).toBe('UNKNOWN')
    expect(summaries.get('c2')?.eta).toBeNull()
    expect(summaries.get('c2')?.transshipment.count).toBe(0)
  })
})
