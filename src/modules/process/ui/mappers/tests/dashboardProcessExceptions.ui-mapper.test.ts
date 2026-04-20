import { describe, expect, it } from 'vitest'
import { toDashboardProcessExceptionVMs } from '~/modules/process/ui/mappers/dashboardProcessExceptions.ui-mapper'
import { temporalDtoFromCanonical } from '~/shared/time/tests/helpers'

describe('toDashboardProcessExceptionVMs', () => {
  it('maps process exceptions while preserving backend order', () => {
    const result = toDashboardProcessExceptionVMs({
      generated_at: '2026-03-06T12:00:00.000Z',
      total_active_incidents: 3,
      affected_containers_count: 2,
      recognized_incidents_count: 1,
      by_severity: {
        danger: 1,
        warning: 1,
        info: 1,
      },
      by_category: {
        eta: 1,
        movement: 1,
        customs: 0,
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
          active_incident_count: 2,
          affected_container_count: 2,
          dominant_incident: {
            type: 'CUSTOMS_HOLD',
            severity: 'danger',
            fact: {
              message_key: 'incidents.fact.customsHoldDetected',
              message_params: { location: 'Antwerp' },
            },
            triggered_at: '2026-03-10T09:30:00.000Z',
          },
        },
        {
          process_id: 'process-none',
          reference: 'REF-NONE',
          origin: 'Santos',
          destination: 'Valencia',
          derived_status: 'UNKNOWN_STATUS',
          eta_current: null,
          dominant_severity: 'none',
          active_incident_count: 0,
          affected_container_count: 0,
          dominant_incident: null,
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
        activeIncidentCount: 2,
        affectedContainerCount: 2,
        dominantIncident: {
          type: 'CUSTOMS_HOLD',
          severity: 'danger',
          factMessageKey: 'incidents.fact.customsHoldDetected',
          factMessageParams: { location: 'Antwerp' },
          triggeredAt: '2026-03-10T09:30:00.000Z',
        },
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
        activeIncidentCount: 0,
        affectedContainerCount: 0,
        dominantIncident: null,
      },
    ])
  })
})
