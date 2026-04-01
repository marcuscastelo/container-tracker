import type { Accessor, Resource } from 'solid-js'
import { createEffect, createMemo, createResource } from 'solid-js'
import { fetchProcess } from '~/modules/process/ui/fetchProcess'
import { fetchProcessSyncSnapshot } from '~/modules/process/ui/fetchProcessTrackingDetails'
import {
  normalizeContainerNumber,
  toContainerSyncVM,
} from '~/modules/process/ui/mappers/containerSync.ui-mapper'
import { toProcessResourceKey } from '~/modules/process/ui/utils/process-resource-key'
import type { ShipmentDetailVM } from '~/modules/process/ui/viewmodels/shipment.vm'
import { readResourceSnapshot } from '~/shared/solid/resourceSnapshot'
import { systemClock } from '~/shared/time/clock'

type UseShipmentScreenResourceCommand = {
  readonly processId: Accessor<string>
  readonly locale: Accessor<string>
}

type ShipmentScreenResourceResult = {
  readonly shipment: Resource<ShipmentDetailVM | null | undefined>
  readonly latestShipment: Accessor<ShipmentDetailVM | null | undefined>
  readonly loading: Accessor<boolean>
  readonly error: Accessor<unknown>
  readonly refetch: () => unknown
  readonly mutate: (value: ShipmentDetailVM | undefined) => void
  readonly processResourceKey: Accessor<readonly [string, string] | null>
  readonly reconcileTrackingView: () => Promise<void>
}

export function mergeTrackingFieldsIntoShipment(
  current: ShipmentDetailVM,
  latest: ShipmentDetailVM,
): ShipmentDetailVM {
  return {
    ...current,
    trackingFreshnessToken: latest.trackingFreshnessToken,
    status: latest.status,
    statusCode: latest.statusCode,
    statusMicrobadge: latest.statusMicrobadge,
    eta: latest.eta,
    processEtaSecondaryVm: latest.processEtaSecondaryVm,
    containers: latest.containers,
    alerts: latest.alerts,
    alertIncidents: latest.alertIncidents,
  }
}

export function mergeProcessSyncSnapshotIntoShipment(
  current: ShipmentDetailVM,
  snapshot: Awaited<ReturnType<typeof fetchProcessSyncSnapshot>>,
): ShipmentDetailVM {
  const now = systemClock.now()
  const syncByContainerNumber = new Map(
    snapshot.containersSync.map((containerSync) => [
      normalizeContainerNumber(containerSync.containerNumber),
      toContainerSyncVM(containerSync, now),
    ]),
  )

  return {
    ...current,
    trackingFreshnessToken: snapshot.tracking_freshness_token,
    containers: current.containers.map((container) => ({
      ...container,
      sync: syncByContainerNumber.get(normalizeContainerNumber(container.number)) ?? container.sync,
    })),
  }
}

export function useShipmentScreenResource(
  command: UseShipmentScreenResourceCommand,
): ShipmentScreenResourceResult {
  const processResourceKey = createMemo(() =>
    toProcessResourceKey(command.processId(), command.locale()),
  )

  const [shipment, { refetch, mutate }] = createResource(
    processResourceKey,
    ([id, currentLocale]) => fetchProcess(id, currentLocale),
  )
  const latestShipment = () => readResourceSnapshot(shipment)

  let previousProcessId: string | null = null
  let lastUndefinedRecoveryKey: string | null = null

  createEffect(() => {
    const currentKey = processResourceKey()
    if (currentKey === null) {
      previousProcessId = null
      lastUndefinedRecoveryKey = null
      mutate(undefined)
      return
    }

    const [currentProcessId] = currentKey
    if (previousProcessId === null) {
      previousProcessId = currentProcessId
      return
    }

    if (previousProcessId === currentProcessId) return

    previousProcessId = currentProcessId
    mutate(undefined)
  })

  createEffect(() => {
    const currentKey = processResourceKey()
    if (currentKey === null) return

    const recoveryKey = `${currentKey[0]}::${currentKey[1]}`
    const data = latestShipment()
    const hasError = Boolean(shipment.error)
    const isLoading = shipment.loading

    if (data !== undefined || hasError || isLoading) {
      if (lastUndefinedRecoveryKey === recoveryKey) {
        lastUndefinedRecoveryKey = null
      }
      return
    }

    if (lastUndefinedRecoveryKey === recoveryKey) return
    lastUndefinedRecoveryKey = recoveryKey
    void refetch()
  })

  const reconcileTrackingView = async () => {
    const currentKey = processResourceKey()
    if (currentKey === null) return

    const [currentProcessId, currentLocale] = currentKey
    const current = latestShipment()
    try {
      const snapshot = await fetchProcessSyncSnapshot(currentProcessId)

      if (!current) {
        const latest = await fetchProcess(currentProcessId, currentLocale, {
          mode: 'network-only',
          triggeredBy: 'shipment_reconciliation',
        })
        if (latest) {
          mutate(latest)
        }
        return
      }

      const syncedCurrent = mergeProcessSyncSnapshotIntoShipment(current, snapshot)
      if (current.trackingFreshnessToken === snapshot.tracking_freshness_token) {
        mutate(syncedCurrent)
        return
      }

      const latest = await fetchProcess(currentProcessId, currentLocale, {
        mode: 'network-only',
        triggeredBy: 'shipment_reconciliation',
      })
      if (!latest) {
        mutate(syncedCurrent)
        return
      }

      mutate(mergeTrackingFieldsIntoShipment(syncedCurrent, latest))
      return
    } catch (error) {
      console.error(`Failed to reconcile shipment ${currentProcessId} from sync snapshot:`, error)
    }

    const latest = await fetchProcess(currentProcessId, currentLocale, {
      mode: 'network-only',
      triggeredBy: 'shipment_reconciliation',
    })
    if (!latest) return

    if (!current) {
      mutate(latest)
      return
    }

    mutate(mergeTrackingFieldsIntoShipment(current, latest))
  }

  return {
    shipment,
    latestShipment,
    loading: () => shipment.loading,
    error: () => shipment.error,
    refetch,
    mutate,
    processResourceKey,
    reconcileTrackingView,
  }
}
