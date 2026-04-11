import { describe, expect, it } from 'vitest'
import { toTimelineNodeAttentionDisplay } from '~/modules/process/ui/components/timeline-node.presenter'

describe('timeline-node.presenter', () => {
  it('keeps neutral nodes without emphasis', () => {
    const display = toTimelineNodeAttentionDisplay({
      hasSeriesConflict: false,
      hasValidationWarning: false,
    })

    expect(display).toEqual({
      rowClass: '',
      dotAccentClass: '',
      showConflictBadge: false,
    })
    expect(display.rowClass).not.toContain('bg-tone-warning-bg/60')
  })

  it('returns warning emphasis for series conflicts', () => {
    const display = toTimelineNodeAttentionDisplay({
      hasSeriesConflict: true,
      hasValidationWarning: false,
    })

    expect(display.rowClass).toContain('ring-tone-warning-border/70')
    expect(display.dotAccentClass).toContain('ring-tone-warning-border/45')
    expect(display.showConflictBadge).toBe(true)
  })

  it('keeps validation-only seam inert until backend anchor exists', () => {
    const display = toTimelineNodeAttentionDisplay({
      hasSeriesConflict: false,
      hasValidationWarning: true,
    })

    expect(display).toEqual({
      rowClass: '',
      dotAccentClass: '',
      showConflictBadge: false,
    })
  })

  it('prioritizes series conflict over future validation emphasis', () => {
    const display = toTimelineNodeAttentionDisplay({
      hasSeriesConflict: true,
      hasValidationWarning: true,
    })

    expect(display.rowClass).toContain('ring-tone-warning-border/70')
    expect(display.showConflictBadge).toBe(true)
  })
})
