import type { AlertDisplayVM } from '~/modules/process/ui/viewmodels/alert.vm'
import type { ContainerDetailVM } from '~/modules/process/ui/viewmodels/shipment.vm'

function isLegacyTransshipmentAlert(alert: AlertDisplayVM): boolean {
  return alert.type === 'transshipment' || alert.message.includes('Transshipment detected')
}

export function toVisibleAlertsBySelectedContainer(
  alerts: readonly AlertDisplayVM[],
  selectedContainer: ContainerDetailVM | null,
): readonly AlertDisplayVM[] {
  if (!selectedContainer?.transshipment.hasTransshipment) {
    return alerts
  }
  return alerts.filter((alert) => !isLegacyTransshipmentAlert(alert))
}
