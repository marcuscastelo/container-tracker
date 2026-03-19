import { type Accessor, createEffect, createSignal, onCleanup } from 'solid-js'
import { normalizeContainerNumber } from '~/modules/process/ui/mappers/containerSync.ui-mapper'
import type { ShipmentDetailVM } from '~/modules/process/ui/viewmodels/shipment.vm'
import {
  type SyncRequestRealtimeEvent,
  subscribeToSyncRequestsRealtimeByContainerRefs,
} from '~/shared/api/sync-requests.realtime.client'
import { systemClock } from '~/shared/time/clock'
import type { Instant } from '~/shared/time/instant'

const AUTO_SYNC_DEBOUNCE_MS = 800
const AUTO_SYNC_FALLBACK_INTERVAL_MS = 10_000
const AUTO_SYNC_LABEL_TICK_MS = 60_000

export function toTrackedContainerNumberFromRealtimeEvent(
  event: SyncRequestRealtimeEvent,
): string | null {
  const row = event.row ?? event.oldRow
  if (!row?.ref_value) return null
  return normalizeContainerNumber(row.ref_value)
}

export function shouldEnableAutoSyncFallbackPolling(command: {
  readonly hasSyncingContainers: boolean
  readonly isRealtimeDegraded: boolean
  readonly isPageVisible: boolean
}): boolean {
  if (!command.isPageVisible) return false
  return command.isRealtimeDegraded || command.hasSyncingContainers
}

export function useSyncRealtimeCoordinator(command: {
  readonly shipment: Accessor<ShipmentDetailVM | null | undefined>
  readonly isRefreshing: Accessor<boolean>
  readonly refreshTrackingData: () => Promise<void>
  readonly isDisposed: () => boolean
}): Accessor<Instant> {
  const [syncNow, setSyncNow] = createSignal(systemClock.now())
  const [isPageVisible, setIsPageVisible] = createSignal(true)
  const [isRealtimeDegraded, setIsRealtimeDegraded] = createSignal(false)
  let activeContainerRealtimeCleanup: (() => void) | null = null
  let autoSyncDebounceTimeoutId: ReturnType<typeof setTimeout> | null = null
  let autoSyncFallbackIntervalId: ReturnType<typeof setInterval> | null = null
  let autoSyncInFlight = false
  let autoSyncPending = false

  const runAutoSyncRefresh = async () => {
    if (command.isDisposed()) return
    if (command.isRefreshing()) return

    if (autoSyncInFlight) {
      autoSyncPending = true
      return
    }

    autoSyncInFlight = true
    try {
      await command.refreshTrackingData()
    } catch (err) {
      console.error('Auto sync refresh failed:', err)
    } finally {
      autoSyncInFlight = false
      if (autoSyncPending) {
        autoSyncPending = false
        void runAutoSyncRefresh()
      }
    }
  }

  const scheduleAutoSyncRefresh = (delayMs: number = AUTO_SYNC_DEBOUNCE_MS) => {
    if (command.isDisposed()) return
    if (autoSyncDebounceTimeoutId !== null) {
      clearTimeout(autoSyncDebounceTimeoutId)
      autoSyncDebounceTimeoutId = null
    }

    autoSyncDebounceTimeoutId = setTimeout(() => {
      autoSyncDebounceTimeoutId = null
      void runAutoSyncRefresh()
    }, delayMs)
  }

  onCleanup(() => {
    if (autoSyncDebounceTimeoutId !== null) {
      clearTimeout(autoSyncDebounceTimeoutId)
      autoSyncDebounceTimeoutId = null
    }
    if (autoSyncFallbackIntervalId !== null) {
      clearInterval(autoSyncFallbackIntervalId)
      autoSyncFallbackIntervalId = null
    }
    if (activeContainerRealtimeCleanup) {
      activeContainerRealtimeCleanup()
      activeContainerRealtimeCleanup = null
    }
  })

  createEffect(() => {
    if (typeof document === 'undefined') return

    const updatePageVisibility = () => {
      setIsPageVisible(document.visibilityState === 'visible')
    }

    updatePageVisibility()
    document.addEventListener('visibilitychange', updatePageVisibility)
    onCleanup(() => document.removeEventListener('visibilitychange', updatePageVisibility))
  })

  createEffect(() => {
    if (typeof window === 'undefined') return

    const intervalId = setInterval(() => setSyncNow(systemClock.now()), AUTO_SYNC_LABEL_TICK_MS)
    onCleanup(() => clearInterval(intervalId))
  })

  createEffect(() => {
    const data = command.shipment()
    const trackedContainerNumbers = Array.from(
      new Set(
        (data?.containers ?? []).map((container) => normalizeContainerNumber(container.number)),
      ),
    )

    if (activeContainerRealtimeCleanup) {
      activeContainerRealtimeCleanup()
      activeContainerRealtimeCleanup = null
    }

    setIsRealtimeDegraded(false)

    if (trackedContainerNumbers.length === 0) {
      return
    }

    const trackedSet = new Set(trackedContainerNumbers)
    const subscription = subscribeToSyncRequestsRealtimeByContainerRefs({
      containerNumbers: trackedContainerNumbers,
      onEvent(event) {
        if (command.isDisposed()) return
        const trackedContainerNumber = toTrackedContainerNumberFromRealtimeEvent(event)
        if (trackedContainerNumber === null) return
        if (!trackedSet.has(trackedContainerNumber)) return
        scheduleAutoSyncRefresh(AUTO_SYNC_DEBOUNCE_MS)
      },
      onStatus(status) {
        if (status.state === 'CHANNEL_ERROR' || status.state === 'TIMED_OUT') {
          setIsRealtimeDegraded(true)
          return
        }
        if (status.state === 'SUBSCRIBED') {
          setIsRealtimeDegraded(false)
        }
      },
    })

    activeContainerRealtimeCleanup = subscription.unsubscribe
    onCleanup(() => {
      if (activeContainerRealtimeCleanup) {
        activeContainerRealtimeCleanup()
        activeContainerRealtimeCleanup = null
      }
    })
  })

  createEffect(() => {
    const data = command.shipment()
    const hasSyncingContainers =
      data?.containers.some((container) => container.sync.state === 'syncing') ?? false
    const enableFallbackPolling = shouldEnableAutoSyncFallbackPolling({
      hasSyncingContainers,
      isRealtimeDegraded: isRealtimeDegraded(),
      isPageVisible: isPageVisible(),
    })

    if (!enableFallbackPolling) {
      if (autoSyncFallbackIntervalId !== null) {
        clearInterval(autoSyncFallbackIntervalId)
        autoSyncFallbackIntervalId = null
      }
      return
    }

    if (autoSyncFallbackIntervalId !== null) {
      return
    }

    autoSyncFallbackIntervalId = setInterval(() => {
      if (!isPageVisible()) return
      scheduleAutoSyncRefresh(0)
    }, AUTO_SYNC_FALLBACK_INTERVAL_MS)

    onCleanup(() => {
      if (autoSyncFallbackIntervalId !== null) {
        clearInterval(autoSyncFallbackIntervalId)
        autoSyncFallbackIntervalId = null
      }
    })
  })

  return syncNow
}
