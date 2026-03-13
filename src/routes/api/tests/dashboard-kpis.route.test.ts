import { describe, expect, it, vi } from 'vitest'

const handlers = vi.hoisted(() => ({
  getKpis: vi.fn(),
}))

vi.mock('~/shared/api/dashboard.controllers.bootstrap', () => ({
  dashboardControllers: {
    getKpis: handlers.getKpis,
  },
}))

import { GET as dashboardKpisGet } from '~/routes/api/dashboard/kpis'

describe('dashboard kpis route', () => {
  it('binds GET /api/dashboard/kpis to dashboard capability controller', () => {
    expect(dashboardKpisGet).toBe(handlers.getKpis)
  })
})
