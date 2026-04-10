import type { JSX } from 'solid-js'
import { Show } from 'solid-js'
import { ShipmentCurrentStatusActionMenu } from '~/modules/process/ui/components/ShipmentCurrentStatusActionMenu'
import { ShipmentCurrentStatusDetails } from '~/modules/process/ui/components/ShipmentCurrentStatusDetails'
import type { ContainerDetailVM } from '~/modules/process/ui/viewmodels/shipment.vm'
import { useTranslation } from '~/shared/localization/i18n'
import type { Instant } from '~/shared/time/instant'
import { Panel } from '~/shared/ui/layout/Panel'

type Props = {
  readonly selectedContainer: ContainerDetailVM | null
  readonly syncNow: Instant
  readonly onOpenTimeTravel: () => void
}

export function ShipmentCurrentStatus(props: Props): JSX.Element {
  const { t, keys } = useTranslation()
  const headerSlot = () => {
    if (!props.selectedContainer) return undefined
    return <ShipmentCurrentStatusActionMenu onOpenTimeTravel={props.onOpenTimeTravel} />
  }

  return (
    <Panel
      title={t(keys.shipmentView.currentStatus.title)}
      class="rounded-xl"
      bodyClass="px-5 py-4"
      headerSlot={headerSlot()}
    >
      <Show
        when={props.selectedContainer}
        fallback={
          <p class="py-3 text-center text-xs-ui text-text-muted">
            {t(keys.shipmentView.currentStatus.noContainer)}
          </p>
        }
      >
        {(container) => (
          <ShipmentCurrentStatusDetails container={container()} syncNow={props.syncNow} />
        )}
      </Show>
    </Panel>
  )
}
