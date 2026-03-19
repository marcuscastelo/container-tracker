import { describe, expect, it, vi } from 'vitest'
import type { ResolvedSyncTarget } from '~/capabilities/sync/application/services/sync-target-resolver.service'
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
  readonly persistDetectedCarrier: ReturnType<typeof vi.fn>
  readonly recordDetectionRun: ReturnType<typeof vi.fn>
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
      {
        syncRequestId: 'sync-2',
        status: 'DONE' as const,
        lastError: null,
        updatedAt: '2026-03-06T10:00:00.000Z',
        refValue: 'MRKU7654321',
      },
    ],
  }))
  const persistDetectedCarrier = vi.fn(async () => undefined)
  const recordDetectionRun = vi.fn(async () => ({
    runId: 'run-1',
    won: true,
  }))

  const deps: SyncProcessDeps = {
    targetReadPort: {
      fetchProcessById: vi.fn(async () => ({ id: 'process-1' })),
      listContainersByProcessId: vi.fn(async () => ({
        containers: [
          {
            processId: 'process-1',
            containerNumber: 'MSCU1234567',
            carrierCode: 'msc',
          },
          {
            processId: 'process-1',
            containerNumber: 'MRKU7654321',
            carrierCode: 'maersk',
          },
        ],
      })),
    },
    enqueuePolicyService: {
      enqueue: vi.fn(async (command) => ({
        requestedTargets: command.targets.length,
        queuedTargets: command.targets.length,
        syncRequestIds: command.targets.map(
          (_target: ResolvedSyncTarget, index: number) => `sync-${index + 1}`,
        ),
        requests: command.targets.map((target: ResolvedSyncTarget, index: number) => ({
          processId: target.processId,
          containerNumber: target.containerNumber,
          syncRequestId: `sync-${index + 1}`,
          deduped: false,
        })),
      })),
    },
    queuePort: {
      getSyncRequestStatuses,
    },
    carrierDetectionEngine: {
      detectCarrier: vi.fn(async () => ({
        detected: true as const,
        provider: 'msc' as const,
        attemptedProviders: ['msc'] as const,
        reason: 'found' as const,
        error: null,
      })),
    },
    carrierDetectionWritePort: {
      recordDetectionRun,
      persistDetectedCarrier,
    },
    sleep,
    nowMs,
    ...overrides,
  }

  return {
    deps,
    getSyncRequestStatuses,
    persistDetectedCarrier,
    recordDetectionRun,
  }
}

describe('sync-process.usecase', () => {
  it('syncs containers from the requested process and returns synced container count', async () => {
    const { deps } = createDeps()

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
  })

  it('fails with 404 when process cannot be found', async () => {
    const { deps } = createDeps({
      targetReadPort: {
        fetchProcessById: vi.fn(async () => null),
        listContainersByProcessId: vi.fn(async () => ({ containers: [] })),
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

  it('detects unsupported carriers, persists the detected carrier, and retries sync', async () => {
    const { deps, getSyncRequestStatuses, persistDetectedCarrier } = createDeps({
      targetReadPort: {
        fetchProcessById: vi.fn(async () => ({ id: 'process-1' })),
        listContainersByProcessId: vi.fn(async () => ({
          containers: [
            {
              processId: 'process-1',
              containerNumber: 'MSCU1234567',
              carrierCode: 'msc',
            },
            {
              processId: 'process-1',
              containerNumber: 'MRKU7654321',
              carrierCode: null,
            },
          ],
        })),
      },
      carrierDetectionEngine: {
        detectCarrier: vi.fn(async () => ({
          detected: true as const,
          provider: 'maersk' as const,
          attemptedProviders: ['maersk'] as const,
          reason: 'found' as const,
          error: null,
        })),
      },
    })

    getSyncRequestStatuses
      .mockResolvedValueOnce({
        allTerminal: true,
        requests: [
          {
            syncRequestId: 'sync-1',
            status: 'DONE',
            lastError: null,
            updatedAt: '2026-03-06T10:00:00.000Z',
            refValue: 'MSCU1234567',
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
            refValue: 'MRKU7654321',
          },
        ],
      })

    const execute = createSyncProcessUseCase(deps)
    const result = await execute({
      tenantId: 'tenant-a',
      scope: { kind: 'process', processId: 'process-1' },
      mode: 'manual',
    })

    expect(result).toEqual({
      processId: 'process-1',
      syncedContainers: 2,
    })
    expect(persistDetectedCarrier).toHaveBeenCalledWith(
      expect.objectContaining({
        processId: 'process-1',
        containerNumber: 'MRKU7654321',
        carrierCode: 'maersk',
      }),
    )
  })

  it('recovers from wrong carrier by detecting after a not-found-like failure', async () => {
    const { deps, getSyncRequestStatuses, persistDetectedCarrier } = createDeps({
      targetReadPort: {
        fetchProcessById: vi.fn(async () => ({ id: 'process-1' })),
        listContainersByProcessId: vi.fn(async () => ({
          containers: [
            {
              processId: 'process-1',
              containerNumber: 'MSCU1234567',
              carrierCode: 'maersk',
            },
          ],
        })),
      },
      carrierDetectionEngine: {
        detectCarrier: vi.fn(async () => ({
          detected: true as const,
          provider: 'msc' as const,
          attemptedProviders: ['msc'] as const,
          reason: 'found' as const,
          error: null,
        })),
      },
    })

    getSyncRequestStatuses
      .mockResolvedValueOnce({
        allTerminal: true,
        requests: [
          {
            syncRequestId: 'sync-1',
            status: 'FAILED',
            lastError: 'No container found for maersk:MSCU1234567',
            updatedAt: '2026-03-06T10:00:00.000Z',
            refValue: 'MSCU1234567',
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

    const execute = createSyncProcessUseCase(deps)
    const result = await execute({
      tenantId: 'tenant-a',
      scope: { kind: 'process', processId: 'process-1' },
      mode: 'manual',
    })

    expect(result.syncedContainers).toBe(1)
    expect(persistDetectedCarrier).toHaveBeenCalledWith(
      expect.objectContaining({
        processId: 'process-1',
        containerNumber: 'MSCU1234567',
        carrierCode: 'msc',
      }),
    )
  })

  it('records detection but skips persisted promotion when run claim is not won', async () => {
    const persistDetectedCarrier = vi.fn(async () => undefined)
    const recordDetectionRun = vi.fn(async () => ({
      runId: 'run-1',
      won: false,
    }))
    const { deps, getSyncRequestStatuses } = createDeps({
      targetReadPort: {
        fetchProcessById: vi.fn(async () => ({ id: 'process-1' })),
        listContainersByProcessId: vi.fn(async () => ({
          containers: [
            {
              id: 'container-1',
              processId: 'process-1',
              containerNumber: 'MSCU1234567',
              carrierCode: null,
            },
          ],
        })),
      },
      carrierDetectionWritePort: {
        recordDetectionRun,
        persistDetectedCarrier,
      },
    })

    getSyncRequestStatuses.mockResolvedValueOnce({
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

    const execute = createSyncProcessUseCase(deps)
    const result = await execute({
      tenantId: 'tenant-a',
      scope: { kind: 'process', processId: 'process-1' },
      mode: 'manual',
    })

    expect(result.syncedContainers).toBe(1)
    expect(recordDetectionRun).toHaveBeenCalledTimes(1)
    expect(persistDetectedCarrier).not.toHaveBeenCalled()
  })

  it('fails with 502 when process sync reaches a non-detectable FAILED status', async () => {
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
