import type { JSX } from 'solid-js'
import { Show } from 'solid-js'
import { ShipmentCurrentStatusDetails } from '~/modules/process/ui/components/ShipmentCurrentStatusDetails'
import type { ContainerDetailVM } from '~/modules/process/ui/viewmodels/shipment.vm'
import { useTranslation } from '~/shared/localization/i18n'
import { Panel } from '~/shared/ui/layout/Panel'

type Props = {
  readonly selectedContainer: ContainerDetailVM | null
  readonly syncNow: Date
}

export function ShipmentCurrentStatus(props: Props): JSX.Element {
  const { t, keys } = useTranslation()

  return (
    <Panel
      title={t(keys.shipmentView.currentStatus.title)}
      class="rounded-xl"
      bodyClass="px-5 py-4"
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
