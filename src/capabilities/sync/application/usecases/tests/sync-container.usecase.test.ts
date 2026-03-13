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
  readonly persistDetectedCarrier: ReturnType<typeof vi.fn>
} {
  let now = 0
  const nowMs = () => now
  const sleep = vi.fn(async (delayMs: number) => {
    now += delayMs
  })

  const getSyncRequestStatuses = vi.fn(async () => [
    {
      syncRequestId: 'sync-1',
      status: 'DONE' as const,
      lastError: null,
      updatedAt: '2026-03-06T10:00:00.000Z',
      refValue: 'MSCU1234567',
    },
  ])
  const getSyncRequestStatusesPort = vi.fn(async () => ({
    allTerminal: true,
    requests: await getSyncRequestStatuses(),
  }))
  const persistDetectedCarrier = vi.fn(async () => undefined)

  const deps: SyncContainerDeps = {
    targetReadPort: {
      findContainersByNumber: vi.fn(async () => ({
        containers: [
          {
            processId: 'process-1',
            containerNumber: 'MSCU1234567',
            carrierCode: 'msc',
          },
        ],
      })),
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
      getSyncRequestStatuses: getSyncRequestStatusesPort,
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
      persistDetectedCarrier,
    },
    nowMs,
    sleep,
    ...overrides,
  }

  return {
    deps,
    getSyncRequestStatuses: getSyncRequestStatusesPort,
    persistDetectedCarrier,
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

  it('fails with 404 when container cannot be found', async () => {
    const { deps } = createDeps({
      targetReadPort: {
        findContainersByNumber: vi.fn(async () => ({
          containers: [],
        })),
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

  it('detects the carrier when the stored carrier is unsupported and retries sync', async () => {
    const { deps, persistDetectedCarrier } = createDeps({
      targetReadPort: {
        findContainersByNumber: vi.fn(async () => ({
          containers: [
            {
              processId: 'process-1',
              containerNumber: 'MSCU1234567',
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
    expect(persistDetectedCarrier).toHaveBeenCalledWith({
      processId: 'process-1',
      containerNumber: 'MSCU1234567',
      carrierCode: 'maersk',
    })
  })

  it('retries with a detected carrier after a not-found-like failure', async () => {
    const { deps, getSyncRequestStatuses, persistDetectedCarrier } = createDeps({
      targetReadPort: {
        findContainersByNumber: vi.fn(async () => ({
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

    const execute = createSyncContainerUseCase(deps)
    const result = await execute({
      tenantId: 'tenant-a',
      scope: { kind: 'container', containerNumber: 'MSCU1234567' },
      mode: 'manual',
    })

    expect(result.syncedContainers).toBe(1)
    expect(persistDetectedCarrier).toHaveBeenCalledWith({
      processId: 'process-1',
      containerNumber: 'MSCU1234567',
      carrierCode: 'msc',
    })
  })

  it('fails with 502 when request reaches a non-detectable FAILED terminal status', async () => {
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
