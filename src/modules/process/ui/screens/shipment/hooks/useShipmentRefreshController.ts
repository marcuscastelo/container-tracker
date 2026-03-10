import type { Accessor, Resource } from 'solid-js'
import { createSignal, onCleanup } from 'solid-js'
import { buildRecentUpdateHint } from '~/modules/process/ui/screens/shipment/lib/shipmentRefresh.helpers'
import type { RefreshRetryState } from '~/modules/process/ui/screens/shipment/types/shipmentScreen.types'
import { REFRESH_SOFT_BLOCK_WINDOW_MS } from '~/modules/process/ui/screens/shipment/types/shipmentScreen.types'
import { refreshShipmentTracking } from '~/modules/process/ui/screens/shipment/usecases/refreshShipmentTracking.usecase'
import { useSyncRealtimeCoordinator } from '~/modules/process/ui/utils/sync-realtime-coordinator'
import type { ShipmentDetailVM } from '~/modules/process/ui/viewmodels/shipment.vm'
import { useTranslation } from '~/shared/localization/i18n'

type UseShipmentRefreshControllerCommand = {
  readonly shipment: Resource<ShipmentDetailVM | null | undefined>
  readonly reconcileTrackingView: () => Promise<void>
}

type ShipmentRefreshControllerResult = {
  readonly isRefreshing: Accessor<boolean>
  readonly refreshRetry: Accessor<RefreshRetryState | null>
  readonly refreshError: Accessor<string | null>
  readonly refreshHint: Accessor<string | null>
  readonly syncNow: Accessor<Date>
  readonly triggerRefresh: () => Promise<void>
  readonly clearRefreshError: () => void
  readonly resetRefreshState: () => void
  readonly cleanupRealtime: () => void
}

export function useShipmentRefreshController(
  command: UseShipmentRefreshControllerCommand,
): ShipmentRefreshControllerResult {
  const { t, keys } = useTranslation()

  const [isRefreshing, setIsRefreshing] = createSignal(false)
  const [refreshRetry, setRefreshRetry] = createSignal<RefreshRetryState | null>(null)
  const [refreshError, setRefreshError] = createSignal<string | null>(null)
  const [refreshHint, setRefreshHint] = createSignal<string | null>(null)
  const [lastRefreshDoneAt, setLastRefreshDoneAt] = createSignal<Date | null>(null)

  let disposed = false
  let activeRealtimeCleanup: (() => void) | null = null

  onCleanup(() => {
    if (activeRealtimeCleanup) {
      activeRealtimeCleanup()
      activeRealtimeCleanup = null
    }
    disposed = true
  })

  const syncNow = useSyncRealtimeCoordinator({
    shipment: command.shipment,
    isRefreshing,
    refreshTrackingData: command.reconcileTrackingView,
    isDisposed: () => disposed,
  })

  const triggerRefresh = async () => {
    const doneAt = lastRefreshDoneAt()
    if (doneAt) {
      const elapsedMs = Date.now() - doneAt.getTime()
      if (elapsedMs < REFRESH_SOFT_BLOCK_WINDOW_MS) {
        setRefreshError(null)
        setRefreshHint(
          buildRecentUpdateHint({
            elapsedMs,
            toSecondsLabel: (count) =>
              t(keys.shipmentView.refreshRecentlyUpdatedSeconds, { count }),
            toMinutesLabel: (count) =>
              t(keys.shipmentView.refreshRecentlyUpdatedMinutes, { count }),
          }),
        )
        return
      }
    }

    setRefreshHint(null)

    await refreshShipmentTracking({
      data: command.shipment(),
      setIsRefreshing,
      setRefreshError,
      setRefreshHint,
      setRefreshRetry,
      setLastRefreshDoneAt,
      setRealtimeCleanup(cleanup) {
        if (activeRealtimeCleanup) {
          activeRealtimeCleanup()
          activeRealtimeCleanup = null
        }
        activeRealtimeCleanup = cleanup
      },
      refreshTrackingData: command.reconcileTrackingView,
      isDisposed: () => disposed,
      toTimeoutMessage: (totalRetries) =>
        t(keys.shipmentView.refreshSyncTimeout, { total: totalRetries }),
      toFailedMessage: (failedCount, firstError) =>
        t(keys.shipmentView.refreshSyncFailed, { failedCount, firstError }),
    })
  }

  const resetRefreshState = () => {
    if (activeRealtimeCleanup) {
      activeRealtimeCleanup()
      activeRealtimeCleanup = null
    }
    setIsRefreshing(false)
    setRefreshRetry(null)
    setRefreshError(null)
    setRefreshHint(null)
    setLastRefreshDoneAt(null)
  }

  const cleanupRealtime = () => {
    if (activeRealtimeCleanup) {
      activeRealtimeCleanup()
      activeRealtimeCleanup = null
    }
  }

  const clearRefreshError = () => {
    setRefreshError(null)
    setRefreshHint(null)
  }

  return {
    isRefreshing,
    refreshRetry,
    refreshError,
    refreshHint,
    syncNow,
    triggerRefresh,
    clearRefreshError,
    resetRefreshState,
    cleanupRealtime,
  }
}
