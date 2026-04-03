type TrackingReviewSeverity = 'danger' | 'info' | 'warning'

type TrackingReviewDisplayInput = {
  readonly hasIssues: boolean
  readonly highestSeverity: TrackingReviewSeverity | null
}

export type TrackingReviewDisplayState =
  | {
      readonly visible: false
      readonly tone: null
    }
  | {
      readonly visible: true
      readonly tone: 'danger' | 'warning'
    }

export function toTrackingValidationDisplayState(
  input: TrackingReviewDisplayInput,
): TrackingReviewDisplayState {
  if (!input.hasIssues) {
    return {
      visible: false,
      tone: null,
    }
  }

  return {
    visible: true,
    tone: input.highestSeverity === 'danger' ? 'danger' : 'warning',
  }
}

export function toTrackingValidationBadgeClasses(state: TrackingReviewDisplayState): string {
  if (state.visible && state.tone === 'danger') {
    return 'border-tone-danger-border bg-tone-danger-bg text-tone-danger-fg'
  }

  return 'border-tone-warning-border bg-tone-warning-bg text-tone-warning-fg'
}

export function toTrackingValidationBannerClasses(state: TrackingReviewDisplayState): string {
  if (state.visible && state.tone === 'danger') {
    return 'border-tone-danger-border bg-tone-danger-bg text-tone-danger-fg'
  }

  return 'border-tone-warning-border bg-tone-warning-bg text-tone-warning-fg'
}
