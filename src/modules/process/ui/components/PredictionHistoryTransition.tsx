import type { JSX } from 'solid-js'

type Props = {
  readonly label: string
}

export function PredictionHistoryTransition(props: Props): JSX.Element {
  return (
    <div class="ml-3 border-l border-dashed border-border pl-5 pt-2">
      <p class="text-xs-ui font-medium text-text-muted">{props.label}</p>
    </div>
  )
}
