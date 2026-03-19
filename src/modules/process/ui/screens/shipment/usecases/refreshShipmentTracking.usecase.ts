import {
  readErrorFromJsonBody,
  toReadableErrorMessage,
} from '~/modules/process/ui/screens/shipment/lib/shipmentError.presenter'
import type { RefreshRetryState } from '~/modules/process/ui/screens/shipment/types/shipmentScreen.types'
import type { ShipmentDetailVM } from '~/modules/process/ui/viewmodels/shipment.vm'

async function syncContainer(containerNumber: string): Promise<void> {
  const encodedContainer = encodeURIComponent(containerNumber)
  const response = await fetch(`/api/containers/${encodedContainer}/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })

  if (response.ok) {
    return
  }

  const body: unknown = await response.json().catch(() => null)
  const errorMessage = readErrorFromJsonBody(body) ?? response.statusText
  throw new Error(`sync failed for ${containerNumber}: ${response.status} ${errorMessage}`)
}

export type RefreshShipmentTrackingCommand = {
  readonly data: ShipmentDetailVM | null | undefined
  readonly setIsRefreshing: (value: boolean) => void
  readonly setRefreshError: (value: string | null) => void
  readonly setRefreshHint: (value: string | null) => void
  readonly setRefreshRetry: (value: RefreshRetryState | null) => void
  readonly setLastRefreshDoneAt: (value: Date | null) => void
  readonly setRealtimeCleanup: (cleanup: (() => void) | null) => void
  readonly refreshTrackingData: () => Promise<void> // i18n-enforce-ignore
  readonly isDisposed: () => boolean
  readonly toTimeoutMessage: (totalRetries: number) => string
  readonly toFailedMessage: (failedCount: number, firstError: string) => string
}

export async function refreshShipmentTracking(
  params: RefreshShipmentTrackingCommand,
): Promise<void> {
  const data = params.data
  if (!data) return

  const containers = data.containers
  if (containers.length === 0) return

  try {
    if (params.isDisposed()) return

    params.setRefreshError(null)
    params.setRefreshHint(null)
    params.setRefreshRetry(null)
    params.setIsRefreshing(true)

    const syncResults = await Promise.allSettled(
      containers.map((container) => syncContainer(container.number)),
    )

    const errors: string[] = []
    for (const result of syncResults) {
      if (result.status === 'fulfilled') continue
      errors.push(toReadableErrorMessage(result.reason))
    }

    if (errors.length > 0) {
      params.setRefreshError(params.toFailedMessage(errors.length, errors[0] ?? 'Refresh failed'))
      return
    }

    await params.refreshTrackingData()
    params.setLastRefreshDoneAt(new Date())
    params.setRefreshError(null)
  } catch (err) {
    const readableMessage = toReadableErrorMessage(err)

    console.error('Failed to refresh containers:', {
      original: err,
      message: readableMessage,
    })
    if (!params.isDisposed()) {
      params.setRefreshError(readableMessage || 'Refresh failed')
    }
  } finally {
    params.setRealtimeCleanup(null)

    if (!params.isDisposed()) {
      params.setRefreshRetry(null)
      params.setIsRefreshing(false)
    }
  }
}
