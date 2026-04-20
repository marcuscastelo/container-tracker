import { describe, expect, it } from 'vitest'
import { toDashboardKpiVMs } from '~/modules/process/ui/mappers/dashboard-kpis.ui-mapper'
import type { DashboardKpiVM } from '~/modules/process/ui/viewmodels/dashboard-kpi.vm'

describe('toDashboardKpiVMs', () => {
  const ActiveProcessesIcon: DashboardKpiVM['icon'] = () => null
  const TrackedContainersIcon: DashboardKpiVM['icon'] = () => null
  const ActiveIncidentsIcon: DashboardKpiVM['icon'] = () => null
  const LastSyncIcon: DashboardKpiVM['icon'] = () => null

  const icons = {
    activeProcesses: ActiveProcessesIcon,
    trackedContainers: TrackedContainersIcon,
    activeIncidents: ActiveIncidentsIcon,
    lastSync: LastSyncIcon,
  } as const

  it('maps dashboard kpi response to four cards with stable labels and tones', () => {
    const result = toDashboardKpiVMs({
      source: {
        activeProcesses: 24,
        trackedContainers: 61,
        activeIncidents: 8,
        affectedContainers: 13,
        lastSyncAt: '2026-03-12T13:42:00.000Z',
      },
      locale: 'en-US',
      labels: {
        activeProcesses: 'Active Processes',
        trackedContainers: 'Tracked Containers',
        activeIncidents: 'Active Incidents',
        affectedContainers: 'Affected Containers',
        lastSync: 'Last Sync',
        lastSyncUnavailable: '—',
      },
      icons,
    })

    const expectedLastSync = new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date('2026-03-12T13:42:00.000Z'))

    expect(result).toHaveLength(4)
    expect(result[0]?.label).toBe('Active Processes')
    expect(result[0]?.value).toBe('24')
    expect(result[0]?.tone).toBe('default')
    expect(result[0]?.icon).toBe(ActiveProcessesIcon)

    expect(result[1]?.label).toBe('Tracked Containers')
    expect(result[1]?.value).toBe('61')
    expect(result[1]?.tone).toBe('default')
    expect(result[1]?.icon).toBe(TrackedContainersIcon)

    expect(result[2]?.label).toBe('Active Incidents')
    expect(result[2]?.value).toBe('8')
    expect(result[2]?.detail).toBe('Affected Containers: 13')
    expect(result[2]?.tone).toBe('warning')
    expect(result[2]?.icon).toBe(ActiveIncidentsIcon)

    expect(result[3]?.label).toBe('Last Sync')
    expect(result[3]?.value).toBe(expectedLastSync)
    expect(result[3]?.tone).toBe('default')
    expect(result[3]?.icon).toBe(LastSyncIcon)
  })

  it('uses fallback label when lastSyncAt is null or invalid', () => {
    const labels = {
      activeProcesses: 'Active Processes',
      trackedContainers: 'Tracked Containers',
      activeIncidents: 'Active Incidents',
      affectedContainers: 'Affected Containers',
      lastSync: 'Last Sync',
      lastSyncUnavailable: 'No sync yet',
    } as const

    const nullSync = toDashboardKpiVMs({
      source: {
        activeProcesses: 0,
        trackedContainers: 0,
        activeIncidents: 0,
        affectedContainers: 0,
        lastSyncAt: null,
      },
      locale: 'en-US',
      labels,
      icons,
    })

    const invalidSync = toDashboardKpiVMs({
      source: {
        activeProcesses: 0,
        trackedContainers: 0,
        activeIncidents: 0,
        affectedContainers: 0,
        lastSyncAt: 'not-a-date',
      },
      locale: 'en-US',
      labels,
      icons,
    })

    expect(nullSync[3]?.value).toBe('No sync yet')
    expect(invalidSync[3]?.value).toBe('No sync yet')
  })
})
