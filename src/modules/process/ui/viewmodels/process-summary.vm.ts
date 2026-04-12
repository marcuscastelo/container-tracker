import type { ProcessStatusCode } from '~/modules/process/ui/process-status-color'
import type { ProcessStatusMicrobadgeVM } from '~/modules/process/ui/viewmodels/process-status-microbadge.vm'
import type { ProcessTrackingValidationVM } from '~/modules/process/ui/viewmodels/tracking-review.vm'
import type { TemporalValueDto } from '~/shared/time/dto'
import type { StatusVariant } from '~/shared/ui/StatusBadge'

export type ProcessSyncStatus = 'idle' | 'syncing' | 'success' | 'error'

export type ProcessSummaryVM = {
  readonly id: string
  readonly reference: string | null
  readonly origin?: { display_name?: string | null } | null
  readonly destination?: { display_name?: string | null } | null
  readonly importerId: string | null
  readonly importerName: string | null
  readonly exporterName: string | null
  readonly containerCount: number
  readonly containerNumbers: readonly string[]
  readonly status: StatusVariant
  readonly statusCode: ProcessStatusCode
  readonly statusMicrobadge: ProcessStatusMicrobadgeVM | null
  readonly statusRank: number
  readonly eta: TemporalValueDto | null
  readonly etaDisplay:
    | {
        readonly kind: 'date'
        readonly value: TemporalValueDto
      }
    | {
        readonly kind: 'arrived'
        readonly value: TemporalValueDto
      }
    | {
        readonly kind: 'unavailable'
      }
    | {
        readonly kind: 'delivered'
      }
  readonly etaMsOrNull: number | null
  readonly carrier: string | null
  readonly activeIncidentCount: number
  readonly affectedContainerCount: number
  readonly recognizedIncidentCount: number
  readonly dominantIncident:
    | {
        readonly type:
          | 'TRANSSHIPMENT'
          | 'PLANNED_TRANSSHIPMENT'
          | 'CUSTOMS_HOLD'
          | 'PORT_CHANGE'
          | 'ETA_PASSED'
          | 'ETA_MISSING'
          | 'DATA_INCONSISTENT'
        readonly severity: 'info' | 'warning' | 'danger'
        readonly factMessageKey: string
        readonly factMessageParams: Record<string, string | number>
        readonly triggeredAt: string
      }
    | null
  readonly attentionSeverity: 'info' | 'warning' | 'danger' | null
  readonly trackingValidation: ProcessTrackingValidationVM
  readonly redestinationNumber?: string | null
  readonly lastEventAt: TemporalValueDto | null
  readonly syncStatus: ProcessSyncStatus
  readonly lastSyncAt: string | null
}
