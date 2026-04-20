import type { PredictionHistoryItemTone } from '~/modules/process/ui/viewmodels/prediction-history.vm'

export type PredictionHistoryDisplayCandidate = {
  readonly id: string
  readonly rawIds: readonly string[]
  readonly isCurrent: boolean
  readonly currentMarkerLabel: string | null
  readonly title: string
  readonly primaryLabel: string
  readonly secondaryLabel: string | null
  readonly mainDateLabel: string | null
  readonly stateLabel: string
  readonly stateTone: PredictionHistoryItemTone
  readonly explanatoryText: string | null
  readonly transitionLabelFromPrevious: string | null
  readonly observedAtList: readonly string[]
}

function sameNullable(left: string | null, right: string | null): boolean {
  return left === right
}

function hasSameDisplayIdentity(
  left: PredictionHistoryDisplayCandidate,
  right: PredictionHistoryDisplayCandidate,
): boolean {
  return (
    left.isCurrent === right.isCurrent &&
    sameNullable(left.currentMarkerLabel, right.currentMarkerLabel) &&
    left.title === right.title &&
    left.primaryLabel === right.primaryLabel &&
    sameNullable(left.secondaryLabel, right.secondaryLabel) &&
    sameNullable(left.mainDateLabel, right.mainDateLabel) &&
    left.stateLabel === right.stateLabel &&
    left.stateTone === right.stateTone &&
    sameNullable(left.explanatoryText, right.explanatoryText) &&
    sameNullable(left.transitionLabelFromPrevious, right.transitionLabelFromPrevious)
  )
}

function mergeObservedAtList(left: readonly string[], right: readonly string[]): readonly string[] {
  return [...new Set([...left, ...right])].sort((a, b) => a.localeCompare(b))
}

export function groupPredictionHistoryDisplayCandidates(
  candidates: readonly PredictionHistoryDisplayCandidate[],
): readonly PredictionHistoryDisplayCandidate[] {
  if (candidates.length < 2) return candidates

  const grouped: PredictionHistoryDisplayCandidate[] = []

  for (const candidate of candidates) {
    const previous = grouped[grouped.length - 1]

    if (previous === undefined || !hasSameDisplayIdentity(previous, candidate)) {
      grouped.push(candidate)
      continue
    }

    grouped[grouped.length - 1] = {
      ...previous,
      rawIds: [...previous.rawIds, ...candidate.rawIds],
      observedAtList: mergeObservedAtList(previous.observedAtList, candidate.observedAtList),
    }
  }

  return grouped
}
