export type PredictionHistoryItemTone = 'success' | 'danger' | 'warning' | 'info' | 'neutral'
export type PredictionHistoryHeaderTone = 'danger' | 'warning' | 'neutral'

export type PredictionHistoryModalVM = {
  readonly header: {
    readonly tone: PredictionHistoryHeaderTone
    readonly summaryLabel: string
    readonly currentLine: string
    readonly comparisonLine?: string | null
    readonly reasonLine?: string | null
  }
  readonly items: readonly PredictionHistoryItemVM[]
}

export type PredictionHistoryItemVM = {
  readonly id: string
  readonly isCurrent: boolean
  readonly currentMarkerLabel?: string | null
  readonly title: string
  readonly primaryLabel: string
  readonly secondaryLabel?: string | null
  readonly mainDateLabel?: string | null
  readonly stateLabel: string
  readonly stateTone: PredictionHistoryItemTone
  readonly explanatoryText?: string | null
  readonly transitionLabelFromPrevious?: string | null
  readonly infoTooltipLines: readonly string[]
}
