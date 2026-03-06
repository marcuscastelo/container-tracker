import type { JSX } from 'solid-js'
import { ContainerSelector } from '~/modules/process/ui/components/ContainerSelector'
import type { ContainerDetailVM } from '~/modules/process/ui/viewmodels/shipment.vm'
import { useTranslation } from '~/shared/localization/i18n'
import { Panel } from '~/shared/ui/layout/Panel'

type Props = {
  containers: readonly ContainerDetailVM[]
  selectedId: string
  onSelect: (id: string) => void
  syncNow: Date
}

export function ContainersPanel(props: Props): JSX.Element {
  const { t, keys } = useTranslation()
  return (
    <Panel title={`${t(keys.shipmentView.containers.title)} (${props.containers.length})`}>
      <p class="px-2.5 pt-1 text-micro text-slate-400">
        {t(keys.shipmentView.containers.selectionHint)}
      </p>
      <ContainerSelector
        containers={props.containers}
        selectedId={props.selectedId}
        onSelect={props.onSelect}
        syncNow={props.syncNow}
      />
    </Panel>
  )
}
