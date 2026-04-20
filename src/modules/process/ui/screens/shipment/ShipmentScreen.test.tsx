import { createComponent, createMemo } from 'solid-js'
import { renderToString } from 'solid-js/web'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AlertDisplayVM } from '~/modules/process/ui/viewmodels/alert.vm'
import type { ShipmentDetailVM } from '~/modules/process/ui/viewmodels/shipment.vm'

const locationState = vi.hoisted(() => ({
  search: '?container=mscu7654321',
  state: null,
}))
const navigateMock = vi.hoisted(() => vi.fn())
const preloadRouteMock = vi.hoisted(() => vi.fn())
const useShipmentScreenResourceMock = vi.hoisted(() => vi.fn())
const useShipmentSelectedContainerMock = vi.hoisted(() => vi.fn())
const useTrackingTimeTravelControllerMock = vi.hoisted(() => vi.fn())
const useShipmentRefreshControllerMock = vi.hoisted(() => vi.fn())
const useShipmentDialogsControllerMock = vi.hoisted(() => vi.fn())
const useShipmentAlertActionsControllerMock = vi.hoisted(() => vi.fn())
const useShipmentAlertNavigationMock = vi.hoisted(() => vi.fn())
const scheduleDashboardPrefetchMock = vi.hoisted(() => vi.fn())
const prefetchDashboardDataMock = vi.hoisted(() => vi.fn())
const hasDashboardNavigationStateMock = vi.hoisted(() => vi.fn(() => true))

type ShipmentContainersViewProps = {
  readonly activeAlerts: () => readonly AlertDisplayVM[]
  readonly alertIncidents: () => ShipmentDetailVM['alertIncidents']
  readonly selectedContainerId: () => string
  readonly onAcknowledgeAlert: (alertIds: readonly string[]) => void
  readonly onUnacknowledgeAlert: (alertIds: readonly string[]) => void
  readonly onTriggerRefresh: () => void
  readonly onSelectContainer: (id: string) => void
  readonly onOpenEditForShipment: (
    shipment: ShipmentDetailVM,
    focus?: 'reference' | 'carrier' | null | undefined,
  ) => void
}

type ShipmentScreenLayoutProps = {
  readonly preserveDashboardScroll: boolean
  readonly onOpenCreateProcess: () => void
  readonly onDashboardIntent: () => void
  readonly actionsSlot: import('solid-js').JSX.Element
  readonly banners: import('solid-js').JSX.Element
  readonly dialogs: import('solid-js').JSX.Element
  readonly content: import('solid-js').JSX.Element
}

const capturedShipmentInteractions = vi.hoisted<{
  openCreate: (() => () => void) | undefined
  dashboardIntent: (() => () => void) | undefined
  selectContainer: (() => (id: string) => void) | undefined
  triggerRefresh: (() => () => void) | undefined
  acknowledgeAlerts: (() => (alertIds: readonly string[]) => void) | undefined
  unacknowledgeAlerts: (() => (alertIds: readonly string[]) => void) | undefined
  openEditForShipment:
    | (() => (
        shipment: ShipmentDetailVM,
        focus?: 'reference' | 'carrier' | null | undefined,
      ) => void)
    | undefined
}>(() => ({
  openCreate: undefined,
  dashboardIntent: undefined,
  selectContainer: undefined,
  triggerRefresh: undefined,
  acknowledgeAlerts: undefined,
  unacknowledgeAlerts: undefined,
  openEditForShipment: undefined,
}))

vi.mock('@solidjs/router', () => ({
  useLocation: () => locationState,
  useNavigate: () => navigateMock,
  usePreloadRoute: () => preloadRouteMock,
}))

vi.mock('~/modules/process/ui/api/process.api', () => ({
  prefetchDashboardData: prefetchDashboardDataMock,
}))

vi.mock('~/modules/process/ui/screens/shipment/hooks/useShipmentScreenResource', () => ({
  useShipmentScreenResource: useShipmentScreenResourceMock,
}))

vi.mock('~/modules/process/ui/screens/shipment/hooks/useShipmentSelectedContainer', () => ({
  useShipmentSelectedContainer: useShipmentSelectedContainerMock,
}))

vi.mock('~/modules/process/ui/screens/shipment/hooks/useTrackingTimeTravelController', () => ({
  useTrackingTimeTravelController: useTrackingTimeTravelControllerMock,
}))

