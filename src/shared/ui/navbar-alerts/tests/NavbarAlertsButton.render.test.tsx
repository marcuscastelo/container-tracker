import { createComponent } from 'solid-js'
import { renderToString } from 'solid-js/web'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NavbarProcessAlertGroupVM } from '~/shared/ui/navbar-alerts/navbar-alerts.vm'

type NavbarControllerStub = {
  isOpen: () => boolean
  totalActiveIncidents: () => number
  state: () => {
    totalActiveIncidents: number
    processes: readonly NavbarProcessAlertGroupVM[]
    loading: boolean
    error: string | null
  }
  togglePanel: ReturnType<typeof vi.fn>
  closePanel: ReturnType<typeof vi.fn>
  retry: ReturnType<typeof vi.fn>
  openDashboard: ReturnType<typeof vi.fn>
  openProcess: ReturnType<typeof vi.fn>
  openContainer: ReturnType<typeof vi.fn>
  buttonTitle: () => string
}

const emptyProcesses: readonly NavbarProcessAlertGroupVM[] = []

const controllerState = vi.hoisted<NavbarControllerStub>(() => ({
  isOpen: () => false,
  totalActiveIncidents: () => 0,
  state: () => ({
    totalActiveIncidents: 0,
    processes: emptyProcesses,
    loading: false,
    error: null,
  }),
  togglePanel: vi.fn(),
  closePanel: vi.fn(),
  retry: vi.fn(),
  openDashboard: vi.fn(),
  openProcess: vi.fn(),
  openContainer: vi.fn(),
  buttonTitle: () => 'No alerts',
}))

vi.mock('~/shared/ui/navbar-alerts/useNavbarAlertsButtonController', () => ({
  useNavbarAlertsButtonController: () => controllerState,
}))

vi.mock('~/shared/ui/navbar-alerts/NavbarAlertsPanel', () => ({
  NavbarAlertsPanel: (props: {
    readonly panelId: string
    readonly totalActiveIncidents: number
    readonly loading: boolean
    readonly error: string | null
  }) => (
    <div>
      panel:{props.panelId}:{props.totalActiveIncidents}:{String(props.loading)}:
      {props.error ?? 'none'}
    </div>
  ),
}))

import { NavbarAlertsButton } from '~/shared/ui/navbar-alerts/NavbarAlertsButton'

function normalizeSsrHtml(html: string): string {
  return html.replaceAll('<!--$-->', '').replaceAll('<!--/-->', '')
}

describe('NavbarAlertsButton render', () => {
  beforeEach(() => {
    controllerState.isOpen = () => false
    controllerState.totalActiveIncidents = () => 0
    controllerState.state = () => ({
      totalActiveIncidents: 0,
      processes: emptyProcesses,
      loading: false,
      error: null,
    })
    controllerState.buttonTitle = () => 'No alerts'
  })

  it('renders the closed badge state', () => {
    const html = normalizeSsrHtml(renderToString(() => createComponent(NavbarAlertsButton, {})))

    expect(html).toContain('aria-expanded="false"')
    expect(html).toContain('>0<')
    expect(html).not.toContain('panel:')
  })

  it('renders the open panel state with forwarded alert data', () => {
    controllerState.isOpen = () => true
    controllerState.totalActiveIncidents = () => 3
    controllerState.state = () => ({
      totalActiveIncidents: 3,
      processes: [],
      loading: true,
      error: 'failed',
    })
    controllerState.buttonTitle = () => '3 alerts active'

    const html = normalizeSsrHtml(renderToString(() => createComponent(NavbarAlertsButton, {})))

    expect(html).toContain('aria-expanded="true"')
    expect(html).toContain('>3<')
    expect(html).toContain('panel:navbar-alerts-panel:3:true:failed')
  })
})
