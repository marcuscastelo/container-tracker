import {
  toProcessStatusCode,
  trackingStatusToVariant,
} from '~/modules/process/ui/mappers/trackingStatus.ui-mapper'
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
      status: trackingStatusToVariant(statusCode),
      etaCurrent: process.eta_current,
      dominantSeverity: toDashboardProcessExceptionSeverity(process.dominant_severity),
      activeAlertCount: process.active_alert_count,
      dominantAlertCreatedAt: process.dominant_alert_created_at,
    }
  })
}
