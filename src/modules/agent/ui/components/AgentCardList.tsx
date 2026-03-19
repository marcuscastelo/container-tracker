import type { JSX } from 'solid-js'
import { For, Show } from 'solid-js'
import { AgentStatusBadge } from '~/modules/agent/ui/components/AgentStatusBadge'
import type { AgentListItemVM } from '~/modules/agent/ui/vm/agent.vm'

type Props = {
  readonly agents: readonly AgentListItemVM[]
  readonly loading: boolean
  readonly hasError: boolean
  readonly onAgentClick: (agentId: string) => void
  readonly onLogsClick: (agentId: string) => void
  readonly onRetry: () => void
}

function SkeletonCard(): JSX.Element {
  return (
    <div class="rounded-lg border border-border bg-surface p-3">
      <div class="flex items-center justify-between gap-2 mb-2">
        <div class="h-4 w-20 animate-pulse rounded bg-surface-muted" />
        <div class="h-4 w-16 animate-pulse rounded bg-surface-muted" />
      </div>
      <div class="h-3 w-full animate-pulse rounded bg-surface-muted mb-1.5" />
      <div class="h-3 w-3/4 animate-pulse rounded bg-surface-muted" />
    </div>
  )
}

function ErrorCard(props: { readonly onRetry: () => void }): JSX.Element {
  return (
    <div class="rounded-lg border border-tone-danger-border bg-tone-danger-bg p-4 text-center">
      <p class="text-sm-ui text-tone-danger-fg">Failed to load agents</p>
      <button
        type="button"
        onClick={() => props.onRetry()}
        class="mt-2 text-sm-ui font-medium text-control-foreground underline hover:text-control-foreground-strong"
      >
        Retry
      </button>
    </div>
  )
}

function EmptyStateCard(): JSX.Element {
  return (
    <div class="rounded-lg border border-border bg-surface p-6 text-center text-sm-ui text-text-muted">
      No agents match current filters
    </div>
  )
}

function AgentCard(props: {
  readonly agent: AgentListItemVM
  readonly onAgentClick: (agentId: string) => void
  readonly onLogsClick: (agentId: string) => void
}): JSX.Element {
  const cardBorder = () => {
    if (props.agent.statusTone === 'danger') return 'border-tone-danger-border bg-tone-danger-bg/30'
    if (props.agent.statusTone === 'warning')
      return 'border-tone-warning-border bg-tone-warning-bg/20'
    return 'border-border bg-surface'
  }

  return (
    <div class={`w-full rounded-lg border p-3 ${cardBorder()}`}>
      <button
        type="button"
        onClick={() => props.onAgentClick(props.agent.agentId)}
        class="w-full text-left transition-colors hover:bg-surface-muted focus:outline-none focus:ring-2 focus:ring-ring/40"
      >
        <div class="mb-1.5 flex items-center justify-between gap-2">
          <AgentStatusBadge label={props.agent.status} tone={props.agent.statusTone} />
          <span class="truncate text-sm-ui font-medium text-foreground">
            {props.agent.tenantName}
          </span>
        </div>

        <p class="mb-1 truncate text-micro font-mono text-text-muted">{props.agent.hostname}</p>

        <div class="flex flex-wrap gap-x-4 gap-y-0.5 text-micro text-text-muted">
          <span>
            Last seen:{' '}
            <span class="font-medium text-foreground">{props.agent.lastSeenRelative}</span>
          </span>
          <span>
            Active: <span class="font-medium text-foreground">{props.agent.activeJobs}</span>
          </span>
          <span>
            Failures:{' '}
            <span
              class={`font-medium ${props.agent.failuresLastHour > 0 ? 'text-tone-danger-fg' : 'text-foreground'}`}
            >
              {props.agent.failuresLastHour}
            </span>
          </span>
          <span>
            Lag: <span class="font-medium text-foreground">{props.agent.queueLagDisplay}</span>
          </span>
          <span>
            Update:{' '}
            <span
              class={`font-medium ${props.agent.updateAvailable ? 'text-tone-warning-fg' : 'text-foreground'}`}
            >
              {props.agent.updaterStateLabel}
            </span>
          </span>
        </div>

        <Show when={props.agent.capabilitiesDisplay}>
          <p class="mt-1 truncate text-micro text-text-muted">{props.agent.capabilitiesDisplay}</p>
        </Show>
      </button>

      <div class="mt-2">
        <button
          type="button"
          onClick={() => props.onLogsClick(props.agent.agentId)}
          class="rounded border border-control-border bg-control-bg px-2 py-0.5 text-micro text-control-foreground hover:bg-control-bg-hover"
        >
          Logs
        </button>
      </div>
    </div>
  )
}

export function AgentCardList(props: Props): JSX.Element {
  return (
    <div class="flex flex-col gap-2 md:hidden">
      <Show when={props.hasError}>
        <ErrorCard onRetry={props.onRetry} />
      </Show>

      <Show when={!props.hasError && props.loading}>
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </Show>

      <Show when={!props.hasError && !props.loading && props.agents.length === 0}>
        <EmptyStateCard />
      </Show>

      <Show when={!props.hasError && !props.loading && props.agents.length > 0}>
        <For each={props.agents}>
          {(agent) => (
            <AgentCard
              agent={agent}
              onAgentClick={props.onAgentClick}
              onLogsClick={props.onLogsClick}
            />
          )}
        </For>
      </Show>
    </div>
  )
}
