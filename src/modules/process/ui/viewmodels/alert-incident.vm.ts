import type { TrackingAlertLifecycleState } from '~/modules/tracking/features/alerts/domain/model/trackingAlert'

export type AlertIncidentCategoryVM = 'movement' | 'eta' | 'customs' | 'data'
export type AlertIncidentBucketVM = 'active' | 'recognized'

export type AlertIncidentRecordVM = {
  readonly alertId: string
  readonly lifecycleState: TrackingAlertLifecycleState
  readonly detectedAtIso: string
  readonly triggeredAtIso: string
  readonly ackedAtIso: string | null
  readonly resolvedAtIso: string | null
  readonly resolvedReason: 'condition_cleared' | 'terminal_state' | null
}

export type AlertIncidentMemberVM = {
  readonly containerId: string
  readonly containerNumber: string
  readonly lifecycleState: TrackingAlertLifecycleState
  readonly detectedAtIso: string
  readonly transshipmentOrder: number | null
  readonly port: string | null
  readonly fromVessel: string | null
  readonly toVessel: string | null
  readonly records: readonly AlertIncidentRecordVM[]
}

export type AlertIncidentVM = {
  readonly incidentKey: string
  readonly bucket: AlertIncidentBucketVM
  readonly category: AlertIncidentCategoryVM
  readonly type:
    | 'TRANSSHIPMENT'
    | 'PLANNED_TRANSSHIPMENT'
    | 'CUSTOMS_HOLD'
    | 'PORT_CHANGE'
    | 'ETA_PASSED'
    | 'ETA_MISSING'
    | 'DATA_INCONSISTENT'
  readonly severity: 'info' | 'warning' | 'danger'
  readonly messageKey:
    | 'incidents.fact.transshipmentDetected'
    | 'incidents.fact.plannedTransshipmentDetected'
    | 'incidents.fact.customsHoldDetected'
    | 'incidents.fact.etaMissing'
    | 'incidents.fact.etaPassed'
    | 'incidents.fact.portChange'
    | 'incidents.fact.dataInconsistent'
  readonly messageParams: Record<string, string | number>
  readonly action: {
    readonly actionKey:
      | 'incidents.action.updateRedestination'
      | 'incidents.action.checkEta'
      | 'incidents.action.followUpCustoms'
      | 'incidents.action.reviewData'
    readonly actionParams: Record<string, string | number>
    readonly actionKind: 'UPDATE_REDESTINATION' | 'CHECK_ETA' | 'FOLLOW_UP_CUSTOMS' | 'REVIEW_DATA'
  } | null
  readonly detectedAtIso: string
  readonly triggeredAtIso: string
  readonly transshipmentOrder: number | null
  readonly port: string | null
  readonly fromVessel: string | null
  readonly toVessel: string | null
  readonly affectedContainerCount: number
  readonly activeAlertIds: readonly string[]
  readonly ackedAlertIds: readonly string[]
  readonly members: readonly AlertIncidentMemberVM[]
}

export type AlertIncidentsSummaryVM = {
  readonly activeIncidents: number
  readonly affectedContainers: number
  readonly recognizedIncidents: number
}

export type AlertIncidentsVM = {
  readonly summary: AlertIncidentsSummaryVM
  readonly active: readonly AlertIncidentVM[]
  readonly recognized: readonly AlertIncidentVM[]
}
