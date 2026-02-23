import type { SeriesLabel } from '~/modules/tracking/application/projection/tracking.series.classification'
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
      return 'bg-blue-100 text-blue-700'
    case 'EXPIRED':
      return 'bg-amber-100 text-amber-700'
    case 'REDUNDANT_AFTER_ACTUAL':
      return 'bg-slate-100 text-slate-500'
    case 'SUPERSEDED_EXPECTED':
      return 'bg-slate-100 text-slate-600'
    case 'CONFIRMED':
      return 'bg-emerald-100 text-emerald-700'
    case 'CONFLICTING_ACTUAL':
      return 'bg-red-100 text-red-700'
  }
}
