import type { TrackingStatusCode } from '~/modules/tracking/application/projection/tracking.status.projection'
import type { StatusVariant } from '~/shared/ui/StatusBadge'

export type DashboardProcessExceptionSeverity = 'danger' | 'warning' | 'info' | 'success' | 'none'

export type DashboardProcessExceptionVM = {
  readonly processId: string
  readonly reference: string | null
  readonly origin: string | null
  readonly destination: string | null
  readonly statusCode: TrackingStatusCode
  readonly status: StatusVariant
  readonly etaCurrent: string | null
  readonly dominantSeverity: DashboardProcessExceptionSeverity
  readonly activeAlertCount: number
  readonly oldestAlertGeneratedAt?: string | null
}
