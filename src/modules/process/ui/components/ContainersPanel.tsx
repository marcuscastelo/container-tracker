import type { JSX } from 'solid-js'
import type { ContainerDetail } from '~/modules/process/application/processPresenter'
import { ContainerSelector } from '~/modules/process/ui/components/ContainerSelector'
import { useTranslation } from '~/shared/localization/i18n'

type Props = {
  containers: readonly ContainerDetail[]
  selectedId: string
  onSelect: (id: string) => void
}

export function ContainersPanel(props: Props): JSX.Element {
  const { t } = useTranslation()
  return (
    <section class="rounded-lg border border-slate-200 bg-white">
      <header class="border-b border-slate-200 px-6 py-4">
        <h2 class="text-base font-semibold text-slate-900">
          {t('shipmentView.containers.title')} ({props.containers.length})
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
