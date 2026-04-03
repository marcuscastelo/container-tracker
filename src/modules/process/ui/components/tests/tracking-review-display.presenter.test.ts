import { describe, expect, it } from 'vitest'
import {
  toTrackingValidationBadgeClasses,
  toTrackingValidationBannerClasses,
  toTrackingValidationDisplayState,
} from '~/modules/process/ui/components/tracking-review-display.presenter'

describe('tracking-review-display.presenter', () => {
  it('keeps validation UI hidden when the aggregate has no issues', () => {
    expect(
      toTrackingValidationDisplayState({
        hasIssues: false,
        highestSeverity: null,
      }),
    ).toEqual({
      visible: false,
      tone: null,
    })
  })

  it('uses warning tone by default for visible validation support UI', () => {
    const state = toTrackingValidationDisplayState({
      hasIssues: true,
      highestSeverity: 'warning',
    })

    expect(state).toEqual({
      visible: true,
      tone: 'warning',
    })
    expect(toTrackingValidationBadgeClasses(state)).toContain('border-tone-warning-border')
    expect(toTrackingValidationBannerClasses(state)).toContain('border-tone-warning-border')
  })

  it('uses danger tone when the process/container aggregate is critical', () => {
    const state = toTrackingValidationDisplayState({
      hasIssues: true,
      highestSeverity: 'danger',
    })

    expect(state).toEqual({
      visible: true,
      tone: 'danger',
    })
    expect(toTrackingValidationBadgeClasses(state)).toContain('border-tone-danger-border')
    expect(toTrackingValidationBannerClasses(state)).toContain('border-tone-danger-border')
  })
})
