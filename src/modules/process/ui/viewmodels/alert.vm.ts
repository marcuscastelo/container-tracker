export type AlertDisplayVM = {
  readonly id: string
  readonly type: 'customs' | 'missing-eta' | 'transshipment' | 'info'
  readonly severity: 'info' | 'warning' | 'danger'
  readonly containerNumber: string
  readonly messageKey:
    | 'alerts.transshipmentDetected'
    | 'alerts.plannedTransshipmentDetected'
    | 'alerts.customsHoldDetected'
    | 'alerts.etaMissing'
    | 'alerts.etaPassed'
    | 'alerts.portChange'
    | 'alerts.dataInconsistent'
  readonly messageParams: Record<string, string | number>
  readonly timestamp: string
  readonly triggeredAtIso: string
  readonly ackedAtIso: string | null
  readonly resolvedAtIso?: string | null
  readonly lifecycleState?: 'ACTIVE' | 'ACKED' | 'AUTO_RESOLVED'
  readonly resolvedReason?: 'condition_cleared' | 'terminal_state' | null
  readonly category: 'fact' | 'monitoring'
  readonly retroactive: boolean
}
