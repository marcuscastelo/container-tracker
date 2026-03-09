import type { JSX } from 'solid-js'
import { For, Show } from 'solid-js'
import { AgentStatusBadge } from '~/modules/agent/ui/components/AgentStatusBadge'
import type { AgentListItemVM } from '~/modules/agent/ui/vm/agent.vm'

type Props = {
  readonly agents: readonly AgentListItemVM[]
  readonly loading: boolean
  readonly hasError: boolean
  readonly onAgentClick: (agentId: string) => void
  readonly onRetry: () => void
}

function SkeletonCard(): JSX.Element {
  return (
    <div class="rounded-lg border border-slate-200 bg-white p-3">
      <div class="flex items-center justify-between gap-2 mb-2">
        <div class="h-4 w-20 animate-pulse rounded bg-slate-200" />
        <div class="h-4 w-16 animate-pulse rounded bg-slate-100" />
      </div>
      <div class="h-3 w-full animate-pulse rounded bg-slate-100 mb-1.5" />
      <div class="h-3 w-3/4 animate-pulse rounded bg-slate-100" />
    </div>
  )
}

export function AgentCardList(props: Props): JSX.Element {
  return (
    <div class="flex flex-col gap-2 md:hidden">
      <Show when={props.hasError}>
        <div class="rounded-lg border border-red-200 bg-red-50 p-4 text-center">
          <p class="text-sm-ui text-red-600">Failed to load agents</p>
          <button
            type="button"
            onClick={() => props.onRetry()}
            class="mt-2 text-sm-ui font-medium text-slate-700 underline hover:text-slate-900"
          >
            Retry
          </button>
        </div>
      </Show>

      <Show when={!props.hasError && props.loading}>
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </Show>

      <Show when={!props.hasError && !props.loading && props.agents.length === 0}>
        <div class="rounded-lg border border-slate-200 bg-white p-6 text-center text-sm-ui text-slate-500">
          No agents match current filters
        </div>
      </Show>

      <Show when={!props.hasError && !props.loading && props.agents.length > 0}>
        <For each={props.agents}>
          {(agent) => {
            const cardBorder = () => {
              if (agent.statusTone === 'danger') return 'border-red-200 bg-red-50/30'
              if (agent.statusTone === 'warning') return 'border-amber-200 bg-amber-50/20'
              return 'border-slate-200 bg-white'
            }
            return (
              <button
                type="button"
                onClick={() => props.onAgentClick(agent.agentId)}
                class={`w-full rounded-lg border p-3 text-left transition-colors hover:bg-slate-50/80 focus:outline-none focus:ring-2 focus:ring-slate-300 ${cardBorder()}`}
              >
                {/* Top line: status + tenant */}
                <div class="flex items-center justify-between gap-2 mb-1.5">
                  <AgentStatusBadge label={agent.status} tone={agent.statusTone} />
                  <span class="truncate text-sm-ui font-medium text-slate-700">
                    {agent.tenantName}
                  </span>
                </div>

                {/* Hostname */}
                <p class="truncate text-micro font-mono text-slate-500 mb-1">{agent.hostname}</p>

                {/* Metrics row */}
                <div class="flex flex-wrap gap-x-4 gap-y-0.5 text-micro text-slate-500">
                  <span>
                    Last seen:{' '}
                    <span class="font-medium text-slate-700">{agent.lastSeenRelative}</span>
                  </span>
                  <span>
                    Active: <span class="font-medium text-slate-700">{agent.activeJobs}</span>
                  </span>
                  <span>
                    Failures:{' '}
                    <span
                      class={`font-medium ${agent.failuresLastHour > 0 ? 'text-red-600' : 'text-slate-700'}`}
                    >
                      {agent.failuresLastHour}
                    </span>
                  </span>
                  <span>
                    Lag: <span class="font-medium text-slate-700">{agent.queueLagDisplay}</span>
                  </span>
                </div>

                {/* Providers */}
                <Show when={agent.capabilitiesDisplay}>
                  <p class="mt-1 truncate text-micro text-slate-400">{agent.capabilitiesDisplay}</p>
                </Show>
              </button>
            )
          }}
        </For>
      </Show>
    </div>
  )
}
