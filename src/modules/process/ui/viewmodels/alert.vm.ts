export type AlertDisplayVM = {
  readonly id: string
  readonly type: 'delay' | 'customs' | 'missing-eta' | 'transshipment' | 'info'
  readonly severity: 'info' | 'warning' | 'danger'
  readonly containerNumber: string
  readonly messageKey:
    | 'alerts.transshipmentDetected'
    | 'alerts.customsHoldDetected'
    | 'alerts.noMovementDetected'
    | 'alerts.etaMissing'
    | 'alerts.etaPassed'
    | 'alerts.portChange'
    | 'alerts.dataInconsistent'
  readonly messageParams: Record<string, string | number>
  readonly timestamp: string
  readonly triggeredAtIso: string
  readonly ackedAtIso: string | null
  readonly category: 'fact' | 'monitoring'
  readonly retroactive: boolean
}
