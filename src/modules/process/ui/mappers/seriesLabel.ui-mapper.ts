import type { SeriesLabel } from '~/modules/tracking/features/series/application/projection/tracking.series.classification'
import type { TranslationKeys } from '~/shared/localization/translationTypes'

export function seriesLabelToKey(keys: TranslationKeys, label: SeriesLabel): string {
  switch (label) {
    case 'ACTIVE':
      return keys.shipmentView.timeline.predictionHistory.active
    case 'EXPIRED':
      return keys.shipmentView.timeline.predictionHistory.expired
    case 'REDUNDANT_AFTER_ACTUAL':
      return keys.shipmentView.timeline.predictionHistory.redundant
    case 'SUPERSEDED_EXPECTED':
      return keys.shipmentView.timeline.predictionHistory.superseded
    case 'CONFIRMED':
      return keys.shipmentView.timeline.predictionHistory.confirmed
    case 'CONFLICTING_ACTUAL':
      return keys.shipmentView.timeline.predictionHistory.conflicting
  }
}

export function seriesLabelToClass(label: SeriesLabel): string {
  switch (label) {
    case 'ACTIVE':
      return 'bg-tone-info-bg text-tone-info-fg'
    case 'EXPIRED':
      return 'bg-tone-warning-bg text-tone-warning-fg'
    case 'REDUNDANT_AFTER_ACTUAL':
      return 'bg-surface-muted text-text-muted'
    case 'SUPERSEDED_EXPECTED':
      return 'bg-surface-muted text-text-muted'
    case 'CONFIRMED':
      return 'bg-tone-success-bg text-tone-success-fg'
    case 'CONFLICTING_ACTUAL':
      return 'bg-tone-danger-bg text-tone-danger-fg'
  }
}
