import { describe, expect, it, vi } from 'vitest'
import {
  createSyncProcessUseCase,
  type SyncProcessDeps,
} from '~/capabilities/sync/application/usecases/sync-process.usecase'
import { HttpError } from '~/shared/errors/httpErrors'

function toHttpErrorOrThrow(error: unknown): HttpError {
  if (error instanceof HttpError) return error
  throw new Error('Expected HttpError')
}

function createDeps(overrides: Partial<SyncProcessDeps> = {}): {
  readonly deps: SyncProcessDeps
  readonly getSyncRequestStatuses: ReturnType<typeof vi.fn>
  readonly resolveTargets: ReturnType<typeof vi.fn>
} {
  let now = 0
  const nowMs = () => now
  const sleep = vi.fn(async (delayMs: number) => {
    now += delayMs
  })

  const resolveTargets = vi.fn(async () => [
    {
      processId: 'process-1',
      containerNumber: 'MSCU1234567',
      provider: 'msc' as const,
    },
    {
      processId: 'process-1',
      containerNumber: 'MRKU7654321',
      provider: 'maersk' as const,
    },
  ])

  const getSyncRequestStatuses = vi.fn(async () => ({
    allTerminal: true,
    requests: [
      {
        syncRequestId: 'sync-1',
        status: 'DONE' as const,
        lastError: null,
        updatedAt: '2026-03-06T10:00:00.000Z',
        refValue: 'MSCU1234567',
      },
      {
        syncRequestId: 'sync-2',
        status: 'DONE' as const,
        lastError: null,
        updatedAt: '2026-03-06T10:00:00.000Z',
        refValue: 'MRKU7654321',
      },
    ],
  }))

  const deps: SyncProcessDeps = {
    targetResolverService: {
      resolveTargets,
    },
    enqueuePolicyService: {
      enqueue: vi.fn(async () => ({
        requestedTargets: 2,
        queuedTargets: 2,
        syncRequestIds: ['sync-1', 'sync-2'],
        requests: [
          {
            processId: 'process-1',
            containerNumber: 'MSCU1234567',
            syncRequestId: 'sync-1',
            deduped: false,
          },
          {
            processId: 'process-1',
            containerNumber: 'MRKU7654321',
            syncRequestId: 'sync-2',
            deduped: false,
          },
        ],
      })),
    },
    queuePort: {
      getSyncRequestStatuses,
    },
    sleep,
    nowMs,
    ...overrides,
  }

  return {
    deps,
    getSyncRequestStatuses,
    resolveTargets,
  }
}

describe('sync-process.usecase', () => {
  it('syncs containers from the requested process and returns synced container count', async () => {
    const { deps, resolveTargets } = createDeps()

    const execute = createSyncProcessUseCase(deps)
    const result = await execute({
      tenantId: 'tenant-a',
      scope: { kind: 'process', processId: 'process-abc' },
      mode: 'manual',
    })

    expect(result).toEqual({
      processId: 'process-abc',
      syncedContainers: 2,
    })
    expect(resolveTargets).toHaveBeenCalledWith({
      kind: 'process',
      processId: 'process-abc',
    })
  })

  it('fails with 404 when resolver cannot find process', async () => {
    const { deps } = createDeps({
      targetResolverService: {
        resolveTargets: vi.fn(async () => {
          throw new HttpError('process_not_found', 404)
        }),
      },
    })

    const execute = createSyncProcessUseCase(deps)

    let thrown: unknown = null
    try {
      await execute({
        tenantId: 'tenant-a',
        scope: { kind: 'process', processId: 'missing' },
        mode: 'manual',
      })
    } catch (error) {
      thrown = error
    }

    const httpError = toHttpErrorOrThrow(thrown)
    expect(httpError.status).toBe(404)
    expect(httpError.message).toBe('process_not_found')
  })

  it('fails with 504 when process sync requests do not reach terminal state before timeout', async () => {
    const getSyncRequestStatusesMock = vi.fn(async () => ({
      allTerminal: false,
      requests: [
        {
          syncRequestId: 'sync-1',
          status: 'PENDING' as const,
          lastError: null,
          updatedAt: '2026-03-06T10:00:00.000Z',
          refValue: 'MSCU1234567',
        },
      ],
    }))

    const { deps } = createDeps({
      queuePort: {
        getSyncRequestStatuses: getSyncRequestStatusesMock,
      },
      timeoutMs: 10_000,
      pollIntervalMs: 5_000,
    })

    const execute = createSyncProcessUseCase(deps)

    let thrown: unknown = null
    try {
      await execute({
        tenantId: 'tenant-a',
        scope: { kind: 'process', processId: 'process-1' },
        mode: 'manual',
      })
    } catch (error) {
      thrown = error
    }

    const httpError = toHttpErrorOrThrow(thrown)
    expect(httpError.status).toBe(504)
    expect(getSyncRequestStatusesMock).toHaveBeenCalledTimes(3)
  })

  it('fails with 502 when process sync reaches FAILED status', async () => {
    const { deps } = createDeps({
      queuePort: {
        getSyncRequestStatuses: vi.fn(async () => ({
          allTerminal: true,
          requests: [
            {
              syncRequestId: 'sync-1',
              status: 'FAILED' as const,
              lastError: 'provider_unavailable',
              updatedAt: '2026-03-06T10:00:00.000Z',
              refValue: 'MSCU1234567',
            },
          ],
        })),
      },
    })

    const execute = createSyncProcessUseCase(deps)

    let thrown: unknown = null
    try {
      await execute({
        tenantId: 'tenant-a',
        scope: { kind: 'process', processId: 'process-1' },
        mode: 'manual',
      })
    } catch (error) {
      thrown = error
    }

    const httpError = toHttpErrorOrThrow(thrown)
    expect(httpError.status).toBe(502)
    expect(httpError.message).toContain('provider_unavailable')
  })
})
