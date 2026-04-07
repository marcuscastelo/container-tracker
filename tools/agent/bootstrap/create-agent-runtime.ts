import {
  type AgentPathLayout,
  ensureAgentPathLayout,
  resolveAgentPathLayout,
} from '@tools/agent/runtime-paths'

export function createAgentRuntimeBootstrap(): { readonly layout: AgentPathLayout } {
  const layout = resolveAgentPathLayout()
  ensureAgentPathLayout(layout)
  return { layout }
}
