import { describe, expect, it, vi } from 'vitest'
import {
  createSyncAllProcessesUseCase,
  type SyncAllProcessesDeps,
} from '~/modules/process/application/usecases/sync-all-processes.usecase'
import { HttpError } from '~/shared/errors/httpErrors'

function toHttpErrorOrThrow(error: unknown): HttpError {
  if (error instanceof HttpError) return error
  throw new Error('Expected HttpError')
}

function createDeps(overrides: Partial<SyncAllProcessesDeps> = {}): {
  readonly deps: SyncAllProcessesDeps
  readonly enqueueContainerSyncRequest: ReturnType<typeof vi.fn>
  readonly getSyncRequestStatuses: ReturnType<typeof vi.fn>
  readonly sleep: ReturnType<typeof vi.fn>
  readonly nowMs: () => number
} {
  let now = 0
  const nowMs = () => now
  const sleep = vi.fn(async (delayMs: number) => {
    now += delayMs
  })
  const enqueueContainerSyncRequest = vi.fn(
    async (command: { readonly containerNumber: string }) => ({
      id: `sync-${command.containerNumber}`,
      status: 'PENDING' as const,
      isNew: true,
    }),
  )
  const getSyncRequestStatuses = vi.fn(
    async (command: { readonly syncRequestIds: readonly string[] }) => ({
      allTerminal: true,
      requests: command.syncRequestIds.map((syncRequestId) => ({
        syncRequestId,
        status: 'DONE' as const,
        lastError: null,
        updatedAt: '2026-03-06T10:00:00.000Z',
        refValue: 'MSCU1234567',
      })),
    }),
  )

  const deps: SyncAllProcessesDeps = {
    listActiveProcessIds: async () => [],
    listContainersByProcessIds: async () => ({ containersByProcessId: new Map() }),
    enqueueContainerSyncRequest,
    getSyncRequestStatuses,
    nowMs,
    sleep,
    ...overrides,
  }

  return {
    deps,
    enqueueContainerSyncRequest,
    getSyncRequestStatuses,
    sleep,
    nowMs,
  }
}

