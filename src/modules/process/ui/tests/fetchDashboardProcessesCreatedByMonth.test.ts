import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchDashboardProcessesCreatedByMonth } from '~/modules/process/ui/fetchDashboardProcessesCreatedByMonth'

describe('fetchDashboardProcessesCreatedByMonth', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('requests /api/dashboard/charts/processes-created-by-month and parses response', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () =>
        new Response(
          JSON.stringify({
            months: [
              { month: '2025-10', label: 'Oct', count: 4 },
              { month: '2025-11', label: 'Nov', count: 7 },
            ],
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
            },
          },
        ),
    )

    const result = await fetchDashboardProcessesCreatedByMonth()

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/dashboard/charts/processes-created-by-month',
      undefined,
    )
    expect(result).toEqual({
      months: [
        { month: '2025-10', label: 'Oct', count: 4 },
        { month: '2025-11', label: 'Nov', count: 7 },
      ],
    })
  })

  it('appends window query when window size is provided', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () =>
        new Response(
          JSON.stringify({
            months: [{ month: '2025-10', label: 'Oct', count: 4 }],
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
            },
          },
        ),
    )

    await fetchDashboardProcessesCreatedByMonth({ windowSize: 24 })

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/dashboard/charts/processes-created-by-month?window=24',
      undefined,
    )
  })
})
