import { describe, expect, it, vi } from 'vitest'

const syncHandlers = vi.hoisted(() => ({
  syncDashboard: vi.fn(),
}))

vi.mock('~/shared/api/sync.controllers.bootstrap', () => ({
  syncControllers: {
    syncDashboard: syncHandlers.syncDashboard,
  },
}))

import { POST as dashboardSyncPost, runtime } from '~/routes/api/dashboard/sync'

describe('dashboard sync route', () => {
  it('binds POST /api/dashboard/sync to sync capability controller', () => {
    expect(dashboardSyncPost).toBe(syncHandlers.syncDashboard)
    expect(runtime).toBe('nodejs')
  })
})
