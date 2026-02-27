import type { JSX } from 'solid-js'
import { For, Show } from 'solid-js'
import { TimelineNode } from '~/modules/process/ui/components/TimelineNode'
import type { ContainerDetailVM } from '~/modules/process/ui/viewmodels/shipment.vm'
import { useTranslation } from '~/shared/localization/i18n'
import { Panel } from '~/shared/ui/layout/Panel'

type Props = {
  selectedContainer: ContainerDetailVM | null
  carrier?: string | null
}

export function TimelinePanel(props: Props): JSX.Element {
  const timeline = () => props.selectedContainer?.timeline ?? []
  const { t, keys } = useTranslation()
  const subtitle = () =>
    props.selectedContainer ? `${props.selectedContainer.number} •` : undefined

  return (
    <Panel title={t(keys.shipmentView.timeline.title)} subtitle={subtitle()} bodyClass="px-4 py-3">
      <div>
        <Show
          when={timeline().length > 0}
          fallback={
            <p class="py-4 text-center text-sm text-slate-500">{t(keys.shipmentView.noEvents)}</p>
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
    </Panel>
  )
}
