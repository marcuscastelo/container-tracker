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
      class={`cursor-pointer select-none px-2.5 py-2 text-left text-xs-ui font-semibold uppercase tracking-wider text-slate-500 transition-colors hover:text-slate-700 ${props.class ?? ''}`}
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
  const cells = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const
  return (
    <tr class="border-b border-slate-100">
      <Index each={cells}>
        {() => (
          <td class="px-2.5 py-2.5">
            <div class="h-4 w-full animate-pulse rounded bg-slate-100" />
          </td>
        )}
      </Index>
    </tr>
  )
}

function ErrorRow(props: { readonly onRetry: () => void }): JSX.Element {
  return (
    <tr>
      <td colspan="10" class="px-4 py-8 text-center">
        <p class="text-sm-ui text-red-600">Failed to load agents</p>
        <button
          type="button"
          onClick={() => props.onRetry()}
          class="mt-2 text-sm-ui font-medium text-slate-700 underline hover:text-slate-900"
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
      <td colspan="10" class="px-4 py-8 text-center text-sm-ui text-slate-500">
        No agents match current filters
      </td>
    </tr>
  )
}

function AgentDataRow(props: {
  readonly agent: AgentListItemVM
  readonly onAgentClick: (agentId: string) => void
}): JSX.Element {
  const rowBg = () => {
    if (props.agent.statusTone === 'danger') return 'bg-red-50/40'
    if (props.agent.statusTone === 'warning') return 'bg-amber-50/30'
    return ''
  }

  return (
    <tr
      class={`cursor-pointer transition-colors hover:bg-slate-50 ${rowBg()}`}
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
        class="max-w-35 truncate px-2.5 py-2 text-sm-ui text-slate-700"
        title={props.agent.tenantName}
      >
        {props.agent.tenantName}
      </td>
      <td class="px-2.5 py-2 text-micro font-mono text-slate-500" title={props.agent.agentId}>
        {props.agent.agentId}
      </td>
      <td
        class="max-w-50 truncate px-2.5 py-2 text-micro font-mono text-slate-500"
        title={props.agent.hostname}
      >
        {props.agent.hostname}
      </td>
      <td class="px-2.5 py-2 text-micro text-slate-400">{props.agent.version}</td>
      <td class="px-2.5 py-2 text-micro text-slate-500" title={props.agent.lastSeenDisplay}>
        {props.agent.lastSeenRelative}
      </td>
      <td class="px-2.5 py-2 text-right text-sm-ui tabular-nums text-slate-700">
        {props.agent.activeJobs}
      </td>
      <td
        class={`px-2.5 py-2 text-right text-sm-ui tabular-nums ${props.agent.failuresLastHour > 0 ? 'font-semibold text-red-600' : 'text-slate-700'}`}
      >
        {props.agent.failuresLastHour}
      </td>
      <td class="px-2.5 py-2 text-right text-micro tabular-nums text-slate-500">
        {props.agent.queueLagDisplay}
      </td>
      <td
        class="max-w-40 truncate px-2.5 py-2 text-micro text-slate-400"
        title={props.agent.capabilitiesDisplay}
      >
        {props.agent.capabilitiesDisplay}
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
        {(agent) => <AgentDataRow agent={agent} onAgentClick={props.onAgentClick} />}
      </For>
    )
  }

  return (
    <div class="hidden overflow-x-auto rounded-lg border border-slate-200 bg-white md:block">
      <table class="min-w-full divide-y divide-slate-100">
        <thead class="bg-slate-50/80">
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
            <th class="px-2.5 py-2 text-left text-xs-ui font-semibold uppercase tracking-wider text-slate-500">
              Agent
            </th>
            <th class="px-2.5 py-2 text-left text-xs-ui font-semibold uppercase tracking-wider text-slate-500">
              Hostname
            </th>
            <th class="px-2.5 py-2 text-left text-xs-ui font-semibold uppercase tracking-wider text-slate-500">
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
            <th class="px-2.5 py-2 text-left text-xs-ui font-semibold uppercase tracking-wider text-slate-500">
              Providers
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-50">{bodyRows()}</tbody>
      </table>
    </div>
  )
}
