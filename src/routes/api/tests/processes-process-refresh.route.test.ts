import { describe, expect, it, vi } from 'vitest'

const syncHandlers = vi.hoisted(() => ({
  refreshProcessById: vi.fn(),
}))

vi.mock('~/shared/api/sync.controllers.bootstrap', () => ({
  syncControllers: {
    refreshProcessById: syncHandlers.refreshProcessById,
  },
}))

import { POST as processRefreshPost, runtime } from '~/routes/api/processes/[id]/refresh'

describe('process refresh by id route', () => {
  it('binds POST /api/processes/:id/refresh to sync capability refresh controller', () => {
    expect(processRefreshPost).toBe(syncHandlers.refreshProcessById)
    expect(runtime).toBe('nodejs')
  })
})
