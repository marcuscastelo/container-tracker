import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchDashboardKpis } from '~/modules/process/ui/fetchDashboardKpis'

describe('fetchDashboardKpis', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('requests /api/dashboard/kpis and parses the response schema', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () =>
        new Response(
          JSON.stringify({
            activeProcesses: 24,
            trackedContainers: 61,
            activeIncidents: 8,
            affectedContainers: 13,
            lastSyncAt: '2026-03-12T13:42:00.000Z',
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
            },
          },
        ),
    )

    const result = await fetchDashboardKpis()

    expect(fetchSpy).toHaveBeenCalledWith('/api/dashboard/kpis', undefined)
    expect(result).toEqual({
      activeProcesses: 24,
      trackedContainers: 61,
      activeIncidents: 8,
      affectedContainers: 13,
      lastSyncAt: '2026-03-12T13:42:00.000Z',
    })
  })
})