vi.mock('~/modules/process/ui/screens/shipment/hooks/useShipmentRefreshController', () => ({
  useShipmentRefreshController: useShipmentRefreshControllerMock,
}))

vi.mock('~/modules/process/ui/screens/shipment/hooks/useShipmentDialogsController', () => ({
  useShipmentDialogsController: useShipmentDialogsControllerMock,
}))

vi.mock('~/modules/process/ui/screens/shipment/hooks/useShipmentAlertActionsController', () => ({
  useShipmentAlertActionsController: useShipmentAlertActionsControllerMock,
}))

vi.mock('~/modules/process/ui/screens/shipment/hooks/useShipmentAlertNavigation', () => ({
  useShipmentAlertNavigation: useShipmentAlertNavigationMock,
}))

vi.mock('~/modules/process/ui/utils/dashboard-navigation-state', () => ({
  hasDashboardNavigationState: hasDashboardNavigationStateMock,
}))

vi.mock('~/shared/ui/navigation/app-navigation', () => ({
  readProcessContainerNavigationState: vi.fn(() => null),
  readProcessContainerNavigationStateFromSearch: vi.fn(() => null),
  scheduleDashboardPrefetch: scheduleDashboardPrefetchMock,
}))

vi.mock('~/modules/process/ui/components/export-import/ExportImportActions', () => ({
  ExportImportActions: (props: {
    readonly processId: string | null
    readonly showImport: boolean
  }) => (
    <div>
      export-import:{props.processId ?? 'null'}:{String(props.showImport)}
    </div>
  ),
}))

vi.mock('~/modules/process/ui/screens/shipment/components/ShipmentRefreshStatusView', () => ({
  ShipmentRefreshStatusView: (props: { readonly refreshError: () => string | null }) => (
    <div>refresh-status:{props.refreshError() ?? 'none'}</div>
  ),
}))

vi.mock('~/modules/process/ui/screens/shipment/components/ShipmentAlertActionFeedback', () => ({
  ShipmentAlertActionFeedback: (props: { readonly alertActionError: () => string | null }) => (
    <div>alert-feedback:{props.alertActionError() ?? 'none'}</div>
  ),
}))

vi.mock('~/modules/process/ui/screens/shipment/components/ShipmentDialogsHost', () => ({
  ShipmentDialogsHost: (props: {
    readonly isEditOpen: () => boolean
    readonly isCreateDialogOpen: () => boolean
  }) => (
    <div>
      dialogs:{String(props.isEditOpen())}:{String(props.isCreateDialogOpen())}
    </div>
  ),
}))

vi.mock('~/modules/process/ui/screens/shipment/components/ShipmentContainersView', () => ({
  ShipmentContainersView: (props: ShipmentContainersViewProps) => {
    capturedShipmentInteractions.selectContainer = createMemo(() => props.onSelectContainer)
    capturedShipmentInteractions.triggerRefresh = createMemo(() => props.onTriggerRefresh)
    capturedShipmentInteractions.acknowledgeAlerts = createMemo(() => props.onAcknowledgeAlert)
    capturedShipmentInteractions.unacknowledgeAlerts = createMemo(() => props.onUnacknowledgeAlert)
    capturedShipmentInteractions.openEditForShipment = createMemo(() => props.onOpenEditForShipment)

    return (
      <div>
        containers:{props.selectedContainerId()}:{props.activeAlerts().length}:
        {props.alertIncidents().summary.activeIncidents}
      </div>
    )
  },
}))

vi.mock('~/modules/process/ui/screens/shipment/components/ShipmentScreenLayout', () => ({
  ShipmentScreenLayout: (props: ShipmentScreenLayoutProps) => {
    capturedShipmentInteractions.openCreate = createMemo(() => props.onOpenCreateProcess)
    capturedShipmentInteractions.dashboardIntent = createMemo(() => props.onDashboardIntent)

    return (
      <div>
        layout:{String(props.preserveDashboardScroll)}
        {props.actionsSlot}
        {props.banners}
        {props.dialogs}
        {props.content}
      </div>
    )
  },
}))

import { ShipmentScreen } from '~/modules/process/ui/screens/shipment/ShipmentScreen'

function normalizeSsrHtml(html: string): string {
  return html.replaceAll('<!--$-->', '').replaceAll('<!--/-->', '')
}

