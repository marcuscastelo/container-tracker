import type { Accessor } from 'solid-js'
import { createEffect, createSignal } from 'solid-js'
import { acknowledgeShipmentAlert } from '~/modules/process/ui/screens/shipment/usecases/acknowledgeShipmentAlert.usecase'
import { unacknowledgeShipmentAlert } from '~/modules/process/ui/screens/shipment/usecases/unacknowledgeShipmentAlert.usecase'
import { useTranslation } from '~/shared/localization/i18n'

function withSetEntry(set: ReadonlySet<string>, value: string): ReadonlySet<string> {
  const next = new Set(set)
  next.add(value)
  return next
}

function withoutSetEntry(set: ReadonlySet<string>, value: string): ReadonlySet<string> {
  const next = new Set(set)
  next.delete(value)
  return next
}

type UseShipmentAlertActionsControllerCommand = {
  readonly processId: Accessor<string>
  readonly reconcileTrackingView: () => Promise<void>
}

type ShipmentAlertActionsControllerResult = {
  readonly busyAlertIds: Accessor<ReadonlySet<string>>
  readonly alertActionError: Accessor<string | null>
  readonly clearAlertActionError: () => void
  readonly acknowledgeAlert: (alertId: string) => Promise<void> // i18n-enforce-ignore
  readonly acknowledgeAlerts: (alertIds: readonly string[]) => Promise<void> // i18n-enforce-ignore
  readonly unacknowledgeAlert: (alertId: string) => Promise<void> // i18n-enforce-ignore
  readonly unacknowledgeAlerts: (alertIds: readonly string[]) => Promise<void> // i18n-enforce-ignore
}

type AlertActionBatchResult = {
  readonly completedAlertIds: readonly string[]
  readonly failedAlertId: string | null
  readonly error: unknown | null
}

function toUniqueAlertIds(alertIds: readonly string[]): readonly string[] {
  return [...new Set(alertIds.map((alertId) => alertId.trim()).filter(Boolean))]
}

export async function runAlertActionBatch(command: {
  readonly alertIds: readonly string[]
  readonly execute: (alertId: string) => Promise<void>
}): Promise<AlertActionBatchResult> {
  const completedAlertIds: string[] = []

  for (const alertId of command.alertIds) {
    try {
      await command.execute(alertId)
      completedAlertIds.push(alertId)
    } catch (error) {
      return {
        completedAlertIds,
        failedAlertId: alertId,
        error,
      }
    }
  }

  return {
    completedAlertIds,
    failedAlertId: null,
    error: null,
  }
}

export function useShipmentAlertActionsController(
  command: UseShipmentAlertActionsControllerCommand,
): ShipmentAlertActionsControllerResult {
  const { t, keys } = useTranslation()
  const [busyAlertIds, setBusyAlertIds] = createSignal<ReadonlySet<string>>(new Set())
  const [alertActionError, setAlertActionError] = createSignal<string | null>(null)

  createEffect(() => {
    command.processId()
    setBusyAlertIds(new Set<string>())
    setAlertActionError(null)
  })

  const handleAcknowledgeAlerts = async (alertIds: readonly string[]) => {
    const uniqueAlertIds = toUniqueAlertIds(alertIds)
    if (uniqueAlertIds.length === 0) return
    if (uniqueAlertIds.some((alertId) => busyAlertIds().has(alertId))) return

    setAlertActionError(null)
    setBusyAlertIds((prev) => {
      let next = prev
      for (const alertId of uniqueAlertIds) {
        next = withSetEntry(next, alertId)
      }
      return next
    })

    try {
      const result = await runAlertActionBatch({
        alertIds: uniqueAlertIds,
        execute: acknowledgeShipmentAlert,
      })

      if (result.completedAlertIds.length > 0) {
        await command.reconcileTrackingView()
      }

      if (result.error !== null) {
        console.error('Failed to acknowledge alert:', result.error)
        setAlertActionError(t(keys.shipmentView.alerts.action.errorAcknowledge))
      }
    } catch (err) {
      console.error('Failed to acknowledge alert:', err)
      setAlertActionError(t(keys.shipmentView.alerts.action.errorAcknowledge))
    } finally {
      setBusyAlertIds((prev) => {
        let next = prev
        for (const alertId of uniqueAlertIds) {
          next = withoutSetEntry(next, alertId)
        }
        return next
      })
    }
  }

  const handleUnacknowledgeAlerts = async (alertIds: readonly string[]) => {
    const uniqueAlertIds = toUniqueAlertIds(alertIds)
    if (uniqueAlertIds.length === 0) return
    if (uniqueAlertIds.some((alertId) => busyAlertIds().has(alertId))) return

    setAlertActionError(null)
    setBusyAlertIds((prev) => {
      let next = prev
      for (const alertId of uniqueAlertIds) {
        next = withSetEntry(next, alertId)
      }
      return next
    })

    try {
      const result = await runAlertActionBatch({
        alertIds: uniqueAlertIds,
        execute: unacknowledgeShipmentAlert,
      })

      if (result.completedAlertIds.length > 0) {
        await command.reconcileTrackingView()
      }

      if (result.error !== null) {
        console.error('Failed to unacknowledge alert:', result.error)
        setAlertActionError(t(keys.shipmentView.alerts.action.errorUnacknowledge))
      }
    } catch (err) {
      console.error('Failed to unacknowledge alert:', err)
      setAlertActionError(t(keys.shipmentView.alerts.action.errorUnacknowledge))
    } finally {
      setBusyAlertIds((prev) => {
        let next = prev
        for (const alertId of uniqueAlertIds) {
          next = withoutSetEntry(next, alertId)
        }
        return next
      })
    }
  }

  return {
    busyAlertIds,
    alertActionError,
    clearAlertActionError: () => setAlertActionError(null),
    acknowledgeAlert: (alertId: string) => handleAcknowledgeAlerts([alertId]),
    acknowledgeAlerts: handleAcknowledgeAlerts,
    unacknowledgeAlert: (alertId: string) => handleUnacknowledgeAlerts([alertId]),
    unacknowledgeAlerts: handleUnacknowledgeAlerts,
  }
}
