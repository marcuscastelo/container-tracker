import { describe, expect, it, vi } from 'vitest'
import {
  createSyncDashboardUseCase,
  type SyncDashboardDeps,
} from '~/capabilities/sync/application/usecases/sync-dashboard.usecase'
import { HttpError } from '~/shared/errors/httpErrors'

function toHttpErrorOrThrow(error: unknown): HttpError {
  if (error instanceof HttpError) return error
  throw new Error('Expected HttpError')
}

function createDeps(overrides: Partial<SyncDashboardDeps> = {}): {
  readonly deps: SyncDashboardDeps
  readonly getSyncRequestStatuses: ReturnType<typeof vi.fn>
  readonly resolveTargets: ReturnType<typeof vi.fn>
  readonly enqueue: ReturnType<typeof vi.fn>
} {
  let now = 0
  const nowMs = () => now
  const sleep = vi.fn(async (delayMs: number) => {
    now += delayMs
  })

  const resolveTargets = vi.fn(async () => [
    {
      processId: 'process-a',
      containerNumber: 'MSCU1234567',
      provider: 'msc' as const,
    },
    {
      processId: 'process-b',
      containerNumber: 'MRKU7654321',
      provider: 'maersk' as const,
    },
  ])

  const enqueue = vi.fn(async () => ({
    requestedTargets: 2,
    queuedTargets: 2,
    syncRequestIds: ['sync-1', 'sync-2'],
    requests: [
      {
        processId: 'process-a',
        containerNumber: 'MSCU1234567',
        syncRequestId: 'sync-1',
        deduped: false,
      },
      {
        processId: 'process-b',
        containerNumber: 'MRKU7654321',
        syncRequestId: 'sync-2',
        deduped: false,
      },
    ],
  }))

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

  const deps: SyncDashboardDeps = {
    targetResolverService: {
      resolveTargets,
    },
    enqueuePolicyService: {
      enqueue,
    },
    queuePort: {
      getSyncRequestStatuses,
    },
    nowMs,
    sleep,
    ...overrides,
  }

  return {
    deps,
    getSyncRequestStatuses,
    resolveTargets,
    enqueue,
  }
}

describe('sync-dashboard.usecase', () => {
  it('returns synced process and container counters when all sync requests finish as DONE', async () => {
    const { deps } = createDeps()

    const execute = createSyncDashboardUseCase(deps)
    const result = await execute({
      tenantId: 'tenant-a',
      scope: { kind: 'dashboard' },
      mode: 'manual',
    })

    expect(result).toEqual({
      syncedProcesses: 2,
      syncedContainers: 2,
    })
  })

  it('propagates unsupported carrier/provider errors from target resolver', async () => {
    const { deps, enqueue } = createDeps({
      targetResolverService: {
        resolveTargets: vi.fn(async () => {
          throw new HttpError('unsupported_sync_provider_for_container:MSCU1234567:one', 422)
        }),
      },
    })

    const execute = createSyncDashboardUseCase(deps)

    let thrown: unknown = null
    try {
      await execute({
        tenantId: 'tenant-a',
        scope: { kind: 'dashboard' },
        mode: 'manual',
      })
    } catch (error) {
      thrown = error
    }

    const httpError = toHttpErrorOrThrow(thrown)
    expect(httpError.status).toBe(422)
    expect(enqueue).toHaveBeenCalledTimes(0)
  })

  it('fails with 504 when sync requests do not reach terminal state before timeout', async () => {
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

    const execute = createSyncDashboardUseCase(deps)

    let thrown: unknown = null
    try {
      await execute({
        tenantId: 'tenant-a',
        scope: { kind: 'dashboard' },
        mode: 'manual',
      })
    } catch (error) {
      thrown = error
    }

    const httpError = toHttpErrorOrThrow(thrown)
    expect(httpError.status).toBe(504)
    expect(getSyncRequestStatusesMock).toHaveBeenCalledTimes(3)
  })

  it('fails with 502 when at least one sync request reaches FAILED status', async () => {
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

    const execute = createSyncDashboardUseCase(deps)

    let thrown: unknown = null
    try {
      await execute({
        tenantId: 'tenant-a',
        scope: { kind: 'dashboard' },
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
