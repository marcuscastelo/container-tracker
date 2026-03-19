import { describe, expect, it, vi } from 'vitest'
import type { TrackingUseCasesDeps } from '~/modules/tracking/application/usecases/types'
import type { TrackingReplayRunResult } from '~/modules/tracking/features/replay/application/tracking.replay.types'
import { TrackingReplayStepLimitError } from '~/modules/tracking/features/replay/application/tracking.replay.types'
import { mapErrorToResponse } from '~/shared/api/errorToResponse'
import { HttpError } from '~/shared/errors/httpErrors'

vi.mock('~/modules/tracking/features/replay/application/run-tracking-replay.usecase', () => ({
  runTrackingReplay: vi.fn(),
}))

import { getTrackingTimeTravel } from '~/modules/tracking/features/replay/application/get-tracking-time-travel.usecase'
import { runTrackingReplay } from '~/modules/tracking/features/replay/application/run-tracking-replay.usecase'

function createNoopDeps(): TrackingUseCasesDeps {
  return {
    snapshotRepository: {
      insert: async () => {
        throw new Error('unused')
      },
      findLatestByContainerId: async () => null,
      findAllByContainerId: async () => [],
      findByIds: async () => [],
    },
    observationRepository: {
      insertMany: async () => [],
      findAllByContainerId: async () => [],
      findFingerprintsByContainerId: async () => new Set<string>(),
      listSearchObservations: async () => [],
    },
    trackingAlertRepository: {
      insertMany: async () => [],
      listActiveAlertReadModel: async () => [],
      findActiveByContainerId: async () => [],
      findByContainerId: async () => [],
      findAlertDerivationStateByContainerId: async () => [],
      findContainerNumbersByIds: async () => new Map<string, string>(),
      findActiveTypesByContainerId: async () => new Set<string>(),
      acknowledge: async () => undefined,
      unacknowledge: async () => undefined,
      autoResolveMany: async () => undefined,
    },
    syncMetadataRepository: {
      listByContainerNumbers: async () => [],
    },
  }
}

describe('getTrackingTimeTravel replay mode', () => {
  it('disables step recording when building historical checkpoints', async () => {
    const deps = createNoopDeps()
    const referenceNow = new Date('2026-02-03T18:30:00.000Z')
    const state = {
      observations: [],
      series: [],
      timeline: [],
      status: 'UNKNOWN',
      alerts: [],
    } satisfies TrackingReplayRunResult['finalState']
    const runResult = {
      containerId: 'container-1',
      containerNumber: 'MNBU3094033',
      referenceNow: referenceNow.toISOString(),
      totalSnapshots: 1,
      totalObservations: 0,
      totalSteps: 0,
      steps: [],
      checkpoints: [
        {
          snapshotId: 'snapshot-1',
          fetchedAt: '2026-02-03T15:00:00.000Z',
          position: 1,
          containerNumber: 'MNBU3094033',
          state,
        },
      ],
      finalState: state,
    } satisfies TrackingReplayRunResult

    vi.mocked(runTrackingReplay).mockResolvedValue(runResult)

    const timeTravel = await getTrackingTimeTravel(deps, {
      containerId: 'container-1',
      now: referenceNow,
    })

    expect(runTrackingReplay).toHaveBeenCalledTimes(1)
    expect(runTrackingReplay).toHaveBeenCalledWith(
      deps,
      expect.objectContaining({
        containerId: 'container-1',
        now: referenceNow,
        recordSteps: false,
      }),
    )
    expect(timeTravel.syncCount).toBe(1)
    expect(timeTravel.selectedSnapshotId).toBe('snapshot-1')
    expect(timeTravel.syncs[0]?.snapshotId).toBe('snapshot-1')
  })

  it('maps replay step limit errors to an explicit HTTP status', async () => {
    const error = new TrackingReplayStepLimitError('Tracking replay exceeded max steps (5000)')
    const response = mapErrorToResponse(error)

    expect(error).toBeInstanceOf(HttpError)
    expect(response.status).toBe(422)
    await expect(response.json()).resolves.toEqual({
      error: 'Tracking replay exceeded max steps (5000)',
    })
  })
})
