import { describe, expect, it } from 'vitest'
import { toDashboardProcessExceptionVMs } from '~/modules/process/ui/mappers/dashboardProcessExceptions.ui-mapper'
import { temporalDtoFromCanonical } from '~/shared/time/tests/helpers'

describe('toDashboardProcessExceptionVMs', () => {
  it('maps process exceptions while preserving backend order', () => {
    const result = toDashboardProcessExceptionVMs({
      generated_at: '2026-03-06T12:00:00.000Z',
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
          eta_current: temporalDtoFromCanonical('2026-03-10T10:00:00.000Z'),
          dominant_severity: 'danger',
          dominant_alert_created_at: '2026-03-10T09:30:00.000Z',
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
          dominant_alert_created_at: null,
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
        status: 'blue-500',
        etaCurrent: temporalDtoFromCanonical('2026-03-10T10:00:00.000Z'),
        dominantSeverity: 'danger',
        activeAlertCount: 2,
        dominantAlertCreatedAt: '2026-03-10T09:30:00.000Z',
      },
      {
        processId: 'process-none',
        reference: 'REF-NONE',
        origin: 'Santos',
        destination: 'Valencia',
        statusCode: 'UNKNOWN',
        status: 'slate-400',
        etaCurrent: null,
        dominantSeverity: 'none',
        activeAlertCount: 0,
        dominantAlertCreatedAt: null,
      },
    ])
  })
})