function buildShipment(): ShipmentDetailVM {
  return {
    id: 'process-1',
    trackingFreshnessToken: 'freshness-1',
    processRef: 'REF-1',
    reference: 'REF-1',
    carrier: 'MSC',
    bill_of_lading: null,
    booking_number: null,
    importer_name: null,
    exporter_name: null,
    reference_importer: null,
    depositary: null,
    product: null,
    redestination_number: null,
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
      total: 1,
      incomplete: false,
    },
    trackingValidation: {
      hasIssues: false,
      highestSeverity: null,
      affectedContainerCount: 0,
      topIssue: null,
    },
    containers: [],
    alerts: [
      {
        id: 'alert-1',
        type: 'info',
        severity: 'warning',
        containerNumber: 'MSCU7654321',
        messageKey: 'alerts.transshipmentDetected',
        messageParams: {
          port: 'KRPUS',
          fromVessel: 'MSC IRIS',
          toVessel: 'MSC BIANCA SILVIA',
        },
        timestamp: '2026-04-10T10:00:00.000Z',
        triggeredAtIso: '2026-04-10T10:00:00.000Z',
        ackedAtIso: null,
        lifecycleState: 'ACTIVE',
        category: 'fact',
        retroactive: false,
      },
    ],
    alertIncidents: {
      summary: {
        activeIncidents: 1,
        affectedContainers: 1,
        recognizedIncidents: 0,
      },
      active: [],
      recognized: [],
    },
  }
}

function buildHookState() {
  const shipment = buildShipment()
  return {
    resource: {
      shipment: (): ShipmentDetailVM | null | undefined => shipment,
      latestShipment: (): ShipmentDetailVM | null | undefined => shipment,
      loading: () => false,
      error: () => null,
      refetch: vi.fn(),
      mutate: vi.fn(),
      processResourceKey: () => ['process-1', 'pt-BR'] as const,
      reconcileTrackingView: vi.fn(() => Promise.resolve()),
    },
    selection: {
      selectedContainerId: () => 'container-1',
      setSelectedContainerId: vi.fn(),
      selectedContainer: () => null,
      selectedContainerEtaVm: () => null,
    },
    trackingTimeTravel: {
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
      open: vi.fn(),
      close: vi.fn(),
      toggleDebug: vi.fn(),
      selectSnapshot: vi.fn(),
      selectPrevious: vi.fn(),
      selectNext: vi.fn(),
    },
    refresh: {
      isRefreshing: () => false,
      refreshRetry: () => null,
      refreshError: () => 'refresh failed',
      refreshHint: () => null,
      syncNow: () => ({ toIsoString: () => '2026-04-10T10:00:00.000Z' }),
      triggerRefresh: vi.fn(() => Promise.resolve()),
      clearRefreshError: vi.fn(),
      resetRefreshState: vi.fn(),
      cleanupRealtime: vi.fn(),
    },
    dialogs: {
      openCreateDialog: vi.fn(),
      isEditOpen: () => true,
      closeEditDialog: vi.fn(),
      editInitialData: () => null,
      focusFieldOnOpen: () => null,
      handleEditSubmit: vi.fn(() => Promise.resolve()),
      isCreateDialogOpen: () => false,
      closeCreateDialog: vi.fn(),
      handleCreateSubmit: vi.fn(() => Promise.resolve()),
      hasCreateError: () => false,
      createErrorMessage: () => null,
      createErrorExisting: () => false,
      clearCreateError: vi.fn(),
      openEditForShipment: vi.fn(),
    },
    alertActions: {
      busyAlertIds: () => new Set<string>(),
      acknowledgeAlerts: vi.fn(),
      unacknowledgeAlerts: vi.fn(),
      alertActionError: () => 'ack failed',
      clearAlertActionError: vi.fn(),
    },
  }
}

