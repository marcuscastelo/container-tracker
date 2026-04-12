import { describe, expect, it, vi } from 'vitest'
import type { TrackingReplayAdminRepository } from '~/modules/tracking/features/replay/application/ports/tracking-replay-admin.repository'
import { getTrackingReplayRun } from '~/modules/tracking/features/replay/application/usecases/get-tracking-replay-run.usecase'

const VALID_RUN_ID = '11111111-1111-4111-8111-111111111111'

function buildRunView() {
  return {
    runId: VALID_RUN_ID,
    mode: 'DRY_RUN' as const,
    status: 'SUCCEEDED' as const,
    requestedBy: 'ops@container-tracker',
    reason: null,
    createdAt: '2026-04-12T10:00:00.000Z',
    startedAt: '2026-04-12T10:00:01.000Z',
    finishedAt: '2026-04-12T10:00:10.000Z',
    codeVersion: 'abc123',
    errorMessage: null,
    summary: {},
    target: null,
  }
}

function createReplayAdminRepository(command?: {
  readonly getRun?: TrackingReplayAdminRepository['getRun']
}): TrackingReplayAdminRepository {
  return {
    findTargetByContainerNumber: vi.fn(async () => null),
    findTargetByContainerId: vi.fn(async () => null),
    listSnapshotsForReplay: vi.fn(async () => []),
    createRun: vi.fn(async () => {
      throw new Error('not implemented in test')
    }),
    updateRun: vi.fn(async () => undefined),
    createRunTarget: vi.fn(async () => {
      throw new Error('not implemented in test')
    }),
    updateRunTarget: vi.fn(async () => undefined),
    findGenerationPointer: vi.fn(async () => null),
    createGeneration: vi.fn(async () => {
      throw new Error('not implemented in test')
    }),
    persistGenerationDerivations: vi.fn(async () => undefined),
    listObservationsByGeneration: vi.fn(async () => []),
    listAlertsByGeneration: vi.fn(async () => []),
    activateGenerationPointer: vi.fn(async () => {
      throw new Error('not implemented in test')
    }),
    rollbackGenerationPointer: vi.fn(async () => null),
    getRun: command?.getRun ?? vi.fn(async () => null),
  }
}

describe('getTrackingReplayRun', () => {
  it('returns 400 when runId is blank after trimming', async () => {
    const getRun = vi.fn(async () => null)
    const replayAdminRepository = createReplayAdminRepository({ getRun })

    await expect(
      getTrackingReplayRun(
        { replayAdminRepository },
        {
          runId: '   ',
        },
      ),
    ).rejects.toMatchObject({
      message: 'tracking_replay_run_id_required',
      status: 400,
    })
    expect(getRun).not.toHaveBeenCalled()
  })

  it('returns 400 when runId is not a UUID', async () => {
    const getRun = vi.fn(async () => null)
    const replayAdminRepository = createReplayAdminRepository({ getRun })

    await expect(
      getTrackingReplayRun(
        { replayAdminRepository },
        {
          runId: 'not-a-uuid',
        },
      ),
    ).rejects.toMatchObject({
      message: 'tracking_replay_run_id_invalid',
      status: 400,
    })
    expect(getRun).not.toHaveBeenCalled()
  })

  it('returns the replay run for a valid UUID', async () => {
    const run = buildRunView()
    const getRun = vi.fn(async () => run)
    const replayAdminRepository = createReplayAdminRepository({ getRun })

    await expect(
      getTrackingReplayRun(
        { replayAdminRepository },
        {
          runId: `  ${VALID_RUN_ID}  `,
        },
      ),
    ).resolves.toEqual(run)
    expect(getRun).toHaveBeenCalledWith(VALID_RUN_ID)
  })
})
