import { describe, expect, it, vi } from 'vitest'
import {
  createSyncProcessContainersUseCase,
  type SyncProcessContainersDeps,
} from '~/modules/process/application/usecases/sync-process-containers.usecase'
import { HttpError } from '~/shared/errors/httpErrors'

function toHttpErrorOrThrow(error: unknown): HttpError {
  if (error instanceof HttpError) return error
  throw new Error('Expected HttpError')
}

function createDeps(overrides: Partial<SyncProcessContainersDeps> = {}): {
  readonly deps: SyncProcessContainersDeps
  readonly enqueueContainerSyncRequest: ReturnType<typeof vi.fn>
  readonly getSyncRequestStatuses: ReturnType<typeof vi.fn>
} {
  let now = 0
  const sleep = vi.fn(async (delayMs: number) => {
    now += delayMs
  })
  const nowMs = () => now

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
      })),
    }),
  )

  const deps: SyncProcessContainersDeps = {
    fetchProcessById: async () => ({ id: 'process-1' }),
    listContainersByProcessId: async () => ({
      containers: [
        { containerNumber: 'MSCU1234567', carrierCode: 'msc' },
        { containerNumber: 'MRKU7654321', carrierCode: 'maersk' },
      ],
    }),
    enqueueContainerSyncRequest,
    getSyncRequestStatuses,
    sleep,
    nowMs,
    ...overrides,
  }

  return {
    deps,
    enqueueContainerSyncRequest,
    getSyncRequestStatuses,
  }
}

describe('sync-process-containers.usecase', () => {
  it('syncs only containers from the requested process and returns synced container count', async () => {
    const listContainersByProcessId = vi.fn(async () => ({
      containers: [
        { containerNumber: 'MSCU1234567', carrierCode: 'msc' },
        { containerNumber: 'MRKU7654321', carrierCode: 'maersk' },
      ],
    }))

    const { deps, enqueueContainerSyncRequest } = createDeps({
      fetchProcessById: async (command) => ({ id: command.processId }),
      listContainersByProcessId,
    })

    const execute = createSyncProcessContainersUseCase(deps)
    const result = await execute({ processId: 'process-abc' })

    expect(result).toEqual({
      processId: 'process-abc',
      syncedContainers: 2,
    })
    expect(listContainersByProcessId).toHaveBeenCalledWith({
      processId: 'process-abc',
    })
    expect(enqueueContainerSyncRequest).toHaveBeenCalledTimes(2)
    expect(enqueueContainerSyncRequest).toHaveBeenNthCalledWith(1, {
      provider: 'msc',
      containerNumber: 'MSCU1234567',
    })
    expect(enqueueContainerSyncRequest).toHaveBeenNthCalledWith(2, {
      provider: 'maersk',
      containerNumber: 'MRKU7654321',
    })
  })

  it('fails with 422 when process container provider is unsupported', async () => {
    const { deps, enqueueContainerSyncRequest } = createDeps({
      listContainersByProcessId: async () => ({
        containers: [{ containerNumber: 'ONEU1234567', carrierCode: 'one' }],
      }),
    })

    const execute = createSyncProcessContainersUseCase(deps)

    let thrown: unknown = null
    try {
      await execute({ processId: 'process-1' })
    } catch (error) {
      thrown = error
    }

    const httpError = toHttpErrorOrThrow(thrown)
    expect(httpError.status).toBe(422)
    expect(enqueueContainerSyncRequest).toHaveBeenCalledTimes(0)
  })

  it('fails with 504 when process sync requests do not reach terminal state before timeout', async () => {
    const getSyncRequestStatusesMock = vi.fn(async () => ({
      allTerminal: false,
      requests: [
        {
          syncRequestId: 'sync-MSCU1234567',
          status: 'PENDING' as const,
          lastError: null,
        },
      ],
    }))

    const { deps } = createDeps({
      listContainersByProcessId: async () => ({
        containers: [{ containerNumber: 'MSCU1234567', carrierCode: 'msc' }],
      }),
      getSyncRequestStatuses: getSyncRequestStatusesMock,
      timeoutMs: 10_000,
      pollIntervalMs: 5_000,
    })

    const execute = createSyncProcessContainersUseCase(deps)

    let thrown: unknown = null
    try {
      await execute({ processId: 'process-1' })
    } catch (error) {
      thrown = error
    }

    const httpError = toHttpErrorOrThrow(thrown)
    expect(httpError.status).toBe(504)
    expect(getSyncRequestStatusesMock).toHaveBeenCalledTimes(3)
  })

  it('fails with 502 when process sync reaches FAILED status', async () => {
    const { deps } = createDeps({
      getSyncRequestStatuses: vi.fn(async () => ({
        allTerminal: true,
        requests: [
          {
            syncRequestId: 'sync-MSCU1234567',
            status: 'FAILED' as const,
            lastError: 'provider_unavailable',
          },
        ],
      })),
      listContainersByProcessId: async () => ({
        containers: [{ containerNumber: 'MSCU1234567', carrierCode: 'msc' }],
      }),
    })

    const execute = createSyncProcessContainersUseCase(deps)

    let thrown: unknown = null
    try {
      await execute({ processId: 'process-1' })
    } catch (error) {
      thrown = error
    }

    const httpError = toHttpErrorOrThrow(thrown)
    expect(httpError.status).toBe(502)
    expect(httpError.message).toContain('provider_unavailable')
  })
})
