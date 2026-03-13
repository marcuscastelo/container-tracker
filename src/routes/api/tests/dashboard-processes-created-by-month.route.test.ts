import { describe, expect, it, vi } from 'vitest'

const handlers = vi.hoisted(() => ({
  getProcessesCreatedByMonth: vi.fn(),
}))

vi.mock('~/shared/api/dashboard.controllers.bootstrap', () => ({
  dashboardControllers: {
    getProcessesCreatedByMonth: handlers.getProcessesCreatedByMonth,
  },
}))

import { GET as dashboardProcessesCreatedByMonthGet } from '~/routes/api/dashboard/charts/processes-created-by-month'

describe('dashboard processes created by month route', () => {
  it('binds GET /api/dashboard/charts/processes-created-by-month to dashboard capability controller', () => {
    expect(dashboardProcessesCreatedByMonthGet).toBe(handlers.getProcessesCreatedByMonth)
  })
})
