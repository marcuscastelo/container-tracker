import { useLocation, useNavigate, usePreloadRoute } from '@solidjs/router'
import type { Accessor, JSX } from 'solid-js'
import { createEffect, createMemo } from 'solid-js'
import { prefetchDashboardData } from '~/modules/process/ui/api/process.api'
import { ExportImportActions } from '~/modules/process/ui/components/export-import/ExportImportActions'
import { ShipmentAlertActionFeedback } from '~/modules/process/ui/screens/shipment/components/ShipmentAlertActionFeedback'
import { ShipmentContainersView } from '~/modules/process/ui/screens/shipment/components/ShipmentContainersView'
import { ShipmentDialogsHost } from '~/modules/process/ui/screens/shipment/components/ShipmentDialogsHost'
import { ShipmentRefreshStatusView } from '~/modules/process/ui/screens/shipment/components/ShipmentRefreshStatusView'
import { ShipmentScreenLayout } from '~/modules/process/ui/screens/shipment/components/ShipmentScreenLayout'
import { useShipmentAlertActionsController } from '~/modules/process/ui/screens/shipment/hooks/useShipmentAlertActionsController'
import { useShipmentAlertNavigation } from '~/modules/process/ui/screens/shipment/hooks/useShipmentAlertNavigation'
import { useShipmentDialogsController } from '~/modules/process/ui/screens/shipment/hooks/useShipmentDialogsController'
import { useShipmentRefreshController } from '~/modules/process/ui/screens/shipment/hooks/useShipmentRefreshController'
import { useShipmentScreenResource } from '~/modules/process/ui/screens/shipment/hooks/useShipmentScreenResource'
import { useShipmentSelectedContainer } from '~/modules/process/ui/screens/shipment/hooks/useShipmentSelectedContainer'
import { useTrackingTimeTravelController } from '~/modules/process/ui/screens/shipment/hooks/useTrackingTimeTravelController'
import {
  toSortedActiveAlerts,
  toSortedArchivedAlerts,
} from '~/modules/process/ui/screens/shipment/lib/shipmentAlerts.sorting'
import { normalizeSelectedContainerNumber } from '~/modules/process/ui/screens/shipment/lib/shipmentContainerSelection'
import { resolveDashboardChartWindowSize } from '~/modules/process/ui/utils/dashboard-chart-window-size'
import type { AlertDisplayVM } from '~/modules/process/ui/viewmodels/alert.vm'
import { useTranslation } from '~/shared/localization/i18n'
import {
  readProcessContainerNavigationState,
  readProcessContainerNavigationStateFromSearch,
  scheduleDashboardPrefetch,
} from '~/shared/ui/navigation/app-navigation'

type ShipmentScreenProps = {
  readonly processId: Accessor<string>
  readonly searchSlot?: JSX.Element
}

