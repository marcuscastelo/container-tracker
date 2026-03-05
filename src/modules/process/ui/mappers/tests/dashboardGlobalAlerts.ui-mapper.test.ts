import { describe, expect, it } from 'vitest'
import { toDashboardGlobalAlertsVM } from '~/modules/process/ui/mappers/dashboardGlobalAlerts.ui-mapper'

describe('toDashboardGlobalAlertsVM', () => {
  it('maps dashboard global alert response to view model', () => {
    const result = toDashboardGlobalAlertsVM({
      total_active_alerts: 12,
      by_severity: {
        danger: 3,
        warning: 4,
        info: 5,
        success: 0,
      },
      by_category: {
        eta: 6,
        movement: 2,
        customs: 1,
        status: 2,
        data: 1,
      },
    })

    expect(result).toEqual({
      totalActiveAlerts: 12,
      bySeverity: {
        danger: 3,
        warning: 4,
        info: 5,
        success: 0,
      },
      byCategory: {
        eta: 6,
        movement: 2,
        customs: 1,
        status: 2,
        data: 1,
      },
    })
  })
})