describe('sync-all-processes.usecase', () => {
  it('returns synced process and container counters when all sync requests finish as DONE', async () => {
    const statusesByCall = [
      {
        allTerminal: false,
        requests: [
          {
            syncRequestId: 'sync-MSCU1234567',
            status: 'PENDING' as const,
            lastError: null,
            updatedAt: '2026-03-06T10:00:00.000Z',
            refValue: 'MSCU1234567',
          },
          {
            syncRequestId: 'sync-MRKU7654321',
            status: 'LEASED' as const,
            lastError: null,
            updatedAt: '2026-03-06T10:00:00.000Z',
            refValue: 'MRKU7654321',
          },
        ],
      },
      {
        allTerminal: true,
        requests: [
          {
            syncRequestId: 'sync-MSCU1234567',
            status: 'DONE' as const,
            lastError: null,
            updatedAt: '2026-03-06T10:01:00.000Z',
            refValue: 'MSCU1234567',
          },
          {
            syncRequestId: 'sync-MRKU7654321',
            status: 'DONE' as const,
            lastError: null,
            updatedAt: '2026-03-06T10:01:10.000Z',
            refValue: 'MRKU7654321',
          },
        ],
      },
    ]

    const getSyncRequestStatusesMock = vi.fn(
      async () => statusesByCall.shift() ?? statusesByCall[0],
    )

    const { deps } = createDeps({
      listActiveProcessIds: async () => ['process-a', 'process-b'],
      listContainersByProcessIds: async () => ({
        containersByProcessId: new Map([
          [
            'process-a',
            [
              {
                id: 'container-1',
                processId: 'process-a',
                containerNumber: 'mscu1234567',
                carrierCode: 'MSC',
              },
            ],
          ],
          [
            'process-b',
            [
              {
                id: 'container-2',
                processId: 'process-b',
                containerNumber: 'mrku7654321',
                carrierCode: 'maersk',
              },
            ],
          ],
        ]),
      }),
      getSyncRequestStatuses: getSyncRequestStatusesMock,
    })

    const execute = createSyncAllProcessesUseCase(deps)
    const result = await execute()

    expect(result).toEqual({
      syncedProcesses: 2,
      syncedContainers: 2,
    })
    expect(getSyncRequestStatusesMock).toHaveBeenCalledTimes(2)
  })

  it('fails with 422 when a container carrier is not supported for global sync', async () => {
    const { deps, enqueueContainerSyncRequest } = createDeps({
      listActiveProcessIds: async () => ['process-a'],
      listContainersByProcessIds: async () => ({
        containersByProcessId: new Map([
          [
            'process-a',
            [
              {
                id: 'container-1',
                processId: 'process-a',
                containerNumber: 'MSCU1234567',
                carrierCode: 'one',
              },
            ],
          ],
        ]),
      }),
    })

    const execute = createSyncAllProcessesUseCase(deps)

    let thrown: unknown = null
    try {
      await execute()
    } catch (error) {
      thrown = error
    }

    const httpError = toHttpErrorOrThrow(thrown)
    expect(httpError.status).toBe(422)
    expect(enqueueContainerSyncRequest).toHaveBeenCalledTimes(0)
  })

  it('fails with 504 when sync requests do not reach terminal state before timeout', async () => {
    const getSyncRequestStatusesMock = vi.fn(async () => ({
      allTerminal: false,
      requests: [
        {
          syncRequestId: 'sync-MSCU1234567',
          status: 'PENDING' as const,
          lastError: null,
          updatedAt: '2026-03-06T10:00:00.000Z',
          refValue: 'MSCU1234567',
        },
      ],
    }))

    const { deps } = createDeps({
      listActiveProcessIds: async () => ['process-a'],
      listContainersByProcessIds: async () => ({
        containersByProcessId: new Map([
          [
            'process-a',
            [
              {
                id: 'container-1',
                processId: 'process-a',
                containerNumber: 'MSCU1234567',
                carrierCode: 'msc',
              },
            ],
          ],
        ]),
      }),
      getSyncRequestStatuses: getSyncRequestStatusesMock,
      timeoutMs: 10_000,
      pollIntervalMs: 5_000,
    })

    const execute = createSyncAllProcessesUseCase(deps)

    let thrown: unknown = null
    try {
      await execute()
    } catch (error) {
      thrown = error
    }

    const httpError = toHttpErrorOrThrow(thrown)
    expect(httpError.status).toBe(504)
    expect(getSyncRequestStatusesMock).toHaveBeenCalledTimes(3)
  })

  it('fails with 502 when any sync request reaches FAILED or NOT_FOUND', async () => {
    const { deps } = createDeps({
      listActiveProcessIds: async () => ['process-a'],
      listContainersByProcessIds: async () => ({
        containersByProcessId: new Map([
          [
            'process-a',
            [
              {
                id: 'container-1',
                processId: 'process-a',
                containerNumber: 'MSCU1234567',
                carrierCode: 'msc',
              },
            ],
          ],
        ]),
      }),
      getSyncRequestStatuses: vi.fn(async () => ({
        allTerminal: true,
        requests: [
          {
            syncRequestId: 'sync-MSCU1234567',
            status: 'FAILED' as const,
            lastError: 'provider_unavailable',
            updatedAt: '2026-03-06T10:01:00.000Z',
            refValue: 'MSCU1234567',
          },
        ],
      })),
    })

    const execute = createSyncAllProcessesUseCase(deps)

    let thrown: unknown = null
    try {
      await execute()
    } catch (error) {
      thrown = error
    }

    const httpError = toHttpErrorOrThrow(thrown)
    expect(httpError.status).toBe(502)
    expect(httpError.message).toContain('provider_unavailable')
  })
})
