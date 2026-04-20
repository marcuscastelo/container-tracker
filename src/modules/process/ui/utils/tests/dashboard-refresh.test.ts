import { describe, expect, it, vi } from 'vitest'
import { refreshDashboardData } from '~/modules/process/ui/utils/dashboard-refresh'

describe('refreshDashboardData', () => {
  it('runs sync before refetches and resolves when all requests succeed', async () => {
    const sequence: string[] = []
    const syncAllProcesses = vi.fn(async () => {
      sequence.push('sync')
      return { ok: true, httpStatus: 200 }
    })
    const refetchProcesses = vi.fn(async () => [])
    const refetchGlobalAlerts = vi.fn(async () => {
      sequence.push('alerts')
      return { totalActiveAlerts: 0 }
    })

    refetchProcesses.mockImplementation(async () => {
      sequence.push('processes')
      return []
    })

    await expect(
      refreshDashboardData({
        syncAllProcesses,
        refetchProcesses,
        refetchGlobalAlerts,
      }),
    ).resolves.toEqual({ ok: true, httpStatus: 200 })

    expect(syncAllProcesses).toHaveBeenCalledTimes(1)
    expect(refetchProcesses).toHaveBeenCalledTimes(1)
    expect(refetchGlobalAlerts).toHaveBeenCalledTimes(1)
    expect(sequence[0]).toBe('sync')
    expect(sequence).toContain('processes')
    expect(sequence).toContain('alerts')
  })

  it('rejects when sync fails and does not execute refetches', async () => {
    const syncAllProcesses = vi.fn(async () => {
      throw new Error('sync failed')
    })
    const refetchProcesses = vi.fn(async () => [])
    const refetchGlobalAlerts = vi.fn(async () => ({ totalActiveAlerts: 0 }))

    await expect(
      refreshDashboardData({
        syncAllProcesses,
        refetchProcesses,
        refetchGlobalAlerts,
      }),
    ).rejects.toThrow('sync failed')

    expect(syncAllProcesses).toHaveBeenCalledTimes(1)
    expect(refetchProcesses).toHaveBeenCalledTimes(0)
    expect(refetchGlobalAlerts).toHaveBeenCalledTimes(0)
  })

  it('rejects when one refetch fails after a successful sync', async () => {
    const syncAllProcesses = vi.fn(async () => ({ ok: true }))
    const refetchProcesses = vi.fn(async () => [])
    const refetchGlobalAlerts = vi.fn(async () => {
      throw new Error('global alerts failed')
    })

    await expect(
      refreshDashboardData({
        syncAllProcesses,
        refetchProcesses,
        refetchGlobalAlerts,
      }),
    ).rejects.toThrow('global alerts failed')

    expect(syncAllProcesses).toHaveBeenCalledTimes(1)
    expect(refetchProcesses).toHaveBeenCalledTimes(1)
    expect(refetchGlobalAlerts).toHaveBeenCalledTimes(1)
  })

  it('rejects when both refetches fail after a successful sync', async () => {
    const syncAllProcesses = vi.fn(async () => ({ ok: true }))
    const refetchProcesses = vi.fn(async () => {
      throw new Error('processes failed')
    })
    const refetchGlobalAlerts = vi.fn(async () => {
      throw new Error('global alerts failed')
    })

    await expect(
      refreshDashboardData({
        syncAllProcesses,
        refetchProcesses,
        refetchGlobalAlerts,
      }),
    ).rejects.toThrow()

    expect(syncAllProcesses).toHaveBeenCalledTimes(1)
    expect(refetchProcesses).toHaveBeenCalledTimes(1)
    expect(refetchGlobalAlerts).toHaveBeenCalledTimes(1)
  })
})
