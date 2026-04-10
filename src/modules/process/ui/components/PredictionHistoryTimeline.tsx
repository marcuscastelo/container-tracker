import type { JSX } from 'solid-js'
import { For, Show } from 'solid-js'
import { PredictionHistoryTransition } from '~/modules/process/ui/components/PredictionHistoryTransition'
import { PredictionHistoryVersionCard } from '~/modules/process/ui/components/PredictionHistoryVersionCard'
import type { PredictionHistoryItemVM } from '~/modules/process/ui/viewmodels/prediction-history.vm'

type Props = {
  readonly items: readonly PredictionHistoryItemVM[]
  readonly infoTooltipLabel: string
}

export function PredictionHistoryTimeline(props: Props): JSX.Element {
  return (
    <div class="space-y-0">
      <For each={props.items}>
        {(item, index) => {
          const isLast = () => index() === props.items.length - 1

          return (
            <div class="relative pl-6">
              <Show when={!isLast()}>
                <div
                  class="absolute left-[10px] top-6 bottom-0 w-px bg-border"
                  aria-hidden="true"
                />
              </Show>
              <div
                class="absolute left-[6px] top-6 h-2.5 w-2.5 rounded-full border border-border bg-surface"
                aria-hidden="true"
              />
              <PredictionHistoryVersionCard item={item} infoTooltipLabel={props.infoTooltipLabel} />
              <Show when={item.transitionLabelFromPrevious}>
                {(transitionLabel) => <PredictionHistoryTransition label={transitionLabel()} />}
              </Show>
            </div>
          )
        }}
      </For>
    </div>
  )
}
