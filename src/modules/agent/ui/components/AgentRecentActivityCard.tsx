import type { JSX } from 'solid-js'
import { For } from 'solid-js'
import type { AgentActivityVM, AgentStatusTone } from '~/modules/agent/ui/vm/agent.vm'

type Props = {
  readonly activities: readonly AgentActivityVM[]
}

const severityDot: Record<AgentStatusTone, string> = {
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-red-500',
  neutral: 'bg-slate-400',
}

const severityBorder: Record<AgentStatusTone, string> = {
  success: 'border-emerald-200',
  warning: 'border-amber-200',
  danger: 'border-red-200',
  neutral: 'border-slate-200',
}

export function AgentRecentActivityCard(props: Props): JSX.Element {
  return (
    <section class="rounded-lg border border-slate-200 bg-white">
      <header class="border-b border-slate-100 px-3 py-2">
        <h2 class="text-micro font-semibold uppercase tracking-wider text-slate-400">
          Recent Agent Activity
        </h2>
        <p class="text-micro text-slate-400">Operational events — not shipment tracking timeline</p>
      </header>
      <div class="max-h-90 overflow-y-auto">
        <For
          each={[...props.activities]}
          fallback={
            <div class="px-3 py-4 text-center text-sm-ui text-slate-400">No recent activity</div>
          }
        >
          {(activity) => (
            <div
              class={`flex items-start gap-2.5 border-b px-3 py-2 last:border-b-0 ${severityBorder[activity.severityTone]}`}
            >
              <span
                class={`mt-1 h-2 w-2 shrink-0 rounded-full ${severityDot[activity.severityTone]}`}
                aria-hidden="true"
              />
              <div class="min-w-0 flex-1">
                <div class="flex items-baseline justify-between gap-2">
                  <span class="text-xs-ui font-semibold text-slate-700">{activity.typeLabel}</span>
                  <span
                    class="shrink-0 text-micro text-slate-400"
                    title={activity.occurredAtDisplay}
                  >
                    {activity.occurredAtRelative}
                  </span>
                </div>
                <p class="text-micro text-slate-500">{activity.message}</p>
              </div>
            </div>
          )}
        </For>
      </div>
    </section>
  )
}