describe('ShipmentScreen', () => {
  beforeEach(() => {
    const state = buildHookState()
    useShipmentScreenResourceMock.mockReturnValue(state.resource)
    useShipmentSelectedContainerMock.mockReturnValue(state.selection)
    useTrackingTimeTravelControllerMock.mockReturnValue(state.trackingTimeTravel)
    useShipmentRefreshControllerMock.mockReturnValue(state.refresh)
    useShipmentDialogsControllerMock.mockReturnValue(state.dialogs)
    useShipmentAlertActionsControllerMock.mockReturnValue(state.alertActions)
    useShipmentAlertNavigationMock.mockReset()
    prefetchDashboardDataMock.mockReset()
    scheduleDashboardPrefetchMock.mockReset()
    capturedShipmentInteractions.openCreate = undefined
    capturedShipmentInteractions.dashboardIntent = undefined
    capturedShipmentInteractions.selectContainer = undefined
    capturedShipmentInteractions.triggerRefresh = undefined
    capturedShipmentInteractions.acknowledgeAlerts = undefined
    capturedShipmentInteractions.unacknowledgeAlerts = undefined
    capturedShipmentInteractions.openEditForShipment = undefined
  })

  it('wires shipment hooks and passes rendered slots into the layout', () => {
    const html = normalizeSsrHtml(
      renderToString(() =>
        createComponent(ShipmentScreen, {
          processId: () => 'process-1',
          searchSlot: <div>search-slot</div>,
        }),
      ),
    )

    expect(useShipmentScreenResourceMock).toHaveBeenCalled()
    expect(useShipmentSelectedContainerMock).toHaveBeenCalled()
    expect(useShipmentSelectedContainerMock.mock.calls[0]?.[0].preferredContainerNumber()).toBe(
      'MSCU7654321',
    )
    expect(useShipmentAlertNavigationMock).toHaveBeenCalled()
    expect(html).toContain('layout:true')
    expect(html).toContain('export-import:process-1:false')
    expect(html).toContain('refresh-status:refresh failed')
    expect(html).toContain('alert-feedback:ack failed')
    expect(html).toContain('dialogs:true:false')
    expect(html).toContain('containers:container-1:1:1')
  })

  it('falls back to empty alert incident summary when shipment data is unavailable', () => {
    const state = buildHookState()
    state.resource.latestShipment = () => null
    state.resource.shipment = () => null
    useShipmentScreenResourceMock.mockReturnValue(state.resource)

    const html = normalizeSsrHtml(
      renderToString(() =>
        createComponent(ShipmentScreen, {
          processId: () => 'process-2',
        }),
      ),
    )

    expect(html).toContain('containers:container-1:0:0')
  })

  it('forwards dashboard and container actions to the appropriate controllers', async () => {
    const state = buildHookState()
    useShipmentScreenResourceMock.mockReturnValue(state.resource)
    useShipmentSelectedContainerMock.mockReturnValue(state.selection)
    useTrackingTimeTravelControllerMock.mockReturnValue(state.trackingTimeTravel)
    useShipmentRefreshControllerMock.mockReturnValue(state.refresh)
    useShipmentDialogsControllerMock.mockReturnValue(state.dialogs)
    useShipmentAlertActionsControllerMock.mockReturnValue(state.alertActions)

    renderToString(() =>
      createComponent(ShipmentScreen, {
        processId: () => 'process-1',
      }),
    )

    capturedShipmentInteractions.openCreate?.()()
    capturedShipmentInteractions.dashboardIntent?.()()
    capturedShipmentInteractions.selectContainer?.()('container-2')
    capturedShipmentInteractions.triggerRefresh?.()()
    capturedShipmentInteractions.acknowledgeAlerts?.()(['alert-1'])
    capturedShipmentInteractions.unacknowledgeAlerts?.()(['alert-1'])

    const shipment = state.resource.latestShipment()
    if (shipment) {
      capturedShipmentInteractions.openEditForShipment?.()(shipment, 'carrier')
    }

    expect(state.dialogs.openCreateDialog).toHaveBeenCalledTimes(1)
    expect(scheduleDashboardPrefetchMock).toHaveBeenCalledTimes(1)
    expect(scheduleDashboardPrefetchMock.mock.calls[0]?.[0].priority).toBe('intent')

    await scheduleDashboardPrefetchMock.mock.calls[0]?.[0].preloadData()

    expect(prefetchDashboardDataMock).toHaveBeenCalledWith({
      windowSize: 6,
    })
    expect(state.selection.setSelectedContainerId).toHaveBeenCalledWith('container-2')
    expect(state.refresh.triggerRefresh).toHaveBeenCalledTimes(1)
    expect(state.alertActions.acknowledgeAlerts).toHaveBeenCalledWith(['alert-1'])
    expect(state.alertActions.unacknowledgeAlerts).toHaveBeenCalledWith(['alert-1'])
    expect(state.dialogs.openEditForShipment).toHaveBeenCalledWith(shipment, 'carrier')
  })
})
