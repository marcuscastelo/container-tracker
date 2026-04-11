import { describe, expect, it } from 'vitest'
import { toTimelineNodeAttentionDisplay } from '~/modules/process/ui/components/timeline-node.presenter'

describe('timeline-node.presenter', () => {
  it('keeps neutral nodes without emphasis', () => {
    const display = toTimelineNodeAttentionDisplay({
      hasSeriesConflict: false,
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
    })

    expect(display.rowClass).toContain('ring-tone-warning-border/70')
    expect(display.dotAccentClass).toContain('ring-tone-warning-border/45')
    expect(display.showConflictBadge).toBe(true)
  })

  it('keeps series conflict as the only attention state', () => {
    const display = toTimelineNodeAttentionDisplay({
      hasSeriesConflict: true,
    })

    expect(display.rowClass).toContain('ring-tone-warning-border/70')
    expect(display.showConflictBadge).toBe(true)
  })
})
