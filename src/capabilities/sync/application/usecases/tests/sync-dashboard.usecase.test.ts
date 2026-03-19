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
  readonly detectCarrier: ReturnType<typeof vi.fn>
  readonly recordDetectionRun: ReturnType<typeof vi.fn>
  readonly persistDetectedCarrier: ReturnType<typeof vi.fn>
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

  const enqueue = vi.fn(
    async (command: {
      readonly tenantId: string
      readonly mode: 'manual' | 'live' | 'backfill'
      readonly targets: readonly {
        readonly processId: string | null
        readonly containerNumber: string
      }[]
    }) => ({
      requestedTargets: command.targets.length,
      queuedTargets: command.targets.length,
      syncRequestIds: command.targets.map((_, index: number) => `sync-${index + 1}`),
      requests: command.targets.map((target, index: number) => ({
        processId: target.processId,
        containerNumber: target.containerNumber,
        syncRequestId: `sync-${index + 1}`,
        deduped: false,
      })),
    }),
  )

  const getSyncRequestStatuses = vi.fn(
    async (command: { readonly syncRequestIds: readonly string[] }) => ({
      allTerminal: true,
      requests: command.syncRequestIds.map((syncRequestId) => {
        const refValue = syncRequestId === 'sync-2' ? 'MRKU7654321' : 'MSCU1234567'
        return {
          syncRequestId,
          status: 'DONE' as const,
          lastError: null,
          updatedAt: '2026-03-06T10:00:00.000Z',
          refValue,
        }
      }),
    }),
  )
  const detectCarrier = vi.fn(async () => ({
    detected: true as const,
    provider: 'msc' as const,
    attemptedProviders: ['msc'] as const,
    reason: 'found' as const,
    error: null,
  }))
  const recordDetectionRun = vi.fn(async () => ({
    runId: 'run-1',
    won: true,
  }))
  const persistDetectedCarrier = vi.fn(async () => undefined)

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
    carrierDetectionEngine: {
      detectCarrier,
    },
    carrierDetectionWritePort: {
      recordDetectionRun,
      persistDetectedCarrier,
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
    detectCarrier,
    recordDetectionRun,
    persistDetectedCarrier,
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

  it('detects the carrier for not-found-like failures and retries the dashboard sync', async () => {
    const detectCarrier = vi.fn(async () => ({
      detected: true as const,
      provider: 'cmacgm' as const,
      attemptedProviders: ['maersk', 'cmacgm'] as const,
      reason: 'found' as const,
      error: null,
    }))

    const { deps, getSyncRequestStatuses, enqueue, persistDetectedCarrier } = createDeps({
      carrierDetectionEngine: {
        detectCarrier,
      },
    })

    getSyncRequestStatuses
      .mockResolvedValueOnce({
        allTerminal: true,
        requests: [
          {
            syncRequestId: 'sync-1',
            status: 'FAILED',
            lastError: 'No container found for msc:MSCU1234567',
            updatedAt: '2026-03-06T10:00:00.000Z',
            refValue: 'MSCU1234567',
          },
          {
            syncRequestId: 'sync-2',
            status: 'DONE',
            lastError: null,
            updatedAt: '2026-03-06T10:00:00.000Z',
            refValue: 'MRKU7654321',
          },
        ],
      })
      .mockResolvedValueOnce({
        allTerminal: true,
        requests: [
          {
            syncRequestId: 'sync-1',
            status: 'DONE',
            lastError: null,
            updatedAt: '2026-03-06T10:01:00.000Z',
            refValue: 'MSCU1234567',
          },
        ],
      })

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
    expect(detectCarrier).toHaveBeenCalledWith({
      tenantId: 'tenant-a',
      containerNumber: 'MSCU1234567',
      excludeProviders: ['msc'],
    })
    expect(persistDetectedCarrier).toHaveBeenCalledWith(
      expect.objectContaining({
        processId: 'process-a',
        containerNumber: 'MSCU1234567',
        carrierCode: 'cmacgm',
      }),
    )
    expect(enqueue).toHaveBeenCalledTimes(2)
  })

  it('fails with 502 when detection cannot resolve a not-found-like dashboard failure', async () => {
    const detectCarrier = vi.fn(async () => ({
      detected: false as const,
      provider: null,
      attemptedProviders: ['maersk', 'cmacgm'] as const,
      reason: 'not_found' as const,
      error: 'carrier_detection_not_found',
    }))

    const { deps, getSyncRequestStatuses } = createDeps({
      carrierDetectionEngine: {
        detectCarrier,
      },
    })

    getSyncRequestStatuses.mockResolvedValueOnce({
      allTerminal: true,
      requests: [
        {
          syncRequestId: 'sync-1',
          status: 'FAILED',
          lastError: 'No container found for msc:MSCU1234567',
          updatedAt: '2026-03-06T10:00:00.000Z',
          refValue: 'MSCU1234567',
        },
      ],
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
    expect(httpError.message).toContain('carrier_detection_not_found')
    expect(detectCarrier).toHaveBeenCalledTimes(1)
  })

  it('records detection attempts but skips persist when run claim is not won', async () => {
    const persistDetectedCarrier = vi.fn(async () => undefined)
    const recordDetectionRun = vi.fn(async () => ({
      runId: 'run-1',
      won: false,
    }))
    const { deps, getSyncRequestStatuses } = createDeps({
      carrierDetectionWritePort: {
        recordDetectionRun,
        persistDetectedCarrier,
      },
    })

    getSyncRequestStatuses
      .mockResolvedValueOnce({
        allTerminal: true,
        requests: [
          {
            syncRequestId: 'sync-1',
            status: 'FAILED',
            lastError: 'No container found for msc:MSCU1234567',
            updatedAt: '2026-03-06T10:00:00.000Z',
            refValue: 'MSCU1234567',
          },
          {
            syncRequestId: 'sync-2',
            status: 'DONE',
            lastError: null,
            updatedAt: '2026-03-06T10:00:00.000Z',
            refValue: 'MRKU7654321',
          },
        ],
      })
      .mockResolvedValueOnce({
        allTerminal: true,
        requests: [
          {
            syncRequestId: 'sync-1',
            status: 'DONE',
            lastError: null,
            updatedAt: '2026-03-06T10:01:00.000Z',
            refValue: 'MSCU1234567',
          },
        ],
      })

    const execute = createSyncDashboardUseCase(deps)
    const result = await execute({
      tenantId: 'tenant-a',
      scope: { kind: 'dashboard' },
      mode: 'manual',
    })

    expect(result.syncedContainers).toBe(2)
    expect(recordDetectionRun).toHaveBeenCalledTimes(1)
    expect(persistDetectedCarrier).not.toHaveBeenCalled()
  })
})
