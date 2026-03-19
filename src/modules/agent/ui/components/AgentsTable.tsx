import { ArrowRight } from 'lucide-solid'
import type { JSX } from 'solid-js'
import { For, Index, Show } from 'solid-js'
import { AgentRowStatus } from '~/modules/agent/ui/components/AgentRowStatus'
import type { AgentListItemVM } from '~/modules/agent/ui/vm/agent.vm'

export type AgentSortField =
  | 'status'
  | 'tenant'
  | 'lastSeen'
  | 'failures'
  | 'queueLag'
  | 'activeJobs'

type Props = {
  readonly agents: readonly AgentListItemVM[]
  readonly loading: boolean
  readonly hasError: boolean
  readonly sortField: AgentSortField
  readonly sortAsc: boolean
  readonly onSortChange: (field: AgentSortField) => void
  readonly onAgentClick: (agentId: string) => void
  readonly onLogsClick: (agentId: string) => void
  readonly onRetry: () => void
}

function SortHeader(props: {
  readonly label: string
  readonly field: AgentSortField
  readonly currentField: AgentSortField
  readonly currentAsc: boolean
  readonly onSort: (field: AgentSortField) => void
  readonly class?: string
}): JSX.Element {
  const isActive = () => props.currentField === props.field
  const iconPath = () =>
    props.currentAsc
      ? 'M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L10 6.414l-3.293 3.293a1 1 0 01-1.414 0z'
      : 'M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L10 13.586l3.293-3.293a1 1 0 011.414 0z'

  return (
    <th
      class={`cursor-pointer select-none px-2.5 py-2 text-left text-xs-ui font-semibold uppercase tracking-wider text-text-muted transition-colors hover:text-foreground ${props.class ?? ''}`}
      onClick={() => props.onSort(props.field)}
    >
      <span class="inline-flex items-center gap-1">
        {props.label}
        <Show when={isActive()}>
          <svg class="h-3 w-3" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
            <path d={iconPath()} />
          </svg>
        </Show>
      </span>
    </th>
  )
}

function SkeletonRow(): JSX.Element {
  const cells = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as const
  return (
    <tr class="border-b border-border/60">
      <Index each={cells}>
        {() => (
          <td class="px-2.5 py-2.5">
            <div class="h-4 w-full animate-pulse rounded bg-surface-muted" />
          </td>
        )}
      </Index>
    </tr>
  )
}

function ErrorRow(props: { readonly onRetry: () => void }): JSX.Element {
  return (
    <tr>
      <td colspan="12" class="px-4 py-8 text-center">
        <p class="text-sm-ui text-tone-danger-fg">Failed to load agents</p>
        <button
          type="button"
          onClick={() => props.onRetry()}
          class="mt-2 text-sm-ui font-medium text-control-foreground underline hover:text-control-foreground-strong"
        >
          Retry
        </button>
      </td>
    </tr>
  )
}

function EmptyRow(): JSX.Element {
  return (
    <tr>
      <td colspan="12" class="px-4 py-8 text-center text-sm-ui text-text-muted">
        No agents match current filters
      </td>
    </tr>
  )
}

function UpdaterVersionDisplay(props: {
  readonly updateAvailable: boolean
  readonly currentVersion: string
  readonly desiredVersionDisplay: string
}): JSX.Element {
  return (
    <Show when={props.updateAvailable} fallback={props.currentVersion}>
      <span class="inline-flex items-center gap-0.5">
        <ArrowRight class="w-3 h-3 inline" aria-hidden="true" />
        {props.desiredVersionDisplay}
      </span>
    </Show>
  )
}

