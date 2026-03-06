import { describe, expect, it, vi } from 'vitest'
import { refreshDashboardData } from '~/modules/process/ui/utils/dashboard-refresh'

describe('refreshDashboardData', () => {
  it('resolves when both refetches succeed', async () => {
    const refetchProcesses = vi.fn(async () => [])
    const refetchGlobalAlerts = vi.fn(async () => ({ totalActiveAlerts: 0 }))

    await expect(
      refreshDashboardData({
        refetchProcesses,
        refetchGlobalAlerts,
      }),
    ).resolves.toBeUndefined()

    expect(refetchProcesses).toHaveBeenCalledTimes(1)
    expect(refetchGlobalAlerts).toHaveBeenCalledTimes(1)
  })

  it('rejects when one refetch fails and keeps partial success behavior', async () => {
    const refetchProcesses = vi.fn(async () => [])
    const refetchGlobalAlerts = vi.fn(async () => {
      throw new Error('global alerts failed')
    })

    await expect(
      refreshDashboardData({
        refetchProcesses,
        refetchGlobalAlerts,
      }),
    ).rejects.toThrow('global alerts failed')

    expect(refetchProcesses).toHaveBeenCalledTimes(1)
    expect(refetchGlobalAlerts).toHaveBeenCalledTimes(1)
  })

  it('rejects when both refetches fail', async () => {
    const refetchProcesses = vi.fn(async () => {
      throw new Error('processes failed')
    })
    const refetchGlobalAlerts = vi.fn(async () => {
      throw new Error('global alerts failed')
    })

    await expect(
      refreshDashboardData({
        refetchProcesses,
        refetchGlobalAlerts,
      }),
    ).rejects.toThrow()

    expect(refetchProcesses).toHaveBeenCalledTimes(1)
    expect(refetchGlobalAlerts).toHaveBeenCalledTimes(1)
  })
})
