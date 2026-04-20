import type { TemporalValueDto } from '~/shared/time/dto'

export type PredictionHistoryItemTone = 'success' | 'danger' | 'warning' | 'info' | 'neutral'
export type PredictionHistoryHeaderTone = 'danger' | 'warning' | 'neutral'

export type PredictionHistorySource = {
  readonly header: {
    readonly tone: 'danger' | 'warning' | 'neutral'
    readonly summaryKind: 'SINGLE_VERSION' | 'HISTORY_UPDATED' | 'CONFLICT_DETECTED'
    readonly currentVersionId: string
    readonly previousVersionId: string | null
    readonly originalVersionId: string | null
    readonly reasonKind:
      | 'EVENT_CONFIRMED'
      | 'ESTIMATE_CHANGED'
      | 'PREVIOUS_VERSION_SUBSTITUTED'
      | 'VOYAGE_CHANGED_AFTER_CONFIRMATION'
      | null
  }
  readonly versions: readonly PredictionHistoryVersionSource[]
}

export type PredictionHistoryVersionSource = {
  readonly id: string
  readonly isCurrent: boolean
  readonly type: string
  readonly eventTime: TemporalValueDto | null
  readonly eventTimeType: 'ACTUAL' | 'EXPECTED'
  readonly vesselName: string | null
  readonly voyage: string | null
  readonly versionState:
    | 'CONFIRMED'
    | 'CONFIRMED_BEFORE'
    | 'SUBSTITUTED'
    | 'ESTIMATE_CHANGED'
    | 'INITIAL'
  readonly explanatoryTextKind: 'REPORTED_AS_ACTUAL_AND_CORRECTED_LATER' | null
  readonly transitionKindFromPreviousVersion:
    | 'EVENT_CONFIRMED'
    | 'ESTIMATE_CHANGED'
    | 'PREVIOUS_VERSION_SUBSTITUTED'
    | 'VOYAGE_CHANGED_AFTER_CONFIRMATION'
    | null
  readonly observedAtCount: number
  readonly observedAtList: readonly string[]
  readonly firstObservedAt: string
  readonly lastObservedAt: string
}

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
