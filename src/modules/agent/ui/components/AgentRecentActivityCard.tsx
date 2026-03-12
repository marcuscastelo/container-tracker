import type { JSX } from 'solid-js'
import { For, Show } from 'solid-js'
import type { AgentActivityVM, AgentStatusTone } from '~/modules/agent/ui/vm/agent.vm'

type Props = {
  readonly activities: readonly AgentActivityVM[]
}

const severityDot: Record<AgentStatusTone, string> = {
  success: 'bg-tone-success-strong',
  warning: 'bg-tone-warning-strong',
  danger: 'bg-tone-danger-strong',
  neutral: 'bg-text-muted',
}

const severityBorder: Record<AgentStatusTone, string> = {
  success: 'border-tone-success-border/60',
  warning: 'border-tone-warning-border/60',
  danger: 'border-tone-danger-border/60',
  neutral: 'border-border/60',
}

function ActivityRow(props: { readonly activity: AgentActivityVM }): JSX.Element {
  return (
    <div
      class={`flex items-start gap-2.5 border-b px-3 py-2 last:border-b-0 ${severityBorder[props.activity.severityTone]}`}
    >
      <span
        class={`mt-1 h-2 w-2 shrink-0 rounded-full ${severityDot[props.activity.severityTone]}`}
        aria-hidden="true"
      />
      <div class="min-w-0 flex-1">
        <div class="flex items-baseline justify-between gap-2">
          <span class="text-xs-ui font-semibold text-foreground">{props.activity.typeLabel}</span>
          <span
            class="shrink-0 text-micro text-text-muted"
            title={props.activity.occurredAtDisplay}
          >
            {props.activity.occurredAtRelative}
          </span>
        </div>
        <p class="text-micro text-text-muted">{props.activity.message}</p>
      </div>
    </div>
  )
}

export function AgentRecentActivityCard(props: Props): JSX.Element {
  return (
    <section class="rounded-lg border border-border bg-surface">
      <header class="border-b border-border/60 px-3 py-2">
        <h2 class="text-micro font-semibold uppercase tracking-wider text-text-muted">
          Recent Agent Activity
        </h2>
        <p class="text-micro text-text-muted">
          Operational events — not shipment tracking timeline
        </p>
      </header>
      <div class="max-h-90 overflow-y-auto">
        <Show when={props.activities.length === 0}>
          <EmptyActivityState />
        </Show>
        <Show when={props.activities.length > 0}>
          <For each={props.activities}>{(activity) => <ActivityRow activity={activity} />}</For>
        </Show>
      </div>
    </section>
  )
}

function EmptyActivityState(): JSX.Element {
  return <div class="px-3 py-4 text-center text-sm-ui text-text-muted">No recent activity</div>
}
