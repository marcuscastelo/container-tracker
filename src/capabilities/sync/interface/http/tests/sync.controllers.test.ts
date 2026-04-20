import { describe, expect, it, vi } from 'vitest'
import type { EnqueueSyncCommand } from '~/capabilities/sync/application/commands/enqueue-sync.command'
import { createSyncControllers } from '~/capabilities/sync/interface/http/sync.controllers'
import { SyncContainerResponseSchema } from '~/capabilities/sync/interface/http/sync.schemas'
import {
  ProcessRefreshResponseSchema,
  SyncAllProcessesBusinessErrorResponseSchema,
  SyncAllProcessesSuccessResponseSchema,
  SyncProcessResponseSchema,
} from '~/shared/api-schemas/processes.schemas'

function createControllers() {
  const syncDashboard = vi.fn(async () => ({
    summary: {
      requestedProcesses: 3,
      requestedContainers: 8,
      enqueued: 8,
      skipped: 0,
      failed: 0,
    },
    enqueuedTargets: Array.from({ length: 8 }, (_, index) => ({
      processId: `process-${index + 1}`,
      processReference: `REF-${index + 1}`,
      containerNumber: `MSCU123456${index}`,
      provider: 'msc' as const,
      syncRequestId: `sync-${index + 1}`,
    })),
    skippedTargets: [],
    failedTargets: [],
  }))
  const syncProcess = vi.fn(async (command: EnqueueSyncCommand) => {
    if (command.scope.kind !== 'process') {
      throw new Error('invalid scope')
    }

    return {
      processId: command.scope.processId,
      syncedContainers: 2,
    }
  })
  const syncContainer = vi.fn(async (command: EnqueueSyncCommand) => {
    if (command.scope.kind !== 'container') {
      throw new Error('invalid scope')
    }

    return {
      containerNumber: command.scope.containerNumber,
      syncedContainers: 1,
    }
  })
  const refreshProcess = vi.fn(
    async (command: { readonly processId: string; readonly mode: 'process' | 'container' }) => ({
      processId: command.processId,
      mode: command.mode,
      requestedContainers: 2,
      queuedContainers: 1,
      syncRequestIds: ['ac8c52bf-0e1d-49db-9441-5586f86f0e31'],
      requests: [
        {
          containerNumber: 'MSCU1234567',
          syncRequestId: 'ac8c52bf-0e1d-49db-9441-5586f86f0e31',
          deduped: false,
        },
      ],
      failures: [
        {
          containerNumber: 'MSCU7654321',
          error: 'unsupported_sync_provider_for_container',
        },
      ],
    }),
  )

  const controllers = createSyncControllers({
    syncUseCases: {
      syncDashboard,
      syncProcess,
      syncContainer,
      refreshProcess,
    },
    defaultTenantId: 'tenant-a',
  })

  return {
    controllers,
    syncDashboard,
    syncProcess,
    syncContainer,
    refreshProcess,
  }
}

function buildDashboardSyncSuccessResult() {
  return {
    summary: {
      requestedProcesses: 1,
      requestedContainers: 1,
      enqueued: 1,
      skipped: 0,
      failed: 0,
    },
    enqueuedTargets: [
      {
        processId: 'process-1',
        processReference: 'REF-1',
        containerNumber: 'MSCU1234567',
        provider: 'msc' as const,
        syncRequestId: 'sync-1',
      },
    ],
    skippedTargets: [],
    failedTargets: [],
  }
}

