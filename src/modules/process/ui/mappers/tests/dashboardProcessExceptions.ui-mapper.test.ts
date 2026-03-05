import { describe, expect, it } from 'vitest'
import { toDashboardProcessExceptionVMs } from '~/modules/process/ui/mappers/dashboardProcessExceptions.ui-mapper'

describe('toDashboardProcessExceptionVMs', () => {
  it('maps process exceptions while preserving backend order', () => {
    const result = toDashboardProcessExceptionVMs({
      total_active_alerts: 3,
      by_severity: {
        danger: 1,
        warning: 1,
        info: 1,
        success: 0,
      },
      by_category: {
        eta: 1,
        movement: 1,
        customs: 0,
        status: 1,
        data: 0,
      },
      process_exceptions: [
        {
          process_id: 'process-danger',
          reference: 'REF-DANGER',
          origin: 'Ningbo',
          destination: 'Antwerp',
          derived_status: 'IN_TRANSIT',
          eta_current: '2026-03-10T10:00:00.000Z',
          dominant_severity: 'danger',
          active_alert_count: 2,
        },
        {
          process_id: 'process-none',
          reference: 'REF-NONE',
          origin: 'Santos',
          destination: 'Valencia',
          derived_status: 'UNKNOWN_STATUS',
          eta_current: null,
          dominant_severity: 'none',
          active_alert_count: 0,
        },
      ],
    })

    expect(result).toEqual([
      {
        processId: 'process-danger',
        reference: 'REF-DANGER',
        origin: 'Ningbo',
        destination: 'Antwerp',
        statusCode: 'IN_TRANSIT',
        status: 'in-transit',
        etaCurrent: '2026-03-10T10:00:00.000Z',
        dominantSeverity: 'danger',
        activeAlertCount: 2,
      },
      {
        processId: 'process-none',
        reference: 'REF-NONE',
        origin: 'Santos',
        destination: 'Valencia',
        statusCode: 'UNKNOWN',
        status: 'unknown',
        etaCurrent: null,
        dominantSeverity: 'none',
        activeAlertCount: 0,
      },
    ])
  })
})
