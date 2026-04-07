import {
  ensureAgentPathLayout,
  resolveAgentPathLayout,
  type AgentPathLayout,
} from '@tools/agent/runtime-paths'

export function createAgentRuntimeBootstrap(): { readonly layout: AgentPathLayout } {
  const layout = resolveAgentPathLayout()
  ensureAgentPathLayout(layout)
  return { layout }
}
