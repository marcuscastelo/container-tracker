import { describe, expect, it, vi } from 'vitest'
import { createSyncStatusControllers } from '~/capabilities/sync/interface/http/sync-status.controllers'
import { ProcessesSyncStatusResponseSchema } from '~/shared/api-schemas/processes.schemas'

describe('sync-status controllers', () => {
  it('returns process sync-status envelope with no-store cache headers', async () => {
    const getSyncStatus = vi.fn(async () => ({
      generatedAt: '2026-03-06T12:00:00.000Z',
      processes: [
        {
          processId: 'process-1',
          syncStatus: 'syncing' as const,
          startedAt: '2026-03-06T11:00:00.000Z',
          finishedAt: null,
          containerCount: 2,
          completedContainers: 1,
          failedContainers: 0,
          visibility: 'active' as const,
        },
      ],
    }))

    const controllers = createSyncStatusControllers({
      syncUseCases: {
        getSyncStatus,
      },
    })

    const response = await controllers.listProcessesSyncStatus()
    const body = ProcessesSyncStatusResponseSchema.parse(await response.json())

    expect(response.status).toBe(200)
    expect(body.generated_at).toBe('2026-03-06T12:00:00.000Z')
    expect(response.headers.get('Cache-Control')).toContain('no-store')
    expect(response.headers.get('Pragma')).toBe('no-cache')
    expect(response.headers.get('Expires')).toBe('0')
  })
})
