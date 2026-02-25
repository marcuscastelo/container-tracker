import { describe, expect, it, vi } from 'vitest'

const trackingHandlers = vi.hoisted(() => ({
  refresh: vi.fn(),
  health: vi.fn(),
  status: vi.fn(),
}))

vi.mock('~/modules/tracking/interface/http/refresh.controllers.bootstrap', () => ({
  bootstrapRefreshControllers: () => ({
    refresh: trackingHandlers.refresh,
    health: trackingHandlers.health,
    status: trackingHandlers.status,
  }),
}))

import { GET as refreshGet, POST as refreshPost } from '~/routes/api/refresh'
import { GET as refreshStatusGet } from '~/routes/api/refresh/status'
import {
  GET as refreshMaerskGet,
  POST as refreshMaerskPost,
} from '~/routes/api/refresh-maersk/[container]'

describe('refresh routes', () => {
  it('binds /api/refresh to refresh controllers', () => {
    expect(refreshPost).toBe(trackingHandlers.refresh)
    expect(refreshGet).toBe(trackingHandlers.health)
  })

  it('binds /api/refresh/status to refresh status controller', () => {
    expect(refreshStatusGet).toBe(trackingHandlers.status)
  })

  it('returns 410 for legacy /api/refresh-maersk/:container', async () => {
    const getResponse = await refreshMaerskGet()
    const getBody = await getResponse.json()
    const postResponse = await refreshMaerskPost()
    const postBody = await postResponse.json()

    expect(getResponse.status).toBe(410)
    expect(postResponse.status).toBe(410)
    expect(getBody.error).toBe('refresh_maersk_deprecated_use_sync_queue')
    expect(postBody.error).toBe('refresh_maersk_deprecated_use_sync_queue')
  })
})
