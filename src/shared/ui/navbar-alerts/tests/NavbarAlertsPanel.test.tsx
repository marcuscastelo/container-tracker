import { createComponent } from 'solid-js'
import { renderToString } from 'solid-js/web'
import { describe, expect, it } from 'vitest'
import { NavbarAlertsPanel } from '~/shared/ui/navbar-alerts/NavbarAlertsPanel'
import type { NavbarProcessAlertGroupVM } from '~/shared/ui/navbar-alerts/navbar-alerts.vm'

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
        eta: {
          kind: 'date',
          value: '2026-04-20',
          timezone: 'UTC',
        },
        activeAlertsCount: 1,
        dominantSeverity: 'warning',
        latestAlertAt: '2026-04-10T10:00:00.000Z',
        alerts: [
          {
            alertId: 'alert-1',
            severity: 'warning',
            category: 'fact',
            messageKey: 'alerts.transshipmentDetected',
            messageParams: {
              port: 'KRPUS',
              fromVessel: 'MSC IRIS',
              toVessel: 'MSC BIANCA SILVIA',
            },
            occurredAt: '2026-04-10T10:00:00.000Z',
            retroactive: true,
          },
        ],
      },
    ],
  }
}

function renderPanel(overrides: Partial<Parameters<typeof NavbarAlertsPanel>[0]>): string {
  return renderToString(() =>
    createComponent(NavbarAlertsPanel, {
      panelId: 'alerts-panel',
      totalAlerts: 0,
      processes: [],
      loading: false,
      error: null,
      onRetry: () => undefined,
      onClose: () => undefined,
      onOpenDashboard: () => undefined,
      onOpenProcess: () => undefined,
      onOpenContainer: () => undefined,
      ...overrides,
    }),
  )
}

describe('NavbarAlertsPanel', () => {
  it('renders loading, error, and empty states explicitly', () => {
    const loadingHtml = renderPanel({
      loading: true,
    })
    const errorHtml = renderPanel({
      error: 'failed',
    })
    const emptyHtml = renderPanel({})

    expect(loadingHtml).toContain('animate-pulse')
    expect(errorHtml).toContain('Falha ao carregar alertas')
    expect(errorHtml).toContain('Tentar novamente')
    expect(emptyHtml).toContain('Nenhum alerta ativo')
  })

  it('renders process, container and retroactive alert information without deriving alert meaning', () => {
    const html = renderPanel({
      totalAlerts: 1,
      processes: [buildProcessAlertGroup()],
    })

    expect(html).toContain('CA048-26')
    expect(html).toContain('MSC')
    expect(html).toContain('Shanghai -> Santos')
    expect(html).toContain('MSCU1234567')
    expect(html).toContain('Transbordo detectado em KRPUS')
    expect(html).toContain('Retroativo')
  })
})
