import { describe, expect, it, vi } from 'vitest'
import {
  createRefreshProcessUseCase,
  type RefreshProcessDeps,
} from '~/capabilities/sync/application/usecases/refresh-process.usecase'
import { HttpError } from '~/shared/errors/httpErrors'

function toHttpErrorOrThrow(error: unknown): HttpError {
  if (error instanceof HttpError) return error
  throw new Error('Expected HttpError')
}

function createDeps(overrides: Partial<RefreshProcessDeps> = {}): {
  readonly deps: RefreshProcessDeps
  readonly enqueueContainerSyncRequest: ReturnType<typeof vi.fn>
} {
  const enqueueContainerSyncRequest = vi.fn(
    async (command: { readonly containerNumber: string }) => ({
      id: `sync-${command.containerNumber}`,
      status: 'PENDING' as const,
      isNew: true,
    }),
  )

  const deps: RefreshProcessDeps = {
    fetchProcessById: async () => ({ id: 'process-1' }),
    listContainersByProcessId: async () => ({
      containers: [
        { containerNumber: 'MSCU1234567', carrierCode: 'msc' },
        { containerNumber: 'MSCU7654321', carrierCode: 'one' },
      ],
    }),
    enqueueContainerSyncRequest,
    ...overrides,
  }

  return { deps, enqueueContainerSyncRequest }
}

describe('refresh-process.usecase', () => {
  it('enqueues supported containers, including ONE, and preserves dedupe metadata', async () => {
    const enqueue = vi
      .fn()
      .mockResolvedValueOnce({
        id: 'sync-1',
        status: 'PENDING',
        isNew: true,
      })
      .mockResolvedValueOnce({
        id: 'sync-2',
        status: 'PENDING',
        isNew: true,
      })
      .mockResolvedValueOnce({
        id: 'sync-1',
        status: 'PENDING',
        isNew: false,
      })

    const { deps } = createDeps({
      enqueueContainerSyncRequest: enqueue,
      listContainersByProcessId: async () => ({
        containers: [
          { containerNumber: 'MSCU1234567', carrierCode: 'msc' },
          { containerNumber: 'MSCU7654321', carrierCode: 'one' },
          { containerNumber: 'MSCU1111111', carrierCode: 'msc' },
        ],
      }),
    })

    const execute = createRefreshProcessUseCase(deps)
    const result = await execute({
      processId: 'process-1',
      mode: 'process',
    })

    expect(result).toEqual({
      processId: 'process-1',
      mode: 'process',
      requestedContainers: 3,
      queuedContainers: 3,
      syncRequestIds: ['sync-1', 'sync-2'],
      requests: [
        {
          containerNumber: 'MSCU1234567',
          syncRequestId: 'sync-1',
          deduped: false,
        },
        {
          containerNumber: 'MSCU7654321',
          syncRequestId: 'sync-2',
          deduped: false,
        },
        {
          containerNumber: 'MSCU1111111',
          syncRequestId: 'sync-1',
          deduped: true,
        },
      ],
      failures: [],
    })

    expect(enqueue).toHaveBeenCalledTimes(3)
  })

  it('returns 404 when the container does not belong to process in container mode', async () => {
    const { deps } = createDeps()
    const execute = createRefreshProcessUseCase(deps)

    let thrown: unknown = null
    try {
      await execute({
        processId: 'process-1',
        mode: 'container',
        containerNumber: 'MSCU9999999',
      })
    } catch (error) {
      thrown = error
    }

    const httpError = toHttpErrorOrThrow(thrown)
    expect(httpError.status).toBe(404)
    expect(httpError.message).toBe('container_not_found_in_process')
  })

  it('returns 404 when process does not exist', async () => {
    const { deps } = createDeps({
      fetchProcessById: async () => null,
    })
    const execute = createRefreshProcessUseCase(deps)

    let thrown: unknown = null
    try {
      await execute({
        processId: 'missing',
        mode: 'process',
      })
    } catch (error) {
      thrown = error
    }

    const httpError = toHttpErrorOrThrow(thrown)
    expect(httpError.status).toBe(404)
    expect(httpError.message).toBe('process_not_found')
  })
})
