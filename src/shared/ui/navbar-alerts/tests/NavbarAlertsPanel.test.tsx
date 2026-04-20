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
    activeIncidentCount: 1,
    affectedContainerCount: 1,
    dominantSeverity: 'warning',
    latestIncidentAt: '2026-04-10T10:00:00.000Z',
    incidents: [
      {
        incidentKey: 'TRANSSHIPMENT:1:KRPUS:MSC IRIS:MSC BIANCA SILVIA',
        type: 'TRANSSHIPMENT',
        severity: 'warning',
        category: 'movement',
        factMessageKey: 'incidents.fact.transshipmentDetected',
        factMessageParams: {
          port: 'KRPUS',
          fromVessel: 'MSC IRIS',
          toVessel: 'MSC BIANCA SILVIA',
        },
        action: {
          actionKey: 'incidents.action.updateRedestination',
          actionParams: {},
          actionKind: 'UPDATE_REDESTINATION',
        },
        affectedContainerCount: 1,
        triggeredAt: '2026-04-10T10:00:00.000Z',
        containers: [
          {
            containerId: 'container-1',
            containerNumber: 'MSCU1234567',
            lifecycleState: 'ACTIVE',
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
      totalActiveIncidents: 0,
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
    expect(errorHtml).toContain('Falha ao carregar incidentes')
    expect(errorHtml).toContain('Tentar novamente')
    expect(emptyHtml).toContain('Nenhum incidente ativo')
  })

  it('renders process and incident information without deriving semantics in the UI', () => {
    const html = renderPanel({
      totalActiveIncidents: 1,
      processes: [buildProcessAlertGroup()],
    })

    expect(html).toContain('CA048-26')
    expect(html).toContain('MSC')
    expect(html).toContain('Shanghai -> Santos')
    expect(html).toContain('MSCU1234567')
    expect(html).toContain('Transbordo detectado')
    expect(html).toContain('Ação: Atualizar redestinação')
    expect(html).not.toContain('Ação sugerida')
  })
})
