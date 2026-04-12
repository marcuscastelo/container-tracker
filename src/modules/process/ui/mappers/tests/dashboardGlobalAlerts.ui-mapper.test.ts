import { describe, expect, it } from 'vitest'
import { toDashboardGlobalAlertsVM } from '~/modules/process/ui/mappers/dashboardGlobalAlerts.ui-mapper'

describe('toDashboardGlobalAlertsVM', () => {
  it('maps dashboard global incident response to view model', () => {
    const result = toDashboardGlobalAlertsVM({
      generated_at: '2026-03-06T12:00:00.000Z',
      total_active_incidents: 12,
      affected_containers_count: 7,
      recognized_incidents_count: 2,
      by_severity: {
        danger: 3,
        warning: 4,
        info: 5,
      },
      by_category: {
        eta: 6,
        movement: 2,
        customs: 1,
        data: 1,
      },
    })

    expect(result).toEqual({
      totalActiveIncidents: 12,
      affectedContainersCount: 7,
      recognizedIncidentsCount: 2,
      bySeverity: {
        danger: 3,
        warning: 4,
        info: 5,
      },
      byCategory: {
        eta: 6,
        movement: 2,
        customs: 1,
        data: 1,
      },
    })
  })
})
