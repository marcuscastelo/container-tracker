import { describe, expect, it, vi } from 'vitest'
import {
  createSyncContainerUseCase,
  type SyncContainerDeps,
} from '~/capabilities/sync/application/usecases/sync-container.usecase'
import { HttpError } from '~/shared/errors/httpErrors'

function toHttpErrorOrThrow(error: unknown): HttpError {
  if (error instanceof HttpError) return error
  throw new Error('Expected HttpError')
}

function createDeps(overrides: Partial<SyncContainerDeps> = {}): {
  readonly deps: SyncContainerDeps
  readonly getSyncRequestStatuses: ReturnType<typeof vi.fn>
} {
  let now = 0
  const nowMs = () => now
  const sleep = vi.fn(async (delayMs: number) => {
    now += delayMs
  })

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
    ],
  }))

  const deps: SyncContainerDeps = {
    targetResolverService: {
      resolveTargets: vi.fn(async () => [
        {
          processId: 'process-1',
          containerNumber: 'MSCU1234567',
          provider: 'msc' as const,
        },
      ]),
    },
    enqueuePolicyService: {
      enqueue: vi.fn(async () => ({
        requestedTargets: 1,
        queuedTargets: 1,
        syncRequestIds: ['sync-1'],
        requests: [
          {
            processId: 'process-1',
            containerNumber: 'MSCU1234567',
            syncRequestId: 'sync-1',
            deduped: false,
          },
        ],
      })),
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
  }
}

describe('sync-container.usecase', () => {
  it('syncs one container and returns counters', async () => {
    const { deps } = createDeps()

    const execute = createSyncContainerUseCase(deps)
    const result = await execute({
      tenantId: 'tenant-a',
      scope: { kind: 'container', containerNumber: 'MSCU1234567' },
      mode: 'manual',
    })

    expect(result).toEqual({
      containerNumber: 'MSCU1234567',
      syncedContainers: 1,
    })
  })

  it('fails with 404 when target resolver returns no container target', async () => {
    const { deps } = createDeps({
      targetResolverService: {
        resolveTargets: vi.fn(async () => []),
      },
    })

    const execute = createSyncContainerUseCase(deps)

    let thrown: unknown = null
    try {
      await execute({
        tenantId: 'tenant-a',
        scope: { kind: 'container', containerNumber: 'MISSING123' },
        mode: 'manual',
      })
    } catch (error) {
      thrown = error
    }

    const httpError = toHttpErrorOrThrow(thrown)
    expect(httpError.status).toBe(404)
    expect(httpError.message).toBe('container_not_found')
  })

  it('fails with 502 when request reaches FAILED terminal status', async () => {
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

    const execute = createSyncContainerUseCase(deps)

    let thrown: unknown = null
    try {
      await execute({
        tenantId: 'tenant-a',
        scope: { kind: 'container', containerNumber: 'MSCU1234567' },
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
