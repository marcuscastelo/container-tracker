import type { JSX } from 'solid-js'
import { ContainerSelector } from '~/modules/process/ui/components/ContainerSelector'
import type { ContainerDetailVM } from '~/modules/process/ui/viewmodels/shipment.vm'
import { useTranslation } from '~/shared/localization/i18n'

type Props = {
  containers: readonly ContainerDetailVM[]
  selectedId: string
  onSelect: (id: string) => void
}

export function ContainersPanel(props: Props): JSX.Element {
  const { t, keys } = useTranslation()
  return (
    <section class="rounded-lg border border-slate-200 bg-white">
      <header class="border-b border-slate-200 px-6 py-4">
        <h2 class="text-base font-semibold text-slate-900">
          {t(keys.shipmentView.containers.title)} ({props.containers.length})
        </h2>
      </header>
      <ContainerSelector
        containers={props.containers}
        selectedId={props.selectedId}
        onSelect={props.onSelect}
      />
    </section>
  )
}
