import { describe, expect, it } from 'vitest'
import { collectVisibleDashboardProcessIds } from '~/modules/process/ui/utils/dashboard-process-visibility.utils'

function createVisibleRow(
  dashboardProcessId: string,
  rect: { readonly top: number; readonly bottom: number },
): {
  readonly dataset: {
    readonly dashboardProcessId: string
  }
  readonly getBoundingClientRect: () => { readonly top: number; readonly bottom: number }
  readonly callCount: () => number
} {
  let calls = 0

  return {
    dataset: {
      dashboardProcessId,
    },
    getBoundingClientRect: () => {
      calls += 1
      return rect
    },
    callCount: () => calls,
  }
}

describe('collectVisibleDashboardProcessIds', () => {
  it('stops scanning rows once they are past the viewport', () => {
    const visibleRow = createVisibleRow('process-visible', { top: 120, bottom: 160 })
    const pastViewportRow = createVisibleRow('process-past-viewport', {
      top: 1000,
      bottom: 1040,
    })
    const trailingRow = createVisibleRow('process-trailing', { top: 1100, bottom: 1140 })

    const container = {
      querySelectorAll: () => [visibleRow, pastViewportRow, trailingRow],
    }

    expect(collectVisibleDashboardProcessIds(container, 300)).toEqual(['process-visible'])
    expect(visibleRow.callCount()).toBe(1)
    expect(pastViewportRow.callCount()).toBe(1)
    expect(trailingRow.callCount()).toBe(0)
  })
})
