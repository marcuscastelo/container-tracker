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
  readonly collapsingAlertIds: Accessor<ReadonlySet<string>>
  readonly alertActionError: Accessor<string | null>
  readonly clearAlertActionError: () => void
  readonly acknowledgeAlert: (alertId: string) => Promise<void> // i18n-enforce-ignore
  readonly unacknowledgeAlert: (alertId: string) => Promise<void> // i18n-enforce-ignore
}

const EMPTY_ALERT_IDS: ReadonlySet<string> = new Set()

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

  const handleAcknowledgeAlert = async (alertId: string) => {
    if (busyAlertIds().has(alertId)) return
    setAlertActionError(null)
    setBusyAlertIds((prev) => withSetEntry(prev, alertId))

    try {
      await acknowledgeShipmentAlert(alertId)
      await command.reconcileTrackingView()
    } catch (err) {
      console.error('Failed to acknowledge alert:', err)
      setAlertActionError(t(keys.shipmentView.alerts.action.errorAcknowledge))
    } finally {
      setBusyAlertIds((prev) => withoutSetEntry(prev, alertId))
    }
  }

  const handleUnacknowledgeAlert = async (alertId: string) => {
    if (busyAlertIds().has(alertId)) return
    setAlertActionError(null)
    setBusyAlertIds((prev) => withSetEntry(prev, alertId))

    try {
      await unacknowledgeShipmentAlert(alertId)
      await command.reconcileTrackingView()
    } catch (err) {
      console.error('Failed to unacknowledge alert:', err)
      setAlertActionError(t(keys.shipmentView.alerts.action.errorUnacknowledge))
    } finally {
      setBusyAlertIds((prev) => withoutSetEntry(prev, alertId))
    }
  }

  return {
    busyAlertIds,
    collapsingAlertIds: () => EMPTY_ALERT_IDS,
    alertActionError,
    clearAlertActionError: () => setAlertActionError(null),
    acknowledgeAlert: handleAcknowledgeAlert,
    unacknowledgeAlert: handleUnacknowledgeAlert,
  }
}
