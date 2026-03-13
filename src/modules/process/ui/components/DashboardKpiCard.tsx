import type { JSX } from 'solid-js'
import { Show } from 'solid-js'
import { Dynamic } from 'solid-js/web'
import type { DashboardKpiVM } from '~/modules/process/ui/viewmodels/dashboard-kpi.vm'

type DashboardKpiCardProps = {
  readonly item: DashboardKpiVM
}

function toToneClasses(tone: DashboardKpiVM['tone']): string {
  if (tone === 'warning') {
    return 'border-tone-warning-border bg-tone-warning-bg/45 text-tone-warning-fg'
  }

  return 'border-border bg-surface text-foreground'
}

function toIconClasses(tone: DashboardKpiVM['tone']): string {
  if (tone === 'warning') {
    return 'bg-tone-warning-bg text-tone-warning-fg'
  }

  return 'bg-surface-muted text-text-muted'
}

function toLabelClasses(tone: DashboardKpiVM['tone']): string {
  if (tone === 'warning') {
    return 'text-tone-warning-fg'
  }
  return 'text-text-muted'
}

function toValueClasses(tone: DashboardKpiVM['tone']): string {
  if (tone === 'warning') {
    return 'text-tone-warning-fg'
  }
  return 'text-foreground'
}

export function DashboardKpiCard(props: DashboardKpiCardProps): JSX.Element {
  const rootClasses = () =>
    `flex min-h-[84px] items-center gap-3 rounded-lg border px-3 py-2.5 shadow-[0_1px_2px_rgb(0_0_0_/8%)] ${toToneClasses(props.item.tone)}`

  const cardBody = () => (
    <div class={rootClasses()}>
      <div
        class={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${toIconClasses(props.item.tone)}`}
      >
        <Dynamic
          component={props.item.icon}
          class="h-4 w-4"
          strokeWidth={1.75}
          aria-hidden="true"
        />
      </div>
      <div class="min-w-0">
        <p class={`text-xs-ui leading-tight ${toLabelClasses(props.item.tone)}`}>
          {props.item.label}
        </p>
        <p
          class={`mt-1 truncate text-lg-ui font-semibold leading-tight tabular-nums ${toValueClasses(props.item.tone)}`}
        >
          {props.item.value}
        </p>
      </div>
    </div>
  )

  return (
    <Show when={props.item.href} fallback={cardBody()}>
      {(href) => (
        <a href={href()} class="block transition-opacity hover:opacity-95">
          {cardBody()}
        </a>
      )}
    </Show>
  )
}

export function DashboardKpiCardSkeleton(): JSX.Element {
  return (
    <div class="flex min-h-[84px] animate-pulse items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2.5 shadow-[0_1px_2px_rgb(0_0_0_/8%)]">
      <div class="h-9 w-9 rounded-md bg-surface-muted" />
      <div class="min-w-0 flex-1 space-y-2">
        <div class="h-3 w-24 rounded bg-surface-muted" />
        <div class="h-5 w-20 rounded bg-surface-muted" />
      </div>
    </div>
  )
}
