import type { JSX } from 'solid-js'
import { For, Show } from 'solid-js'
import type { ContainerDetail } from '~/modules/process/application/processPresenter'
import { TimelineNode } from '~/modules/process/ui/components/TimelineNode'
import { useTranslation } from '~/shared/localization/i18n'

type Props = {
  selectedContainer: ContainerDetail | null
  carrier?: string | null
}

export function TimelinePanel(props: Props): JSX.Element {
  const timeline = () => props.selectedContainer?.timeline ?? []
  const { t } = useTranslation()

  return (
    <section class="rounded-lg border border-slate-200 bg-white">
      <header class="border-b border-slate-200 px-6 py-4">
        <h2 class="text-base font-semibold text-slate-900">{t('shipmentView.timeline.title')}</h2>
        <Show when={props.selectedContainer}>
          <p class="mt-1 text-xs text-slate-500">
            {props.selectedContainer?.number} •{' '}
            <span class="inline-block align-middle">
              {/* StatusBadge used in parent header for container; keep simple here */}
            </span>
          </p>
        </Show>
      </header>
      <div class="p-6">
        <Show
          when={timeline().length > 0}
          fallback={
            <p class="py-4 text-center text-sm text-slate-500">{t('shipmentView.noEvents')}</p>
          }
        >
          <div>
            <For each={timeline()}>
              {(event, index) => (
                <TimelineNode
                  event={event}
                  isLast={index() === timeline().length - 1}
                  carrier={props.carrier}
                  containerNumber={props.selectedContainer?.number}
                />
              )}
            </For>
          </div>
        </Show>
      </div>
    </section>
  )
}
