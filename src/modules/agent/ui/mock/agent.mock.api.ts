// ---------------------------------------------------------------------------
// Mock API layer — simulates async fetch with deterministic latency.
// Replace these functions with real API calls when backend is wired.
// ---------------------------------------------------------------------------

import type {
  AgentDetailPayload,
  AgentFleetSummary,
  AgentSummaryPayload,
} from '~/modules/agent/ui/mock/agent.mock'
import { getMockAgentDetail, getMockAgents } from '~/modules/agent/ui/mock/agent.mock.store'

const SIMULATED_LATENCY_MS = 350

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

/** Fetch all agent summaries. Replace with real API call later. */
export async function fetchAgentList(): Promise<readonly AgentSummaryPayload[]> {
  await delay(SIMULATED_LATENCY_MS)
  return getMockAgents()
}

/** Fetch a single agent detail. Replace with real API call later. */
export async function fetchAgentDetail(agentId: string): Promise<AgentDetailPayload | null> {
  await delay(SIMULATED_LATENCY_MS)
  return getMockAgentDetail(agentId)
}

/** Derive fleet summary from agent list (UI-side aggregation for mock). */
export function deriveFleetSummary(agents: readonly AgentSummaryPayload[]): AgentFleetSummary {
  const tenants = new Set<string>()
  let connectedCount = 0
  let degradedCount = 0
  let disconnectedCount = 0
  let totalActiveJobs = 0
  let totalFailuresLastHour = 0
  let maxQueueLagSeconds: number | null = null

  for (const agent of agents) {
    tenants.add(agent.tenantId)
    totalActiveJobs += agent.activeJobs
    totalFailuresLastHour += agent.failuresLastHour

    if (agent.queueLagSeconds !== null) {
      maxQueueLagSeconds =
        maxQueueLagSeconds === null
          ? agent.queueLagSeconds
          : Math.max(maxQueueLagSeconds, agent.queueLagSeconds)
    }

    switch (agent.status) {
      case 'CONNECTED':
        connectedCount++
        break
      case 'DEGRADED':
        degradedCount++
        break
      case 'DISCONNECTED':
        disconnectedCount++
        break
      // UNKNOWN counted implicitly as total - connected - degraded - disconnected
    }
  }

  return {
    totalAgents: agents.length,
    connectedCount,
    degradedCount,
    disconnectedCount,
    totalActiveJobs,
    totalFailuresLastHour,
    maxQueueLagSeconds,
    tenantCount: tenants.size,
  }
}