function AgentDataRow(props: {
  readonly agent: AgentListItemVM
  readonly onAgentClick: (agentId: string) => void
  readonly onLogsClick: (agentId: string) => void
}): JSX.Element {
  const rowBg = () => {
    if (props.agent.statusTone === 'danger') return 'bg-tone-danger-bg/35'
    if (props.agent.statusTone === 'warning') return 'bg-tone-warning-bg/25'
    return ''
  }

  return (
    <tr
      class={`cursor-pointer transition-colors hover:bg-surface-muted ${rowBg()}`}
      onClick={() => props.onAgentClick(props.agent.agentId)}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          props.onAgentClick(props.agent.agentId)
        }
      }}
    >
      <td class="px-2.5 py-2">
        <AgentRowStatus
          status={props.agent.status}
          tone={props.agent.statusTone}
          freshness={props.agent.freshness}
        />
      </td>
      <td
        class="max-w-35 truncate px-2.5 py-2 text-sm-ui text-foreground"
        title={props.agent.tenantName}
      >
        {props.agent.tenantName}
      </td>
      <td class="px-2.5 py-2 text-micro font-mono text-text-muted" title={props.agent.agentId}>
        {props.agent.agentId}
      </td>
      <td
        class="max-w-50 truncate px-2.5 py-2 text-micro font-mono text-text-muted"
        title={props.agent.hostname}
      >
        {props.agent.hostname}
      </td>
      <td class="px-2.5 py-2 text-micro text-text-muted">{props.agent.version}</td>
      <td class="px-2.5 py-2 text-micro text-text-muted" title={props.agent.lastSeenDisplay}>
        {props.agent.lastSeenRelative}
      </td>
      <td class="px-2.5 py-2 text-right text-sm-ui tabular-nums text-foreground">
        {props.agent.activeJobs}
      </td>
      <td
        class={`px-2.5 py-2 text-right text-sm-ui tabular-nums ${props.agent.failuresLastHour > 0 ? 'font-semibold text-tone-danger-fg' : 'text-foreground'}`}
      >
        {props.agent.failuresLastHour}
      </td>
      <td class="px-2.5 py-2 text-right text-micro tabular-nums text-text-muted">
        {props.agent.queueLagDisplay}
      </td>
      <td class="px-2.5 py-2 text-micro text-text-muted">
        <div class="flex flex-col">
          <span
            class={`${props.agent.updateAvailable ? 'font-semibold text-tone-warning-fg' : 'text-text-muted'}`}
          >
            {props.agent.updaterStateLabel}
          </span>
          <span class="text-micro text-text-muted">
            <UpdaterVersionDisplay
              updateAvailable={props.agent.updateAvailable}
              currentVersion={props.agent.currentVersion}
              desiredVersionDisplay={props.agent.desiredVersionDisplay}
            />
          </span>
        </div>
      </td>
      <td
        class="max-w-40 truncate px-2.5 py-2 text-micro text-text-muted"
        title={props.agent.capabilitiesDisplay}
      >
        {props.agent.capabilitiesDisplay}
      </td>
      <td class="px-2.5 py-2">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            props.onLogsClick(props.agent.agentId)
          }}
          class="rounded border border-control-border bg-control-bg px-2 py-0.5 text-micro text-control-foreground hover:bg-control-bg-hover"
        >
          Logs
        </button>
      </td>
    </tr>
  )
}

export function AgentsTable(props: Props): JSX.Element {
  const bodyRows = (): JSX.Element => {
    if (props.hasError) {
      return <ErrorRow onRetry={props.onRetry} />
    }

    if (props.loading) {
      return (
        <>
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </>
      )
    }

    if (props.agents.length === 0) {
      return <EmptyRow />
    }

    return (
      <For each={props.agents}>
        {(agent) => (
          <AgentDataRow
            agent={agent}
            onAgentClick={props.onAgentClick}
            onLogsClick={props.onLogsClick}
          />
        )}
      </For>
    )
  }

  return (
    <div class="hidden overflow-x-auto rounded-lg border border-border bg-surface md:block">
      <table class="min-w-full divide-y divide-border">
        <thead class="bg-surface-muted">
          <tr>
            <SortHeader
              label="Status"
              field="status"
              currentField={props.sortField}
              currentAsc={props.sortAsc}
              onSort={props.onSortChange}
            />
            <SortHeader
              label="Tenant"
              field="tenant"
              currentField={props.sortField}
              currentAsc={props.sortAsc}
              onSort={props.onSortChange}
            />
            <th class="px-2.5 py-2 text-left text-xs-ui font-semibold uppercase tracking-wider text-text-muted">
              Agent
            </th>
            <th class="px-2.5 py-2 text-left text-xs-ui font-semibold uppercase tracking-wider text-text-muted">
              Hostname
            </th>
            <th class="px-2.5 py-2 text-left text-xs-ui font-semibold uppercase tracking-wider text-text-muted">
              Ver
            </th>
            <SortHeader
              label="Last Seen"
              field="lastSeen"
              currentField={props.sortField}
              currentAsc={props.sortAsc}
              onSort={props.onSortChange}
            />
            <SortHeader
              label="Active"
              field="activeJobs"
              currentField={props.sortField}
              currentAsc={props.sortAsc}
              onSort={props.onSortChange}
              class="text-right"
            />
            <SortHeader
              label="Fail/1h"
              field="failures"
              currentField={props.sortField}
              currentAsc={props.sortAsc}
              onSort={props.onSortChange}
              class="text-right"
            />
            <SortHeader
              label="Lag"
              field="queueLag"
              currentField={props.sortField}
              currentAsc={props.sortAsc}
              onSort={props.onSortChange}
              class="text-right"
            />
            <th class="px-2.5 py-2 text-left text-xs-ui font-semibold uppercase tracking-wider text-text-muted">
              Update
            </th>
            <th class="px-2.5 py-2 text-left text-xs-ui font-semibold uppercase tracking-wider text-text-muted">
              Providers
            </th>
            <th class="px-2.5 py-2 text-left text-xs-ui font-semibold uppercase tracking-wider text-text-muted">
              Actions
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-border/50">{bodyRows()}</tbody>
      </table>
    </div>
  )
}
