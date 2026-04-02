import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  clearDashboardNavigationState,
  readDashboardNavigationState,
  resolveHighlightedDashboardProcessId,
  restoreDashboardScrollPosition,
  saveDashboardNavigationState,
} from '~/modules/process/ui/utils/dashboard-navigation-state'

class MockDashboardNavigationWindow {
  scrollY: number
  readonly scrollTo = vi.fn()

  constructor(scrollY: number) {
    this.scrollY = scrollY
  }
}

afterEach(() => {
  clearDashboardNavigationState()
})

describe('dashboard-navigation-state', () => {
  it('saves and reads the current dashboard scroll position and last opened process', () => {
    const dashboardWindow = new MockDashboardNavigationWindow(420)

    saveDashboardNavigationState({
      lastOpenedProcessId: ' process-42 ',
      environment: {
        window: dashboardWindow,
      },
    })

    expect(readDashboardNavigationState()).toEqual({
      lastOpenedProcessId: 'process-42',
      scrollY: 420,
    })
  })

  it('clamps negative scroll values and clears previous state when process id is blank', () => {
    saveDashboardNavigationState({
      lastOpenedProcessId: 'process-42',
      environment: {
        window: new MockDashboardNavigationWindow(-10),
      },
    })

    expect(readDashboardNavigationState()).toEqual({
      lastOpenedProcessId: 'process-42',
      scrollY: 0,
    })

    saveDashboardNavigationState({
      lastOpenedProcessId: '   ',
    })

    expect(readDashboardNavigationState()).toBeNull()
  })

  it('restores scroll from saved dashboard state and reports no-op when state or window is missing', () => {
    const dashboardWindow = new MockDashboardNavigationWindow(0)

    expect(
      restoreDashboardScrollPosition({
        state: {
          lastOpenedProcessId: 'process-42',
          scrollY: 640,
        },
        environment: {
          window: dashboardWindow,
        },
      }),
    ).toBe(true)
    expect(dashboardWindow.scrollTo).toHaveBeenCalledWith(0, 640)

    expect(
      restoreDashboardScrollPosition({
        state: null,
        environment: {
          window: dashboardWindow,
        },
      }),
    ).toBe(false)

    expect(
      restoreDashboardScrollPosition({
        state: {
          lastOpenedProcessId: 'process-42',
          scrollY: 640,
        },
        environment: {},
      }),
    ).toBe(false)
  })

  it('highlights only the last opened process when it still exists in the visible rows', () => {
    expect(
      resolveHighlightedDashboardProcessId({
        processes: [{ id: 'process-1' }, { id: 'process-2' }],
        lastOpenedProcessId: 'process-2',
      }),
    ).toBe('process-2')

    expect(
      resolveHighlightedDashboardProcessId({
        processes: [{ id: 'process-1' }],
        lastOpenedProcessId: 'process-2',
      }),
    ).toBeNull()

    expect(
      resolveHighlightedDashboardProcessId({
        processes: [{ id: 'process-1' }],
        lastOpenedProcessId: null,
      }),
    ).toBeNull()
  })
})
