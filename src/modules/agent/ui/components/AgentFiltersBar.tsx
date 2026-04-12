import type { JSX } from 'solid-js'
import { For } from 'solid-js'

type AgentStatusFilter = 'all' | 'connected' | 'degraded' | 'disconnected' | 'unknown'

type Props = {
  readonly searchText: string
  readonly onSearchChange: (value: string) => void
  readonly statusFilter: AgentStatusFilter
  readonly onStatusFilterChange: (value: AgentStatusFilter) => void
  readonly capabilityFilter: string
  readonly onCapabilityFilterChange: (value: string) => void
  readonly onlyProblematic: boolean
  readonly onOnlyProblematicChange: (value: boolean) => void
  readonly availableCapabilities: readonly string[]
}

const STATUS_OPTIONS: readonly { readonly value: AgentStatusFilter; readonly label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'connected', label: 'Connected' },
  { value: 'degraded', label: 'Degraded' },
  { value: 'disconnected', label: 'Disconnected' },
  { value: 'unknown', label: 'Unknown' },
]

export type { AgentStatusFilter }

export function AgentFiltersBar(props: Props): JSX.Element {
  return (
    <div class="mb-4 flex flex-wrap items-center gap-2">
      {/* Search */}
      <div class="relative min-w-45 max-w-xs flex-1">
        <svg
          class="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-control-foreground"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          type="text"
          placeholder="Search tenant, host, id…"
          value={props.searchText}
          onInput={(e) => props.onSearchChange(e.currentTarget.value)}
          class="motion-focus-surface w-full rounded border border-control-border bg-control-bg py-1.5 pl-8 pr-3 text-sm-ui text-control-popover-foreground placeholder:text-control-placeholder focus:border-control-selected-border focus:outline-none focus:ring-2 focus:ring-ring/40"
        />
      </div>

      {/* Status segmented filter */}
      <div class="flex rounded border border-control-border bg-control-bg">
        <For each={STATUS_OPTIONS}>
          {(opt) => (
            <button
              type="button"
              onClick={() => props.onStatusFilterChange(opt.value)}
              class={`motion-focus-surface motion-interactive px-2.5 py-1.5 text-xs-ui font-medium first:rounded-l last:rounded-r ${
                props.statusFilter === opt.value
                  ? 'bg-primary text-primary-foreground'
                  : 'text-control-foreground hover:bg-control-bg-hover hover:text-control-foreground-strong'
              }`}
            >
              {opt.label}
            </button>
          )}
        </For>
      </div>

      {/* Capability filter */}
      <select
        value={props.capabilityFilter}
        onChange={(e) => props.onCapabilityFilterChange(e.currentTarget.value)}
        class="motion-focus-surface rounded border border-control-border bg-control-bg px-2.5 py-1.5 text-sm-ui text-control-popover-foreground focus:border-control-selected-border focus:outline-none focus:ring-2 focus:ring-ring/40"
      >
        <option value="">All Providers</option>
        <For each={props.availableCapabilities}>{(cap) => <option value={cap}>{cap}</option>}</For>
      </select>

      {/* Only problematic toggle */}
      <label class="motion-focus-surface motion-interactive inline-flex cursor-pointer items-center gap-1.5 rounded border border-control-border bg-control-bg px-2.5 py-1.5 text-xs-ui font-medium text-control-foreground hover:bg-control-bg-hover hover:text-control-foreground-strong">
        <input
          type="checkbox"
          checked={props.onlyProblematic}
          onChange={(e) => props.onOnlyProblematicChange(e.currentTarget.checked)}
          class="h-3.5 w-3.5 rounded border-control-border text-primary focus:ring-ring/40"
        />
        Only problematic
      </label>
    </div>
  )
}
