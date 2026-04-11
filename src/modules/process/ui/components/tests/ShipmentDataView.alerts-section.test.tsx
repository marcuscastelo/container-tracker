import { createComponent, renderToString } from 'solid-js/web'
import { describe, expect, it, vi } from 'vitest'
import { ShipmentDataView } from '~/modules/process/ui/components/ShipmentDataView'
import type { TrackingTimeTravelControllerResult } from '~/modules/process/ui/screens/shipment/hooks/useTrackingTimeTravelController'
import type { AlertIncidentsVM } from '~/modules/process/ui/viewmodels/alert-incident.vm'
import type { ShipmentDetailVM } from '~/modules/process/ui/viewmodels/shipment.vm'
import { systemClock } from '~/shared/time/clock'

vi.mock('~/modules/process/ui/components/ContainersPanel', () => ({
  ContainersPanel: () => null,
}))

vi.mock('~/modules/process/ui/components/ShipmentCurrentStatus', () => ({
  ShipmentCurrentStatus: () => null,
}))

vi.mock('~/modules/process/ui/components/ShipmentHeader', () => ({
  ShipmentHeader: () => null,
}))

vi.mock('~/modules/process/ui/components/ShipmentInfoCard', () => ({
  ShipmentInfoCard: () => null,
}))

vi.mock('~/modules/process/ui/components/TimelinePanel', () => ({
  TimelinePanel: () => null,
}))

vi.mock('~/modules/process/ui/screens/shipment/components/TrackingTimeTravelAlertsPanel', () => ({
  TrackingTimeTravelAlertsPanel: () => null,
}))

vi.mock('~/modules/process/ui/screens/shipment/components/TrackingTimeTravelBar', () => ({
  TrackingTimeTravelBar: () => null,
}))

vi.mock('~/modules/process/ui/screens/shipment/components/TrackingTimeTravelDebugPanel', () => ({
  TrackingTimeTravelDebugPanel: () => null,
}))

vi.mock('~/modules/process/ui/screens/shipment/components/TrackingTimeTravelDiffSummary', () => ({
  TrackingTimeTravelDiffSummary: () => null,
}))

vi.mock('~/modules/process/ui/screens/shipment/components/TrackingTimeTravelStatusPanel', () => ({
  TrackingTimeTravelStatusPanel: () => null,
}))

vi.mock('@solidjs/router', () => ({
  // Ignored during testing, as the component under test doesn't rely on actual routing behavior for the scenarios being tested.
  // eslint-disable-next-line solid/reactivity
  A: (props: { readonly children?: unknown }) => props.children ?? null,
  useLocation: () => ({
    pathname: '/',
    search: '',
    hash: '',
    state: null,
    query: {},
  }),
  useNavigate: () => () => undefined,
}))

vi.mock('lucide-solid', () => {
  const StubIcon = () => null

  return {
    __esModule: true,
    Anchor: StubIcon,
    Check: StubIcon,
    Circle: StubIcon,
    CircleDot: StubIcon,
    Clock3: StubIcon,
    Construction: StubIcon,
    Copy: StubIcon,
    Download: StubIcon,
    ExternalLink: StubIcon,
    EyeIcon: StubIcon,
    Hourglass: StubIcon,
    Info: StubIcon,
    LogIn: StubIcon,
    LogOut: StubIcon,
    Minus: StubIcon,
    MoreVertical: StubIcon,
    RefreshCw: StubIcon,
    Repeat: StubIcon,
    RotateCcw: StubIcon,
    Sailboat: StubIcon,
    ShieldAlert: StubIcon,
    ShieldCheck: StubIcon,
    Ship: StubIcon,
    TriangleAlert: StubIcon,
    Truck: StubIcon,
    Upload: StubIcon,
  }
})

const DISABLED_TIME_TRAVEL_CONTROLLER: TrackingTimeTravelControllerResult = {
  isActive: () => false,
  isLoading: () => false,
  errorMessage: () => null,
  value: () => null,
  selectedSync: () => null,
  isDebugOpen: () => false,
  isDebugLoading: () => false,
  debugErrorMessage: () => null,
  debugValue: () => null,
  debugPayload: () => null,
  open: () => undefined,
  close: () => undefined,
  toggleDebug: () => undefined,
  selectSnapshot: () => undefined,
  selectPrevious: () => undefined,
  selectNext: () => undefined,
}

function buildActiveAlertIncidents(): AlertIncidentsVM {
  return {
    summary: {
      activeIncidents: 1,
      affectedContainers: 1,
      recognizedIncidents: 0,
    },
    active: [
      {
        incidentKey: 'TRANSSHIPMENT:1:KRPUS:MSC IRIS:MSC BIANCA SILVIA',
        bucket: 'active',
        category: 'movement',
        type: 'TRANSSHIPMENT',
        severity: 'warning',
        messageKey: 'alerts.transshipmentDetected',
        messageParams: {
          port: 'KRPUS',
          fromVessel: 'MSC IRIS',
          toVessel: 'MSC BIANCA SILVIA',
        },
        detectedAtIso: '2026-02-28T00:00:00.000Z',
        triggeredAtIso: '2026-04-01T10:00:00.000Z',
        transshipmentOrder: 1,
        port: 'KRPUS',
        fromVessel: 'MSC IRIS',
        toVessel: 'MSC BIANCA SILVIA',
        affectedContainerCount: 1,
        activeAlertIds: ['alert-active'],
        ackedAlertIds: [],
        members: [
          {
            containerId: 'container-1',
            containerNumber: 'MSCU1234567',
            lifecycleState: 'ACTIVE',
            detectedAtIso: '2026-02-28T00:00:00.000Z',
            transshipmentOrder: 1,
            port: 'KRPUS',
            fromVessel: 'MSC IRIS',
            toVessel: 'MSC BIANCA SILVIA',
            records: [
              {
                alertId: 'alert-active',
                lifecycleState: 'ACTIVE',
                detectedAtIso: '2026-02-28T00:00:00.000Z',
                triggeredAtIso: '2026-04-01T10:00:00.000Z',
                ackedAtIso: null,
                resolvedAtIso: null,
                resolvedReason: null,
              },
            ],
          },
        ],
      },
    ],
    recognized: [],
  }
}

