import { describe, expect, it, vi } from 'vitest'
import {
  createGetSyncStatusUseCase,
  type GetSyncStatusDeps,
} from '~/capabilities/sync/application/usecases/get-sync-status.usecase'

type ProcessCandidates = Awaited<
  ReturnType<GetSyncStatusDeps['statusReadPort']['listProcessSyncCandidates']>
>

function createDeps(command: {
  readonly candidates: ProcessCandidates
  readonly containersByProcessId: ReadonlyMap<
    string,
    readonly { readonly containerNumber: string }[]
  >
  readonly syncRequests: readonly {
    readonly containerNumber: string
    readonly status: 'PENDING' | 'LEASED' | 'DONE' | 'FAILED'
    readonly createdAt: string
    readonly updatedAt: string
  }[]
  readonly now?: Date
}): GetSyncStatusDeps {
  return {
    statusReadPort: {
      listProcessSyncCandidates: vi.fn(async () => command.candidates),
      listContainersByProcessIds: vi.fn(async () => ({
        containersByProcessId: command.containersByProcessId,
      })),
      listSyncRequestsByContainerNumbers: vi.fn(async () => command.syncRequests),
    },
    nowFactory: () => command.now ?? new Date('2026-03-06T15:00:00.000Z'),
  }
}

describe('get-sync-status.usecase', () => {
  it('derives syncing state with active and archived_in_flight visibility', async () => {
    const deps = createDeps({
      candidates: [
        { processId: 'process-active', archivedAt: null },
        { processId: 'process-archived', archivedAt: '2026-03-06T09:00:00.000Z' },
      ],
      containersByProcessId: new Map([
        [
          'process-active',
          [{ containerNumber: 'MSCU1234567' }, { containerNumber: 'MSCU7654321' }],
        ],
        ['process-archived', [{ containerNumber: 'MRKU0000001' }]],
      ]),
      syncRequests: [
        {
          containerNumber: 'MSCU1234567',
          status: 'DONE',
          createdAt: '2026-03-06T10:00:00.000Z',
          updatedAt: '2026-03-06T10:20:00.000Z',
        },
        {
          containerNumber: 'MSCU7654321',
          status: 'PENDING',
          createdAt: '2026-03-06T10:30:00.000Z',
          updatedAt: '2026-03-06T10:35:00.000Z',
        },
        {
          containerNumber: 'MRKU0000001',
          status: 'LEASED',
          createdAt: '2026-03-06T11:00:00.000Z',
          updatedAt: '2026-03-06T11:05:00.000Z',
        },
      ],
      now: new Date('2026-03-06T12:00:00.000Z'),
    })

    const execute = createGetSyncStatusUseCase(deps)
    const result = await execute()

    expect(result.generatedAt).toBe('2026-03-06T12:00:00.000Z')
    expect(result.processes).toEqual([
      {
        processId: 'process-active',
        syncStatus: 'syncing',
        startedAt: '2026-03-06T10:00:00.000Z',
        finishedAt: null,
        containerCount: 2,
        completedContainers: 1,
        failedContainers: 0,
        visibility: 'active',
      },
      {
        processId: 'process-archived',
        syncStatus: 'syncing',
        startedAt: '2026-03-06T11:00:00.000Z',
        finishedAt: null,
        containerCount: 1,
        completedContainers: 0,
        failedContainers: 0,
        visibility: 'archived_in_flight',
      },
    ])
  })

  it('excludes archived processes after sync reaches terminal state', async () => {
    const deps = createDeps({
      candidates: [{ processId: 'process-archived', archivedAt: '2026-03-06T09:00:00.000Z' }],
      containersByProcessId: new Map([['process-archived', [{ containerNumber: 'MSCU1234567' }]]]),
      syncRequests: [
        {
          containerNumber: 'MSCU1234567',
          status: 'DONE',
          createdAt: '2026-03-06T10:00:00.000Z',
          updatedAt: '2026-03-06T10:20:00.000Z',
        },
      ],
    })

    const execute = createGetSyncStatusUseCase(deps)
    const result = await execute()

    expect(result.processes).toEqual([])
  })

  it('derives completed and failed states when no open sync request exists', async () => {
    const deps = createDeps({
      candidates: [{ processId: 'process-1', archivedAt: null }],
      containersByProcessId: new Map([
        ['process-1', [{ containerNumber: 'MSCU1234567' }, { containerNumber: 'MSCU7654321' }]],
      ]),
      syncRequests: [
        {
          containerNumber: 'MSCU1234567',
          status: 'DONE',
          createdAt: '2026-03-06T10:00:00.000Z',
          updatedAt: '2026-03-06T10:20:00.000Z',
        },
        {
          containerNumber: 'MSCU7654321',
          status: 'FAILED',
          createdAt: '2026-03-06T10:30:00.000Z',
          updatedAt: '2026-03-06T10:45:00.000Z',
        },
      ],
    })

    const execute = createGetSyncStatusUseCase(deps)
    const result = await execute()

    expect(result.processes).toEqual([
      {
        processId: 'process-1',
        syncStatus: 'failed',
        startedAt: '2026-03-06T10:00:00.000Z',
        finishedAt: '2026-03-06T10:45:00.000Z',
        containerCount: 2,
        completedContainers: 1,
        failedContainers: 1,
        visibility: 'active',
      },
    ])
  })

  it('forwards scoped process ids to candidate selection', async () => {
    const deps = createDeps({
      candidates: [{ processId: 'process-1', archivedAt: null }],
      containersByProcessId: new Map([['process-1', [{ containerNumber: 'MSCU1234567' }]]]),
      syncRequests: [],
    })

    const execute = createGetSyncStatusUseCase(deps)

    await execute({
      processIds: ['process-1', 'process-2'],
    })

    expect(deps.statusReadPort.listProcessSyncCandidates).toHaveBeenCalledWith({
      processIds: ['process-1', 'process-2'],
    })
  })
})