describe('sync controllers', () => {
  it('returns 200 with structured batch results when dashboard sync completes', async () => {
    const { controllers, syncDashboard } = createControllers()

    const response = await controllers.syncAllProcesses()
    const body = SyncAllProcessesSuccessResponseSchema.parse(await response.json())

    expect(response.status).toBe(200)
    expect(body.summary).toEqual({
      requestedProcesses: 3,
      requestedContainers: 8,
      enqueued: 8,
      skipped: 0,
      failed: 0,
    })
    expect(body.enqueuedTargets).toHaveLength(8)
    expect(syncDashboard).toHaveBeenCalledTimes(1)
  })

  it('allows overlapping dashboard sync requests to delegate to shared sync orchestration', async () => {
    let releaseFirstSync: () => void = () => {}
    const firstSyncGate = new Promise<void>((resolve) => {
      releaseFirstSync = resolve
    })

    const syncDashboard = vi.fn(async () => {
      await firstSyncGate
      return {
        summary: {
          requestedProcesses: 1,
          requestedContainers: 2,
          enqueued: 2,
          skipped: 0,
          failed: 0,
        },
        enqueuedTargets: [
          {
            processId: 'process-1',
            processReference: 'REF-1',
            containerNumber: 'MSCU1234567',
            provider: 'msc' as const,
            syncRequestId: 'sync-1',
          },
          {
            processId: 'process-1',
            processReference: 'REF-1',
            containerNumber: 'MRKU7654321',
            provider: 'maersk' as const,
            syncRequestId: 'sync-2',
          },
        ],
        skippedTargets: [],
        failedTargets: [],
      }
    })

    const controllers = createSyncControllers({
      syncUseCases: {
        syncDashboard,
        syncProcess: vi.fn(async () => ({ processId: 'process-1', syncedContainers: 1 })),
        syncContainer: vi.fn(async () => ({ containerNumber: 'MSCU1234567', syncedContainers: 1 })),
        refreshProcess: vi.fn(async () => ({
          processId: 'process-1',
          mode: 'process' as const,
          requestedContainers: 0,
          queuedContainers: 0,
          syncRequestIds: [],
          requests: [],
          failures: [],
        })),
      },
      defaultTenantId: 'tenant-a',
    })

    const firstRequestPromise = controllers.syncDashboard()
    await Promise.resolve()

    const secondResponsePromise = controllers.syncDashboard()

    releaseFirstSync()
    const firstResponse = await firstRequestPromise
    const secondResponse = await secondResponsePromise

    expect(firstResponse.status).toBe(200)
    expect(secondResponse.status).toBe(200)
    expect(syncDashboard).toHaveBeenCalledTimes(2)
  })

  it('returns 422 with structured batch results when dashboard sync finishes with failures and no enqueue', async () => {
    const syncDashboard = vi.fn(async () => ({
      summary: {
        requestedProcesses: 1,
        requestedContainers: 1,
        enqueued: 0,
        skipped: 0,
        failed: 1,
      },
      enqueuedTargets: [],
      skippedTargets: [],
      failedTargets: [
        {
          processId: 'process-1',
          processReference: 'REF-1',
          containerNumber: 'MSCU1234567',
          provider: 'msc',
          reasonCode: 'ENQUEUE_FAILED' as const,
          reasonMessage: 'Failed to enqueue dashboard sync request.',
        },
      ],
    }))

    const controllers = createSyncControllers({
      syncUseCases: {
        syncDashboard,
        syncProcess: vi.fn(async () => ({ processId: 'process-1', syncedContainers: 1 })),
        syncContainer: vi.fn(async () => ({ containerNumber: 'MSCU1234567', syncedContainers: 1 })),
        refreshProcess: vi.fn(async () => ({
          processId: 'process-1',
          mode: 'process' as const,
          requestedContainers: 0,
          queuedContainers: 0,
          syncRequestIds: [],
          requests: [],
          failures: [],
        })),
      },
      defaultTenantId: 'tenant-a',
    })

    const response = await controllers.syncDashboard()
    const body = SyncAllProcessesBusinessErrorResponseSchema.parse(await response.json())

    expect(response.status).toBe(422)
    expect(body.error).toBe('sync_dashboard_failed_no_targets_enqueued')
    expect(body.summary.failed).toBe(1)
  })

  it('returns 200 with process sync counters when process sync completes', async () => {
    const { controllers, syncProcess } = createControllers()

    const response = await controllers.syncProcessById({ params: { id: 'process-1' } })
    const body = SyncProcessResponseSchema.parse(await response.json())

    expect(response.status).toBe(200)
    expect(body).toEqual({
      ok: true,
      processId: 'process-1',
      syncedContainers: 2,
    })
    expect(syncProcess).toHaveBeenCalledWith({
      tenantId: 'tenant-a',
      scope: {
        kind: 'process',
        processId: 'process-1',
      },
      mode: 'manual',
    })
  })

  it('allows overlapping process sync requests for the same process to delegate to shared sync orchestration', async () => {
    let releaseFirstSync: () => void = () => {}
    const firstSyncGate = new Promise<void>((resolve) => {
      releaseFirstSync = resolve
    })

    const syncProcess = vi.fn(async (command: EnqueueSyncCommand) => {
      if (command.scope.kind !== 'process') {
        throw new Error('invalid scope')
      }

      await firstSyncGate

      return {
        processId: command.scope.processId,
        syncedContainers: 2,
      }
    })

    const controllers = createSyncControllers({
      syncUseCases: {
        syncDashboard: vi.fn(async () => buildDashboardSyncSuccessResult()),
        syncProcess,
        syncContainer: vi.fn(async () => ({ containerNumber: 'MSCU1234567', syncedContainers: 1 })),
        refreshProcess: vi.fn(async () => ({
          processId: 'process-1',
          mode: 'process' as const,
          requestedContainers: 0,
          queuedContainers: 0,
          syncRequestIds: [],
          requests: [],
          failures: [],
        })),
      },
      defaultTenantId: 'tenant-a',
    })

    const firstRequestPromise = controllers.syncProcessById({ params: { id: 'process-1' } })
    await Promise.resolve()

    const secondResponsePromise = controllers.syncProcessById({ params: { id: 'process-1' } })

    releaseFirstSync()
    const firstResponse = await firstRequestPromise
    const secondResponse = await secondResponsePromise

    expect(firstResponse.status).toBe(200)
    expect(secondResponse.status).toBe(200)
    expect(syncProcess).toHaveBeenCalledTimes(2)
  })

  it('returns 200 with container sync counters when container sync completes', async () => {
    const { controllers, syncContainer } = createControllers()

    const response = await controllers.syncContainerByNumber({
      params: { number: 'MSCU1234567' },
    })
    const body = SyncContainerResponseSchema.parse(await response.json())

    expect(response.status).toBe(200)
    expect(body).toEqual({
      ok: true,
      containerNumber: 'MSCU1234567',
      syncedContainers: 1,
    })
    expect(syncContainer).toHaveBeenCalledWith({
      tenantId: 'tenant-a',
      scope: {
        kind: 'container',
        containerNumber: 'MSCU1234567',
      },
      mode: 'manual',
    })
  })

  it('allows overlapping container sync requests for the same container to delegate to shared sync orchestration', async () => {
    let releaseFirstSync: () => void = () => {}
    const firstSyncGate = new Promise<void>((resolve) => {
      releaseFirstSync = resolve
    })

    const syncContainer = vi.fn(async (command: EnqueueSyncCommand) => {
      if (command.scope.kind !== 'container') {
        throw new Error('invalid scope')
      }

      await firstSyncGate

      return {
        containerNumber: command.scope.containerNumber,
        syncedContainers: 1,
      }
    })

    const controllers = createSyncControllers({
      syncUseCases: {
        syncDashboard: vi.fn(async () => buildDashboardSyncSuccessResult()),
        syncProcess: vi.fn(async () => ({ processId: 'process-1', syncedContainers: 1 })),
        syncContainer,
        refreshProcess: vi.fn(async () => ({
          processId: 'process-1',
          mode: 'process' as const,
          requestedContainers: 0,
          queuedContainers: 0,
          syncRequestIds: [],
          requests: [],
          failures: [],
        })),
      },
      defaultTenantId: 'tenant-a',
    })

    const firstRequestPromise = controllers.syncContainerByNumber({
      params: { number: 'MSCU1234567' },
    })
    await Promise.resolve()

    const secondResponsePromise = controllers.syncContainerByNumber({
      params: { number: 'MSCU1234567' },
    })

    releaseFirstSync()
    const firstResponse = await firstRequestPromise
    const secondResponse = await secondResponsePromise

    expect(firstResponse.status).toBe(200)
    expect(secondResponse.status).toBe(200)
    expect(syncContainer).toHaveBeenCalledTimes(2)
  })

  it('returns 202 for process refresh with queue ids and failure details', async () => {
    const { controllers, refreshProcess } = createControllers()

    const request = new Request('http://localhost/api/processes/process-1/refresh', {
      method: 'POST',
      body: JSON.stringify({ mode: 'process' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await controllers.refreshProcessById({
      params: { id: 'process-1' },
      request,
    })
    const body = ProcessRefreshResponseSchema.parse(await response.json())

    expect(response.status).toBe(202)
    expect(body.processId).toBe('process-1')
    expect(body.syncRequestIds).toEqual(['ac8c52bf-0e1d-49db-9441-5586f86f0e31'])
    expect(body.failures).toEqual([
      {
        container_number: 'MSCU7654321',
        error: 'unsupported_sync_provider_for_container',
      },
    ])
    expect(refreshProcess).toHaveBeenCalledWith({
      processId: 'process-1',
      mode: 'process',
      containerNumber: undefined,
    })
  })
})