function buildEmptyAlertIncidents(): AlertIncidentsVM {
  return {
    summary: {
      activeIncidents: 0,
      affectedContainers: 0,
      recognizedIncidents: 0,
    },
    active: [],
    recognized: [],
  }
}

function buildRecognizedOnlyAlertIncidents(): AlertIncidentsVM {
  return {
    summary: {
      activeIncidents: 0,
      affectedContainers: 0,
      recognizedIncidents: 1,
    },
    active: [],
    recognized: [
      {
        incidentKey: 'TRANSSHIPMENT:1:SGSIN:MSC IRIS:MSC BIANCA SILVIA',
        bucket: 'recognized',
        category: 'movement',
        type: 'TRANSSHIPMENT',
        severity: 'warning',
        messageKey: 'alerts.transshipmentDetected',
        messageParams: {
          port: 'SGSIN',
          fromVessel: 'MSC IRIS',
          toVessel: 'MSC BIANCA SILVIA',
        },
        detectedAtIso: '2026-02-28T00:00:00.000Z',
        triggeredAtIso: '2026-04-01T10:00:00.000Z',
        transshipmentOrder: 1,
        port: 'SGSIN',
        fromVessel: 'MSC IRIS',
        toVessel: 'MSC BIANCA SILVIA',
        affectedContainerCount: 1,
        activeAlertIds: [],
        ackedAlertIds: ['alert-recognized'],
        members: [
          {
            containerId: 'container-1',
            containerNumber: 'MSCU1234567',
            lifecycleState: 'ACKED',
            detectedAtIso: '2026-02-28T00:00:00.000Z',
            transshipmentOrder: 1,
            port: 'SGSIN',
            fromVessel: 'MSC IRIS',
            toVessel: 'MSC BIANCA SILVIA',
            records: [
              {
                alertId: 'alert-recognized',
                lifecycleState: 'ACKED',
                detectedAtIso: '2026-02-28T00:00:00.000Z',
                triggeredAtIso: '2026-04-01T10:00:00.000Z',
                ackedAtIso: '2026-04-02T10:00:00.000Z',
                resolvedAtIso: null,
                resolvedReason: null,
              },
            ],
          },
        ],
      },
    ],
  }
}

function buildShipmentDetailVm(alertIncidents: AlertIncidentsVM): ShipmentDetailVM {
  return {
    id: 'process-1',
    trackingFreshnessToken: 'freshness-token',
    processRef: 'REF-1',
    reference: 'REF-1',
    carrier: 'MSC',
    bill_of_lading: null,
    booking_number: null,
    importer_name: 'Importer',
    exporter_name: 'Exporter',
    reference_importer: null,
    depositary: null,
    product: 'Coffee',
    redestination_number: null,
    origin: 'Shanghai',
    destination: 'Santos',
    status: 'blue-500',
    statusCode: 'IN_TRANSIT',
    statusMicrobadge: null,
    eta: '2026-04-10',
    processEtaDisplayVm: {
      kind: 'date',
      date: '2026-04-10',
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
    alertIncidents,
  }
}

function renderShipmentDataView(alertIncidents: AlertIncidentsVM): string {
  const data = buildShipmentDetailVm(alertIncidents)

  return renderToString(() =>
    createComponent(ShipmentDataView, {
      data,
      activeAlerts: [],
      alertIncidents,
      busyAlertIds: new Set<string>(),
      onAcknowledgeAlert: () => undefined,
      onUnacknowledgeAlert: () => undefined,
      onOpenEdit: () => undefined,
      isRefreshing: false,
      refreshRetry: null,
      refreshHint: null,
      syncNow: systemClock.now(),
      onTriggerRefresh: () => undefined,
      selectedContainerId: '',
      onSelectContainer: () => undefined,
      selectedContainer: null,
      trackingTimeTravel: DISABLED_TIME_TRAVEL_CONTROLLER,
    }),
  )
}

describe('ShipmentDataView alerts section visibility', () => {
  it('renders live operational alerts section when active incidents exist', () => {
    const html = renderShipmentDataView(buildActiveAlertIncidents())

    expect(html).toContain('id="shipment-alerts"')
    expect(html).toContain('Alertas Operacionais')
  })

  it('hides live operational alerts section when there are no active or recognized incidents', () => {
    const html = renderShipmentDataView(buildEmptyAlertIncidents())

    expect(html).not.toContain('id="shipment-alerts"')
    expect(html).not.toContain('Nenhum alerta ativo para este embarque.')
  })

  it('hides live operational alerts section when only recognized incidents exist', () => {
    const html = renderShipmentDataView(buildRecognizedOnlyAlertIncidents())

    expect(html).not.toContain('id="shipment-alerts"')
    expect(html).not.toContain('Nenhum alerta ativo para este embarque.')
  })
})
