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
    return 'border-tone-danger-border bg-tone-danger-bg text-tone-danger-fg shadow-[0_1px_2px_rgb(0_0_0_/6%)]'
  }

  return 'border-tone-warning-border bg-tone-warning-bg/70 text-tone-warning-fg'
}

export function toTrackingValidationBannerClasses(state: TrackingReviewDisplayState): string {
  if (state.visible && state.tone === 'danger') {
    return 'border border-tone-danger-border border-l-4 border-l-tone-danger-strong bg-tone-danger-bg text-tone-danger-fg shadow-[0_1px_2px_rgb(0_0_0_/8%)]'
  }

  return 'border border-tone-warning-border border-l-4 border-l-tone-warning-strong bg-tone-warning-bg/70 text-tone-warning-fg'
}
