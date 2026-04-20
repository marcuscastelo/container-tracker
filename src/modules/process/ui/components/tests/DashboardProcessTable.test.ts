import { describe, expect, it } from 'vitest'
import { toDashboardProcessRowClass } from '~/modules/process/ui/utils/dashboard-process-row-style'

describe('toDashboardProcessRowClass', () => {
  it('keeps the severity bar class while adding highlighted row treatment', () => {
    const className = toDashboardProcessRowClass({
      severity: 'danger',
      isHighlighted: true,
    })

    expect(className).toContain('bg-primary/5')
    expect(className).toContain('outline-primary/25')
    expect(className).toContain('[box-shadow:inset_4px_0_0_0_var(--color-tone-danger-strong)]')
  })

  it('returns the default row background when the process is not highlighted', () => {
    const className = toDashboardProcessRowClass({
      severity: 'none',
      isHighlighted: false,
    })

    expect(className).toContain('bg-surface')
    expect(className).toContain('hover:bg-surface-muted')
    expect(className).not.toContain('outline-primary/25')
  })
})
