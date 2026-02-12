import type { ContainerAggregate } from '~/modules/container/domain/container.aggregate'
import type { ContainerListItemVM } from '~/modules/container/ui/container.vm'

export function mapContainerAggregateToListItemVM(
  aggregate: ContainerAggregate,
): ContainerListItemVM {
  return {
    id: 'placeholder-id', // TODO: Map actual container ID from aggregate
    // Issue URL: https://github.com/marcuscastelo/container-tracker/issues/54
    number: 'placeholder-number', // TODO: Map actual container number from aggregate
    // Issue URL: https://github.com/marcuscastelo/container-tracker/issues/53
    statusLabel: 'placeholder-status', // TODO: Map actual status label from aggregate
    // Issue URL: https://github.com/marcuscastelo/container-tracker/issues/52
    hasAlerts: aggregate.alerts.length > 0,
    alertCount: aggregate.alerts.length,
  }
}
