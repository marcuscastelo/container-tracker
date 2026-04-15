import type { AgentPathLayout } from '@agent/config/config.contract'
import { ensureAgentPathLayout, resolveAgentPathLayout } from '@agent/config/resolve-agent-paths'

export function createAgentRuntimeBootstrap(): { readonly layout: AgentPathLayout } {
  const layout = resolveAgentPathLayout()
  ensureAgentPathLayout(layout)
  return { layout }
}
