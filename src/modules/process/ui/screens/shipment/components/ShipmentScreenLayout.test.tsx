import { createComponent } from 'solid-js'
import { renderToString } from 'solid-js/web'
import { describe, expect, it, vi } from 'vitest'
import { ShipmentScreenLayout } from '~/modules/process/ui/screens/shipment/components/ShipmentScreenLayout'
import type { ShipmentDetailVM } from '~/modules/process/ui/viewmodels/shipment.vm'

vi.mock('@solidjs/router', () => ({
  A: (props: { readonly children?: unknown }) => <>{props.children}</>,
}))

vi.mock('~/shared/ui/AppHeader', () => ({
  AppHeader: () => <header>App header</header>,
}))

function renderLayout(command: {
  readonly data: ShipmentDetailVM | null | undefined
  readonly loading: boolean
  readonly error: unknown
  readonly content?: string
}): string {
  return renderToString(() =>
    createComponent(ShipmentScreenLayout, {
      shipmentData: () => command.data,
      shipmentLoading: () => command.loading,
      shipmentError: () => command.error,
      onOpenCreateProcess: () => undefined,
      onDashboardIntent: () => undefined,
      preserveDashboardScroll: false,
      banners: <div>banner slot</div>,
      dialogs: <div>dialog slot</div>,
      content: <section>{command.content ?? 'timeline-first content'}</section>,
    }),
  )
}

describe('ShipmentScreenLayout', () => {
  it('renders the loading skeleton before shipment data exists', () => {
    const html = renderLayout({
      data: undefined,
      loading: true,
      error: undefined,
    })

    expect(html).toContain('shipment-container-skeleton-1')
    expect(html).not.toContain('timeline-first content')
  })

  it('renders explicit error and not-found states instead of stale content', () => {
    const errorHtml = renderLayout({
      data: undefined,
      loading: false,
      error: new Error('load failed'),
    })
    const notFoundHtml = renderLayout({
      data: null,
      loading: false,
      error: undefined,
    })

    expect(errorHtml).toContain('Falha ao carregar detalhes do processo')
    expect(errorHtml).not.toContain('timeline-first content')
    expect(notFoundHtml).toContain('Processo não encontrado')
    expect(notFoundHtml).not.toContain('timeline-first content')
  })

  it('renders provided shipment content only when ready', () => {
    const html = renderLayout({
      data: {
        id: 'process-1',
        trackingFreshnessToken: 'freshness-1',
        processRef: 'REF-1',
        origin: 'Shanghai',
        destination: 'Santos',
        status: 'in-transit',
        statusCode: 'IN_TRANSIT',
        statusMicrobadge: null,
        eta: null,
        processEtaDisplayVm: {
          kind: 'unavailable',
        },
        processEtaSecondaryVm: {
          visible: false,
          date: null,
          withEta: 0,
          total: 0,
          incomplete: false,
        },
        trackingValidation: {
          hasIssues: false,
          highestSeverity: null,
          affectedContainerCount: 0,
          topIssue: null,
        },
        containers: [],
        alerts: [],
        alertIncidents: {
          summary: {
            activeIncidents: 0,
            affectedContainers: 0,
            recognizedIncidents: 0,
          },
          active: [],
          recognized: [],
        },
      },
      loading: false,
      error: undefined,
      content: 'container selector before timeline',
    })

    expect(html).toContain('container selector before timeline')
    expect(html).not.toContain('shipment-container-skeleton-1')
  })
})
