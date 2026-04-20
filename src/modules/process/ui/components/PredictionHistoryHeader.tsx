import clsx from 'clsx'
import type { JSX } from 'solid-js'
import { Show } from 'solid-js'
import type { PredictionHistoryModalVM } from '~/modules/process/ui/viewmodels/prediction-history.vm'

type Props = {
  readonly header: PredictionHistoryModalVM['header']
}

function toneClasses(tone: PredictionHistoryModalVM['header']['tone']): string {
  switch (tone) {
    case 'danger':
      return 'border-tone-danger-border bg-tone-danger-bg/60 text-tone-danger-fg'
    case 'warning':
      return 'border-tone-warning-border bg-tone-warning-bg/60 text-tone-warning-fg'
    case 'neutral':
      return 'border-border bg-surface text-foreground'
  }
}

export function PredictionHistoryHeader(props: Props): JSX.Element {
  return (
    <section class={clsx('rounded-xl border px-4 py-4', toneClasses(props.header.tone))}>
      <div class="space-y-1.5">
        <p class="text-sm-ui font-semibold">{props.header.summaryLabel}</p>
        <p class="text-sm-ui font-medium">{props.header.currentLine}</p>
        <Show when={props.header.comparisonLine}>
          {(comparisonLine) => <p class="text-sm-ui">{comparisonLine()}</p>}
        </Show>
        <Show when={props.header.reasonLine}>
          {(reasonLine) => <p class="text-sm-ui">{reasonLine()}</p>}
        </Show>
      </div>
    </section>
  )
}
