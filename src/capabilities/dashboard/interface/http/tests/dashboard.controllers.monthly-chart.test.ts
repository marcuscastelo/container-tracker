import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import type { DashboardProcessesCreatedByMonthReadModel } from '~/capabilities/dashboard/application/dashboard.processes-created-by-month.readmodel'
import { createDashboardControllersHarness } from '~/capabilities/dashboard/interface/http/tests/dashboard.controllers.test.helpers'
import { DashboardProcessesCreatedByMonthResponseSchema } from '~/shared/api-schemas/dashboard.schemas'

describe('dashboard controllers - monthly chart contract behavior', () => {
  it('returns monthly chart data in chronological order', async () => {
    const monthly: DashboardProcessesCreatedByMonthReadModel = {
      months: [
        { month: '2025-10', label: 'Oct', count: 4 },
        { month: '2025-11', label: 'Nov', count: 7 },
      ],
    }

    const getProcessesCreatedByMonthReadModel = vi.fn(async () => monthly)

    const { controllers } = createDashboardControllersHarness({
      getProcessesCreatedByMonthReadModel,
    })

    const response = await controllers.getProcessesCreatedByMonth({
      request: new Request(
        'http://localhost/api/dashboard/charts/processes-created-by-month?window=12',
      ),
    })
    const body = DashboardProcessesCreatedByMonthResponseSchema.parse(await response.json())

    expect(response.status).toBe(200)
    expect(getProcessesCreatedByMonthReadModel).toHaveBeenCalledWith({ windowSize: 12 })
    expect(body.months).toEqual([
      { month: '2025-10', label: 'Oct', count: 4 },
      { month: '2025-11', label: 'Nov', count: 7 },
    ])
  })

  it('returns 400 for invalid monthly chart query', async () => {
    const ErrorResponseSchema = z.object({
      error: z.string(),
    })

    const { controllers } = createDashboardControllersHarness()

    const response = await controllers.getProcessesCreatedByMonth({
      request: new Request(
        'http://localhost/api/dashboard/charts/processes-created-by-month?window=9',
      ),
    })
    const body = ErrorResponseSchema.parse(await response.json())

    expect(response.status).toBe(400)
    expect(body.error).toContain('Invalid monthly chart query')
  })
})
