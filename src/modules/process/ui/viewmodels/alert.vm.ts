export type AlertDisplayVM = {
  readonly id: string
  readonly type: 'delay' | 'customs' | 'missing-eta' | 'transshipment' | 'info'
  readonly severity: 'info' | 'warning' | 'danger'
  readonly message: string
  readonly timestamp: string
  readonly triggeredAtIso: string
  readonly ackedAtIso: string | null
  readonly category: 'fact' | 'monitoring'
  readonly retroactive: boolean
}
