import type { AgentControlRendererApi } from '@tools/agent-control-ui/ipc'

declare global {
  // biome-ignore lint/style/useConsistentTypeDefinitions: Window augmentation relies on interface merging.
  interface Window {
    agentControl: AgentControlRendererApi
    agentControlMeta?: {
      readonly logsRequireAction?: boolean
    }
  }
}
