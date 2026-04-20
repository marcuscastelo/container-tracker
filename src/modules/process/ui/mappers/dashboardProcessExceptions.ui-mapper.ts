import {
  processStatusToVariant,
  toProcessStatusCode,
} from '~/modules/process/ui/mappers/processStatus.ui-mapper'
import type {
  DashboardProcessExceptionSeverity,
  DashboardProcessExceptionVM,
} from '~/modules/process/ui/viewmodels/dashboard-process-exception.vm'
import type { DashboardOperationalSummaryResponse } from '~/shared/api-schemas/dashboard.schemas'

function toDashboardProcessExceptionSeverity(value: string): DashboardProcessExceptionSeverity {
  if (value === 'danger') return 'danger'
  if (value === 'warning') return 'warning'
  if (value === 'info') return 'info'
  if (value === 'success') return 'success'
  return 'none'
}

export function toDashboardProcessExceptionVMs(
  source: DashboardOperationalSummaryResponse,
): readonly DashboardProcessExceptionVM[] {
  return source.process_exceptions.map((process) => {
    const statusCode = toProcessStatusCode(process.derived_status)

    return {
      processId: process.process_id,
      reference: process.reference,
      origin: process.origin,
      destination: process.destination,
      statusCode,
      status: processStatusToVariant(statusCode),
      etaCurrent: process.eta_current,
      dominantSeverity: toDashboardProcessExceptionSeverity(process.dominant_severity),
      activeIncidentCount: process.active_incident_count,
      affectedContainerCount: process.affected_container_count,
      dominantIncident:
        process.dominant_incident === null
          ? null
          : {
              type: process.dominant_incident.type,
              severity: process.dominant_incident.severity,
              factMessageKey: process.dominant_incident.fact.message_key,
              factMessageParams: process.dominant_incident.fact.message_params,
              triggeredAt: process.dominant_incident.triggered_at,
            },
    }
  })
}
