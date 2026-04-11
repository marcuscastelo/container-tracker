import { createRoot } from 'solid-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NavbarProcessAlertGroupVM } from '~/shared/ui/navbar-alerts/navbar-alerts.vm'

const navigateMock = vi.hoisted(() => vi.fn())
const refreshMock = vi.hoisted(() => vi.fn(async () => undefined))
const navigateToProcessMock = vi.hoisted(() => vi.fn())
const navigateToProcessContainerMock = vi.hoisted(() => vi.fn())

type NavbarAlertsStateSnapshot = {
  readonly totalAlerts: number
  readonly processes: readonly NavbarProcessAlertGroupVM[]
  readonly loading: boolean
  readonly error: string | null
}

const emptyProcesses: readonly NavbarProcessAlertGroupVM[] = []

const navbarAlertsState = vi.hoisted<{
  state: () => NavbarAlertsStateSnapshot
  hasResolved: () => boolean
}>(() => ({
  state: () => ({
    totalAlerts: 0,
    processes: emptyProcesses,
    loading: false,
    error: null,
  }),
  hasResolved: () => false,
}))

vi.mock('solid-js', async () => vi.importActual('solid-js/dist/solid.js'))

vi.mock('@solidjs/router', () => ({
  useNavigate: () => navigateMock,
}))

vi.mock('~/shared/ui/navbar-alerts/useNavbarAlerts', () => ({
  useNavbarAlerts: () => ({
    state: navbarAlertsState.state,
    hasResolved: navbarAlertsState.hasResolved,
    refresh: refreshMock,
  }),
}))

vi.mock('~/shared/ui/navigation/app-navigation', () => ({
  navigateToProcess: navigateToProcessMock,
  navigateToProcessContainer: navigateToProcessContainerMock,
}))

import { useNavbarAlertsButtonController } from '~/shared/ui/navbar-alerts/useNavbarAlertsButtonController'

type ControllerHarness = ReturnType<typeof useNavbarAlertsButtonController> & {
  readonly dispose: () => void
}

function buildProcessAlertGroup(): NavbarProcessAlertGroupVM {
  return {
    processId: 'process-1',
    processReference: 'CA048-26',
    carrier: 'MSC',
    routeSummary: 'Shanghai -> Santos',
    activeAlertsCount: 1,
    dominantSeverity: 'warning',
    latestAlertAt: '2026-04-10T10:00:00.000Z',
    containers: [
      {
        containerId: 'container-1',
        containerNumber: 'MSCU1234567',
        status: 'IN_TRANSIT',
        eta: null,
        activeAlertsCount: 1,
        dominantSeverity: 'warning',
        latestAlertAt: '2026-04-10T10:00:00.000Z',
        alerts: [],
      },
    ],
  }
}

function mountController(): ControllerHarness {
  return createRoot((dispose) => ({
    ...useNavbarAlertsButtonController(),
    dispose,
  }))
}

describe('useNavbarAlertsButtonController', () => {
  beforeEach(() => {
    navigateMock.mockReset()
    refreshMock.mockReset()
    navigateToProcessMock.mockReset()
    navigateToProcessContainerMock.mockReset()
    navbarAlertsState.state = () => ({
      totalAlerts: 0,
      processes: [],
      loading: false,
      error: null,
    })
    navbarAlertsState.hasResolved = () => false
  })

  it('opens the panel and refreshes unresolved data', () => {
    const controller = mountController()

    controller.togglePanel()

    expect(controller.isOpen()).toBe(true)
    expect(refreshMock).toHaveBeenCalledTimes(1)
    controller.dispose()
  })

  it('does not refresh again when data is already resolved and clean', () => {
    navbarAlertsState.hasResolved = () => true
    const controller = mountController()

    controller.togglePanel()

    expect(controller.isOpen()).toBe(true)
    expect(refreshMock).not.toHaveBeenCalled()
    controller.dispose()
  })

  it('keeps the retry action separate from open-close state', () => {
    navbarAlertsState.hasResolved = () => true
    const controller = mountController()

    controller.togglePanel()
    controller.retry()

    expect(controller.isOpen()).toBe(true)
    expect(refreshMock).toHaveBeenCalledTimes(1)
    controller.dispose()
  })

  it('routes dashboard, process, and container actions through navigation helpers', () => {
    navbarAlertsState.state = () => ({
      totalAlerts: 2,
      processes: [buildProcessAlertGroup()],
      loading: false,
      error: 'failed',
    })

    const controller = mountController()
    controller.togglePanel()
    controller.openDashboard()
    controller.openProcess('process-1')
    controller.openContainer('process-1', 'MSCU1234567')
    controller.openContainer('process-1', 'MSCU1234567')

    expect(navigateMock).toHaveBeenCalledWith('/')
    expect(navigateToProcessMock).toHaveBeenCalledWith({
      navigate: navigateMock,
      processId: 'process-1',
    })

    const firstCall = navigateToProcessContainerMock.mock.calls[0]?.[0]
    const secondCall = navigateToProcessContainerMock.mock.calls[1]?.[0]

    expect(firstCall?.navigationState).toEqual({
      source: 'navbar-alerts',
      focusSection: 'current-status',
      revealLiveStatus: true,
      requestKey: 'navbar-alert-1',
    })
    expect(secondCall?.navigationState).toEqual({
      source: 'navbar-alerts',
      focusSection: 'current-status',
      revealLiveStatus: true,
      requestKey: 'navbar-alert-2',
    })
    expect(firstCall?.state).toEqual(firstCall?.navigationState)
    expect(secondCall?.state).toEqual(secondCall?.navigationState)
    controller.dispose()
  })
})
