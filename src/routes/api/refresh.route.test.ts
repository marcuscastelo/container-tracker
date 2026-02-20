import { describe, expect, it, vi } from 'vitest'

const trackingHandlers = vi.hoisted(() => ({
  refresh: vi.fn(),
  health: vi.fn(),
  refreshMaersk: vi.fn(),
}))

vi.mock('~/modules/tracking/interface/http/refresh.controllers.bootstrap', () => ({
  bootstrapRefreshControllers: () => ({
    refresh: trackingHandlers.refresh,
    health: trackingHandlers.health,
    refreshMaersk: trackingHandlers.refreshMaersk,
  }),
}))

import { GET as refreshGet, POST as refreshPost } from '~/routes/api/refresh'
import {
  GET as refreshMaerskGet,
  POST as refreshMaerskPost,
} from '~/routes/api/refresh-maersk/[container]'

describe('refresh routes', () => {
  it('binds /api/refresh to refresh controllers', () => {
    expect(refreshPost).toBe(trackingHandlers.refresh)
    expect(refreshGet).toBe(trackingHandlers.health)
  })

  it('binds /api/refresh-maersk/:container to refreshMaersk controller', () => {
    expect(refreshMaerskGet).toBe(trackingHandlers.refreshMaersk)
    expect(refreshMaerskPost).toBe(trackingHandlers.refreshMaersk)
  })
})