export function ShipmentScreen(props: ShipmentScreenProps) {
  const { locale } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const preloadRoute = usePreloadRoute()

  // props.processId is already an Accessor<string>; no extra createMemo indirection required
  const processId = () => props.processId()
  const processContainerNavigationState = createMemo(() => {
    const searchState = readProcessContainerNavigationStateFromSearch(location.search)
    if (searchState !== null) return searchState
    return readProcessContainerNavigationState(location.state)
  })

  const preferredContainerNumber = createMemo(() =>
    normalizeSelectedContainerNumber(new URLSearchParams(location.search).get('container')),
  )

  // ── Resource ───────────────────────────────────────────────────────────────
  const resource = useShipmentScreenResource({
    processId,
    locale,
  })

  // ── Selected container ─────────────────────────────────────────────────────
  const selection = useShipmentSelectedContainer({
    shipment: resource.latestShipment,
    preferredContainerNumber,
  })

  const trackingTimeTravel = useTrackingTimeTravelController({
    selectedContainer: selection.selectedContainer,
  })

  useShipmentAlertNavigation({
    locationState: processContainerNavigationState,
    shipment: resource.latestShipment,
    preferredContainerNumber,
    selectedContainer: selection.selectedContainer,
    isTrackingTimeTravelActive: trackingTimeTravel.isActive,
    closeTrackingTimeTravel: trackingTimeTravel.close,
  })

  // ── Refresh controller ─────────────────────────────────────────────────────
  const refresh = useShipmentRefreshController({
    shipment: resource.latestShipment,
    reconcileTrackingView: resource.reconcileTrackingView,
  })

  // ── Dialogs controller ─────────────────────────────────────────────────────
  const dialogs = useShipmentDialogsController({
    processId,
    navigate,
    refetchShipment: resource.refetch,
  })

  // ── Alert actions controller ───────────────────────────────────────────────
  const alertActions = useShipmentAlertActionsController({
    processId,
    reconcileTrackingView: resource.reconcileTrackingView,
  })

  // ── Route-change reset ─────────────────────────────────────────────────────
  // resource.mutate(undefined) on null key is handled internally by useShipmentScreenResource.
  createEffect(() => {
    const currentKey = resource.processResourceKey()
    if (currentKey === null) {
      refresh.resetRefreshState()
      selection.setSelectedContainerId('')
    }
  })

  // ── Derived alerts ─────────────────────────────────────────────────────────
  const activeAlerts = createMemo<readonly AlertDisplayVM[]>(() => {
    const data = resource.latestShipment()
    if (!data) return []
    return toSortedActiveAlerts(data.alerts)
  })

  const archivedAlerts = createMemo<readonly AlertDisplayVM[]>(() => {
    const data = resource.latestShipment()
    if (!data) return []
    return toSortedArchivedAlerts(data.alerts)
  })

  // ── Dashboard prefetch intent ──────────────────────────────────────────────
  const handleDashboardIntent = () => {
    scheduleDashboardPrefetch({
      preloadRoute,
      preloadData: () =>
        prefetchDashboardData({
          windowSize:
            typeof window === 'undefined' ? 6 : resolveDashboardChartWindowSize(window.innerWidth),
        }),
      priority: 'intent',
    })
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <ShipmentScreenLayout
      shipmentData={resource.latestShipment}
      shipmentLoading={resource.loading}
      shipmentError={resource.error}
      onOpenCreateProcess={dialogs.openCreateDialog}
      onDashboardIntent={handleDashboardIntent}
      searchSlot={props.searchSlot}
      actionsSlot={<ExportImportActions processId={processId()} showImport={false} />}
      banners={
        <>
          <ShipmentRefreshStatusView
            refreshError={refresh.refreshError}
            onDismissRefreshError={refresh.clearRefreshError}
          />
          <ShipmentAlertActionFeedback
            alertActionError={alertActions.alertActionError}
            onDismissAlertActionError={alertActions.clearAlertActionError}
          />
        </>
      }
      dialogs={
        <ShipmentDialogsHost
          isEditOpen={dialogs.isEditOpen}
          onCloseEdit={dialogs.closeEditDialog}
          editInitialData={dialogs.editInitialData}
          focusFieldOnOpen={dialogs.focusFieldOnOpen}
          onEditSubmit={dialogs.handleEditSubmit}
          isCreateDialogOpen={dialogs.isCreateDialogOpen}
          onCloseCreate={dialogs.closeCreateDialog}
          onCreateSubmit={dialogs.handleCreateSubmit}
          hasCreateError={dialogs.hasCreateError}
          createErrorMessage={dialogs.createErrorMessage}
          createErrorExisting={dialogs.createErrorExisting}
          onAcknowledgeCreateError={dialogs.clearCreateError}
        />
      }
      content={
        <ShipmentContainersView
          shipmentData={resource.latestShipment}
          activeAlerts={activeAlerts}
          archivedAlerts={archivedAlerts}
          busyAlertIds={alertActions.busyAlertIds}
          collapsingAlertIds={alertActions.collapsingAlertIds}
          onAcknowledgeAlert={alertActions.acknowledgeAlert}
          onUnacknowledgeAlert={alertActions.unacknowledgeAlert}
          isRefreshing={refresh.isRefreshing}
          refreshRetry={refresh.refreshRetry}
          refreshHint={refresh.refreshHint}
          syncNow={refresh.syncNow}
          onTriggerRefresh={refresh.triggerRefresh}
          selectedContainerId={selection.selectedContainerId}
          onSelectContainer={(id: string) => selection.setSelectedContainerId(String(id))}
          selectedContainer={selection.selectedContainer}
          trackingTimeTravel={trackingTimeTravel}
          onOpenEditForShipment={dialogs.openEditForShipment}
        />
      }
    />
  )
}
