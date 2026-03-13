import type { JSX } from 'solid-js'
import { ContainerSelector } from '~/modules/process/ui/components/ContainerSelector'
import type { ContainerDetailVM } from '~/modules/process/ui/viewmodels/shipment.vm'
import { useTranslation } from '~/shared/localization/i18n'
import { Panel } from '~/shared/ui/layout/Panel'

type Props = {
  containers: readonly ContainerDetailVM[]
  selectedId: string
  onSelect: (id: string) => void
}

export function ContainersPanel(props: Props): JSX.Element {
  const { t, keys } = useTranslation()
  return (
    <Panel
      title={`${t(keys.shipmentView.containers.title)} (${props.containers.length})`}
      class="rounded-xl"
    >
      <ContainerSelector
        containers={props.containers}
        selectedId={props.selectedId}
        onSelect={props.onSelect}
      />
    </Panel>
  )
}
