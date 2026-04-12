import { describe, expect, it, vi } from 'vitest'
import type { SyncMode } from '~/capabilities/sync/application/commands/enqueue-sync.command'
import type { SyncDashboardEnqueueService } from '~/capabilities/sync/application/services/sync-dashboard-enqueue.service'
import type { DashboardSyncEligibleTarget } from '~/capabilities/sync/application/services/sync-dashboard-targets.service'
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

  const resolveTargets = vi.fn(async () => ({
    requestedProcesses: 2,
    requestedContainers: 2,
    eligibleTargets: [
      {
        processId: 'process-a',
        processReference: 'REF-A',
        containerNumber: 'MSCU1234567',
        provider: 'msc' as const,
      },
      {
        processId: 'process-b',
        processReference: 'REF-B',
        containerNumber: 'MRKU7654321',
        provider: 'maersk' as const,
      },
    ],
    skippedTargets: [],
  }))

  const enqueueImpl: SyncDashboardEnqueueService['enqueue'] = async (command: {
    readonly tenantId: string
    readonly mode: SyncMode
    readonly targets: readonly DashboardSyncEligibleTarget[]
  }) => {
      if (command.targets.length === 0) {
        return {
          enqueuedTargets: [],
          skippedTargets: [],
          failedTargets: [],
          newSyncRequestIds: [],
        }
      }

      return {
        enqueuedTargets: [
          {
            processId: 'process-a',
            processReference: 'REF-A',
            containerNumber: 'MSCU1234567',
            provider: 'msc' as const,
            syncRequestId: 'sync-1',
          },
          {
            processId: 'process-b',
            processReference: 'REF-B',
            containerNumber: 'MRKU7654321',
            provider: 'maersk' as const,
            syncRequestId: 'sync-2',
          },
        ],
        skippedTargets: [],
        failedTargets: [],
        newSyncRequestIds: ['sync-1', 'sync-2'],
      }
    }

  const enqueue = vi.fn(enqueueImpl)

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
    dashboardTargetsService: {
      resolveTargets,
    },
    dashboardEnqueueService: {
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
  it('returns structured summary and targets when all new sync requests finish as DONE', async () => {
    const { deps } = createDeps()

    const execute = createSyncDashboardUseCase(deps)
    const result = await execute({
      tenantId: 'tenant-a',
      scope: { kind: 'dashboard' },
      mode: 'manual',
    })

    expect(result).toEqual({
      summary: {
        requestedProcesses: 2,
        requestedContainers: 2,
        enqueued: 2,
        skipped: 0,
        failed: 0,
      },
      enqueuedTargets: [
        {
          processId: 'process-a',
          processReference: 'REF-A',
          containerNumber: 'MSCU1234567',
          provider: 'msc',
          syncRequestId: 'sync-1',
        },
        {
          processId: 'process-b',
          processReference: 'REF-B',
          containerNumber: 'MRKU7654321',
          provider: 'maersk',
          syncRequestId: 'sync-2',
        },
      ],
      skippedTargets: [],
      failedTargets: [],
    })
  })

  it('returns skipped-only results for unsupported providers instead of throwing', async () => {
    const { deps, enqueue } = createDeps({
      dashboardTargetsService: {
        resolveTargets: vi.fn(async () => ({
          requestedProcesses: 1,
          requestedContainers: 1,
          eligibleTargets: [],
          skippedTargets: [
            {
              processId: 'process-a',
              processReference: 'REF-A',
              containerNumber: 'MSCU1234567',
              provider: 'hapag',
              reasonCode: 'UNSUPPORTED_PROVIDER' as const,
              reasonMessage: 'Provider is not supported for dashboard manual sync.',
            },
          ],
        })),
      },
    })

    const execute = createSyncDashboardUseCase(deps)
    const result = await execute({
      tenantId: 'tenant-a',
      scope: { kind: 'dashboard' },
      mode: 'manual',
    })

    expect(result.summary).toEqual({
      requestedProcesses: 1,
      requestedContainers: 1,
      enqueued: 0,
      skipped: 1,
      failed: 0,
    })
    expect(result.skippedTargets[0]?.reasonCode).toBe('UNSUPPORTED_PROVIDER')
    expect(enqueue).toHaveBeenCalledTimes(1)
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

  it('reclassifies terminal queue failures as failed targets while keeping the batch response', async () => {
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
            {
              syncRequestId: 'sync-2',
              status: 'DONE' as const,
              lastError: null,
              updatedAt: '2026-03-06T10:00:00.000Z',
              refValue: 'MRKU7654321',
            },
          ],
        })),
      },
    })

    const execute = createSyncDashboardUseCase(deps)
    const result = await execute({
      tenantId: 'tenant-a',
      scope: { kind: 'dashboard' },
      mode: 'manual',
    })

    expect(result).toEqual({
      summary: {
        requestedProcesses: 2,
        requestedContainers: 2,
        enqueued: 1,
        skipped: 0,
        failed: 1,
      },
      enqueuedTargets: [
        {
          processId: 'process-b',
          processReference: 'REF-B',
          containerNumber: 'MRKU7654321',
          provider: 'maersk',
          syncRequestId: 'sync-2',
        },
      ],
      skippedTargets: [],
      failedTargets: [
        {
          processId: 'process-a',
          processReference: 'REF-A',
          containerNumber: 'MSCU1234567',
          provider: 'msc',
          reasonCode: 'ENQUEUE_FAILED',
          reasonMessage: 'Dashboard sync request failed after enqueue.',
        },
      ],
    })
  })
})
