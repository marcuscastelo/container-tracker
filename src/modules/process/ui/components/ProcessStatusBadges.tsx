import type { JSX } from 'solid-js'
import { Show } from 'solid-js'
import { StatusBadge, type StatusVariant } from '~/shared/ui/StatusBadge'

type ProcessStatusMicrobadgeDisplay = {
  readonly label: string
  readonly variant: StatusVariant
}

type Props = {
  readonly primary: {
    readonly label: string
    readonly variant: StatusVariant
  }
  readonly microbadge: ProcessStatusMicrobadgeDisplay | null
}

export function ProcessStatusBadges(props: Props): JSX.Element {
  return (
    <div class="inline-flex max-w-full items-center gap-1.5 whitespace-nowrap">
      <StatusBadge variant={props.primary.variant} label={props.primary.label} />
      <Show when={props.microbadge}>
        {(microbadge) => (
          <StatusBadge
            variant={microbadge().variant}
            label={microbadge().label}
            size="micro"
            hideIcon
          />
        )}
      </Show>
    </div>
  )
}
