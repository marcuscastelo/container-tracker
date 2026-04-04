import { useNavigate } from '@solidjs/router'
import type { JSX } from 'solid-js'
import { createEffect, createMemo, createResource, createSignal, onCleanup } from 'solid-js'
import { readAgentListResponseSnapshot } from '~/modules/agent/ui/agentResourceSnapshot'
import { type AgentListQuery, fetchAgentList } from '~/modules/agent/ui/api/agent.api'
import { AgentCardList } from '~/modules/agent/ui/components/AgentCardList'
import {
  AgentFiltersBar,
  type AgentStatusFilter,
} from '~/modules/agent/ui/components/AgentFiltersBar'
import { AgentFleetSummary } from '~/modules/agent/ui/components/AgentFleetSummary'
import { AgentPageHeader } from '~/modules/agent/ui/components/AgentPageHeader'
import { type AgentSortField, AgentsTable } from '~/modules/agent/ui/components/AgentsTable'
import { toAgentListItemVM, toFleetSummaryVM } from '~/modules/agent/ui/mappers/agent.ui-mapper'
import type { AgentListItemVM } from '~/modules/agent/ui/vm/agent.vm'
import { subscribeToTrackingAgentsByTenant } from '~/shared/api/agent-monitoring.realtime.client'
import { AppHeader } from '~/shared/ui/AppHeader'

function mapStatusFilter(value: AgentStatusFilter): AgentListQuery['status'] | undefined {
  if (value === 'all') return undefined
  if (value === 'connected') return 'CONNECTED'
  if (value === 'degraded') return 'DEGRADED'
  if (value === 'disconnected') return 'DISCONNECTED'
  return 'UNKNOWN'
}

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
  const [searchText, setSearchText] = createSignal('')
  const [statusFilter, setStatusFilter] = createSignal<AgentStatusFilter>('all')
  const [capabilityFilter, setCapabilityFilter] = createSignal('')
  const [onlyProblematic, setOnlyProblematic] = createSignal(false)
  const [sortField, setSortField] = createSignal<AgentSortField>('status')
  const [sortAsc, setSortAsc] = createSignal(true)
  const [lastRefreshed, setLastRefreshed] = createSignal(new Date())
  const [isLive] = createSignal(true)

  const listQuery = createMemo<AgentListQuery>(() => {
    const search = searchText().trim()
    const capability = capabilityFilter().trim()
    const status = mapStatusFilter(statusFilter())

    return {
      onlyProblematic: onlyProblematic(),
      sortField: sortField(),
      sortDir: sortAsc() ? 'asc' : 'desc',
      ...(search.length > 0 ? { search } : {}),
      ...(status === undefined ? {} : { status }),
      ...(capability.length > 0 ? { capability } : {}),
    }
  })

  const [agentsResponse, { refetch }] = createResource(listQuery, (query) => fetchAgentList(query))
  const agentsResponseSnapshot = () => readAgentListResponseSnapshot(agentsResponse)

  const now = createMemo(() => lastRefreshed())

  const agentVMs = createMemo<readonly AgentListItemVM[]>(() => {
    const response = agentsResponseSnapshot()
    if (!response) return []
    return response.agents.map((dto) => toAgentListItemVM(dto, now()))
  })

  const availableCapabilities = createMemo(() => {
    const caps = new Set<string>()
    for (const vm of agentVMs()) {
      for (const cap of vm.capabilitiesDisplay.split(', ')) {
        if (cap.trim().length > 0) caps.add(cap)
      }
    }
    return [...caps].sort()
  })

  const fleetSummary = createMemo(() => {
    const response = agentsResponseSnapshot()
    if (!response) return null
    return toFleetSummaryVM(response.summary)
  })

  const tenantIdForRealtime = createMemo(() => {
    const response = agentsResponseSnapshot()
    return response?.agents[0]?.tenantId ?? null
  })

  const fallbackPollTimer = setInterval(() => {
    setLastRefreshed(new Date())
    void refetch()
  }, 20_000)

  onCleanup(() => clearInterval(fallbackPollTimer))

  createEffect(() => {
    const tenantId = tenantIdForRealtime()
    if (!tenantId) return

    const subscription = subscribeToTrackingAgentsByTenant({
      tenantId,
      onEvent() {
        setLastRefreshed(new Date())
        void refetch()
      },
    })

    onCleanup(() => subscription.unsubscribe())
  })

  function handleSortChange(field: AgentSortField): void {
    if (sortField() === field) {
      setSortAsc((prev) => !prev)
      return
    }

    setSortField(field)
    setSortAsc(true)
  }

  function handleAgentClick(agentId: string): void {
    void navigate(`/agents/${encodeURIComponent(agentId)}`)
  }

  function handleLogsClick(agentId: string): void {
    void navigate(`/agents/${encodeURIComponent(agentId)}`, {
      state: { openLogs: true },
    })
  }

  function handleRefresh(): void {
    setLastRefreshed(new Date())
    void refetch()
  }

  return (
    <div class="relative min-h-screen bg-dashboard-canvas">
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

          <AgentFleetSummary summary={fleetSummary()} loading={agentsResponse.loading} />

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
            agents={agentVMs()}
            loading={agentsResponse.loading}
            hasError={Boolean(agentsResponse.error)}
            sortField={sortField()}
            sortAsc={sortAsc()}
            onSortChange={handleSortChange}
            onAgentClick={handleAgentClick}
            onLogsClick={handleLogsClick}
            onRetry={handleRefresh}
          />

          <AgentCardList
            agents={agentVMs()}
            loading={agentsResponse.loading}
            hasError={Boolean(agentsResponse.error)}
            onAgentClick={handleAgentClick}
            onLogsClick={handleLogsClick}
            onRetry={handleRefresh}
          />
        </main>
      </div>
    </div>
  )
}
