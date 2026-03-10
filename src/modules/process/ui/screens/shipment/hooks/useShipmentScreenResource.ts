import type { Accessor, Resource } from 'solid-js'
import { createEffect, createMemo, createResource } from 'solid-js'
import { fetchProcess } from '~/modules/process/ui/fetchProcess'
import { toProcessResourceKey } from '~/modules/process/ui/utils/process-resource-key'
import type { ShipmentDetailVM } from '~/modules/process/ui/viewmodels/shipment.vm'

type UseShipmentScreenResourceCommand = {
  readonly processId: Accessor<string>
  readonly locale: Accessor<string>
}

type ShipmentScreenResourceResult = {
  readonly shipment: Resource<ShipmentDetailVM | null | undefined>
  readonly loading: Accessor<boolean>
  readonly error: Accessor<unknown>
  readonly refetch: () => unknown
  readonly mutate: (value: ShipmentDetailVM | undefined) => void
  readonly processResourceKey: Accessor<readonly [string, string] | null>
  readonly reconcileTrackingView: () => Promise<void>
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

  let previousProcessId: string | null = null

  createEffect(() => {
    const currentKey = processResourceKey()
    if (currentKey === null) {
      previousProcessId = null
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

  const reconcileTrackingView = async () => {
    const currentKey = processResourceKey()
    if (currentKey === null) return

    const [currentProcessId, currentLocale] = currentKey
    const latest = await fetchProcess(currentProcessId, currentLocale, {
      mode: 'network-only',
    })
    if (!latest) return

    const current = shipment()
    if (!current) {
      mutate(latest)
      return
    }

    // Keep non-tracking process metadata and update only fields derived from tracking.
    mutate({
      ...current,
      status: latest.status,
      statusCode: latest.statusCode,
      statusMicrobadge: latest.statusMicrobadge,
      eta: latest.eta,
      containers: latest.containers,
      alerts: latest.alerts,
    })
  }

  return {
    shipment,
    loading: () => shipment.loading,
    error: () => shipment.error,
    refetch,
    mutate,
    processResourceKey,
    reconcileTrackingView,
  }
}
