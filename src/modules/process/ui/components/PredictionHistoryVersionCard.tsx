import clsx from 'clsx'
import type { JSX } from 'solid-js'
import { Show } from 'solid-js'
import { PredictionHistoryInfoTooltip } from '~/modules/process/ui/components/PredictionHistoryInfoTooltip'
import type {
  PredictionHistoryItemTone,
  PredictionHistoryItemVM,
} from '~/modules/process/ui/viewmodels/prediction-history.vm'

type Props = {
  readonly item: PredictionHistoryItemVM
  readonly infoTooltipLabel: string
}

function stateToneClasses(tone: PredictionHistoryItemTone): string {
  switch (tone) {
    case 'success':
      return 'bg-tone-success-bg text-tone-success-fg'
    case 'danger':
      return 'bg-tone-danger-bg text-tone-danger-fg'
    case 'warning':
      return 'bg-tone-warning-bg text-tone-warning-fg'
    case 'info':
      return 'bg-tone-info-bg text-tone-info-fg'
    case 'neutral':
      return 'bg-surface-muted text-text-muted'
  }
}

function VersionCardBody(props: { readonly item: PredictionHistoryItemVM }): JSX.Element {
  return (
    <div class="min-w-0 space-y-2">
      <p class="text-xs-ui font-medium uppercase tracking-wide text-text-muted">
        {props.item.title}
      </p>

      <div class="space-y-1">
        <p class={clsx('text-md-ui text-foreground', props.item.isCurrent && 'font-semibold')}>
          {props.item.primaryLabel}
        </p>
        <Show when={props.item.secondaryLabel}>
          <p class="text-sm-ui text-text-muted">{props.item.secondaryLabel}</p>
        </Show>
        <Show when={props.item.explanatoryText}>
          <p class="text-sm-ui text-text-muted">{props.item.explanatoryText}</p>
        </Show>
      </div>
    </div>
  )
}

function VersionCardBadges(props: { readonly item: PredictionHistoryItemVM }): JSX.Element {
  return (
    <div class="flex flex-wrap items-center gap-2">
      <span
        class={clsx(
          'inline-flex items-center rounded-full px-2 py-0.5 text-xs-ui font-medium',
          stateToneClasses(props.item.stateTone),
        )}
      >
        {props.item.stateLabel}
      </span>
      <Show when={props.item.isCurrent && props.item.currentMarkerLabel}>
        <span class="inline-flex items-center rounded-full border border-tone-info-border bg-surface px-2 py-0.5 text-xs-ui font-semibold text-tone-info-fg">
          {props.item.currentMarkerLabel}
        </span>
      </Show>
    </div>
  )
}

function VersionCardDate(props: { readonly item: PredictionHistoryItemVM }): JSX.Element {
  return (
    <Show when={props.item.mainDateLabel}>
      <p
        class={clsx(
          'text-sm-ui font-medium text-text-muted',
          props.item.isCurrent && 'text-foreground',
        )}
      >
        {props.item.mainDateLabel}
      </p>
    </Show>
  )
}

export function PredictionHistoryVersionCard(props: Props): JSX.Element {
  return (
    <article
      class={clsx(
        'rounded-xl border px-4 py-3 shadow-sm',
        props.item.isCurrent
          ? 'border-tone-info-border bg-tone-info-bg/35'
          : 'border-border bg-surface',
      )}
    >
      <div class="space-y-3">
        <div class="flex items-start justify-between gap-4">
          <VersionCardBody item={props.item} />
          <PredictionHistoryInfoTooltip
            buttonLabel={props.infoTooltipLabel}
            lines={props.item.infoTooltipLines}
          />
        </div>

        <div class="flex flex-wrap items-center justify-between gap-3">
          <VersionCardBadges item={props.item} />
          <VersionCardDate item={props.item} />
        </div>
      </div>
    </article>
  )
}
