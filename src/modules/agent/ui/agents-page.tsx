// ---------------------------------------------------------------------------
// Agents List Page — main fleet monitoring surface.
// ---------------------------------------------------------------------------

import { useNavigate } from '@solidjs/router'
import type { JSX } from 'solid-js'
import { createMemo, createResource, createSignal, onCleanup } from 'solid-js'
import { AgentCardList } from '~/modules/agent/ui/components/AgentCardList'
import {
  AgentFiltersBar,
  type AgentStatusFilter,
} from '~/modules/agent/ui/components/AgentFiltersBar'
import { AgentFleetSummary } from '~/modules/agent/ui/components/AgentFleetSummary'
import { AgentPageHeader } from '~/modules/agent/ui/components/AgentPageHeader'
import { type AgentSortField, AgentsTable } from '~/modules/agent/ui/components/AgentsTable'
import { toAgentListItemVM, toFleetSummaryVM } from '~/modules/agent/ui/mappers/agent.ui-mapper'
import { deriveFleetSummary, fetchAgentList } from '~/modules/agent/ui/mock/agent.mock.api'
import type { AgentListItemVM } from '~/modules/agent/ui/vm/agent.vm'
import { AppHeader } from '~/shared/ui/AppHeader'

// --- Status severity order for default sort ---

const STATUS_SEVERITY: Record<string, number> = {
  Disconnected: 0,
  Degraded: 1,
  Unknown: 2,
  Connected: 3,
}

// --- Sort helpers ---

function sortAgents(
  agents: readonly AgentListItemVM[],
  field: AgentSortField,
  asc: boolean,
): readonly AgentListItemVM[] {
  const copy = [...agents]
  const dir = asc ? 1 : -1

  copy.sort((a, b) => {
    switch (field) {
      case 'status':
        return ((STATUS_SEVERITY[a.status] ?? 99) - (STATUS_SEVERITY[b.status] ?? 99)) * dir
      case 'tenant':
        return a.tenantName.localeCompare(b.tenantName) * dir
      case 'lastSeen':
        return a.lastSeenDisplay.localeCompare(b.lastSeenDisplay) * dir
      case 'failures':
        return (a.failuresLastHour - b.failuresLastHour) * dir
      case 'queueLag': {
        const aLag = a.queueLagDisplay === '—' ? -1 : Number.parseFloat(a.queueLagDisplay)
        const bLag = b.queueLagDisplay === '—' ? -1 : Number.parseFloat(b.queueLagDisplay)
        return (aLag - bLag) * dir
      }
      case 'activeJobs':
        return (a.activeJobs - b.activeJobs) * dir
      default:
        return 0
    }
  })

  return copy
}

// --- Formatting helpers ---

function formatRefreshTime(d: Date): string {
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

export function AgentsPage(): JSX.Element {
  const navigate = useNavigate()

  // --- Data resource ---
  const [agents, { refetch }] = createResource(fetchAgentList)

  // --- UI state ---
  const [searchText, setSearchText] = createSignal('')
  const [statusFilter, setStatusFilter] = createSignal<AgentStatusFilter>('all')
  const [capabilityFilter, setCapabilityFilter] = createSignal('')
  const [onlyProblematic, setOnlyProblematic] = createSignal(false)
  const [sortField, setSortField] = createSignal<AgentSortField>('status')
  const [sortAsc, setSortAsc] = createSignal(true)
  const [lastRefreshed, setLastRefreshed] = createSignal(new Date())
  const [isLive] = createSignal(true)

  // --- Simulated polling ---
  const pollInterval = setInterval(() => {
    setLastRefreshed(new Date())
    void refetch()
  }, 15_000)

  onCleanup(() => clearInterval(pollInterval))

  // --- Derived: now signal for relative time ---
  const now = createMemo(() => lastRefreshed())

  // --- Derived: mapped VMs ---
  const agentVMs = createMemo<readonly AgentListItemVM[]>(() => {
    const raw = agents()
    if (!raw) return []
    return raw.map((dto) => toAgentListItemVM(dto, now()))
  })

  // --- Derived: available capabilities ---
  const availableCapabilities = createMemo(() => {
    const caps = new Set<string>()
    for (const vm of agentVMs()) {
      for (const cap of vm.capabilitiesDisplay.split(', ')) {
        if (cap) caps.add(cap)
      }
    }
    return [...caps].sort()
  })

  // --- Derived: filtered ---
  const filteredAgents = createMemo(() => {
    let result = agentVMs()

    const search = searchText().toLowerCase().trim()
    if (search) {
      result = result.filter(
        (a) =>
          a.tenantName.toLowerCase().includes(search) ||
          a.hostname.toLowerCase().includes(search) ||
          a.agentId.toLowerCase().includes(search),
      )
    }

    const sf = statusFilter()
    if (sf !== 'all') {
      result = result.filter((a) => a.status.toLowerCase() === sf)
    }

    const cf = capabilityFilter()
    if (cf) {
      result = result.filter((a) => a.capabilitiesDisplay.includes(cf))
    }

    if (onlyProblematic()) {
      result = result.filter((a) => a.isProblematic)
    }

    return result
  })

  // --- Derived: sorted ---
  const sortedAgents = createMemo(() => sortAgents(filteredAgents(), sortField(), sortAsc()))

  // --- Derived: fleet summary ---
  const fleetSummary = createMemo(() => {
    const raw = agents()
    if (!raw) return null
    return toFleetSummaryVM(deriveFleetSummary(raw))
  })

  // --- Handlers ---
  function handleSortChange(field: AgentSortField): void {
    if (sortField() === field) {
      setSortAsc((prev) => !prev)
    } else {
      setSortField(field)
      setSortAsc(true)
    }
  }

  function handleAgentClick(agentId: string): void {
    void navigate(`/agents/${encodeURIComponent(agentId)}`)
  }

  function handleRefresh(): void {
    setLastRefreshed(new Date())
    void refetch()
  }

  return (
    <div class="relative min-h-screen bg-slate-50/80">
      <div class="relative z-10">
        <AppHeader />

        <main class="mx-auto max-w-7xl px-4 py-4 lg:px-6">
          <AgentPageHeader
            title="Agents"
            subtitle="Monitoring connected tracking workers"
            lastRefreshed={formatRefreshTime(lastRefreshed())}
            isLive={isLive()}
            onRefresh={handleRefresh}
          />

          <AgentFleetSummary summary={fleetSummary()} loading={agents.loading} />

          <AgentFiltersBar
            searchText={searchText()}
            onSearchChange={setSearchText}
            statusFilter={statusFilter()}
            onStatusFilterChange={setStatusFilter}
            capabilityFilter={capabilityFilter()}
            onCapabilityFilterChange={setCapabilityFilter}
            onlyProblematic={onlyProblematic()}
            onOnlyProblematicChange={setOnlyProblematic}
            availableCapabilities={availableCapabilities()}
          />

          <AgentsTable
            agents={sortedAgents()}
            loading={agents.loading}
            hasError={Boolean(agents.error)}
            sortField={sortField()}
            sortAsc={sortAsc()}
            onSortChange={handleSortChange}
            onAgentClick={handleAgentClick}
            onRetry={handleRefresh}
          />

          <AgentCardList
            agents={sortedAgents()}
            loading={agents.loading}
            hasError={Boolean(agents.error)}
            onAgentClick={handleAgentClick}
            onRetry={handleRefresh}
          />
        </main>
      </div>
    </div>
  )
}
