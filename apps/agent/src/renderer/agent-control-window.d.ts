import type { AgentControlRendererApi } from '@agent/electron/ipc'

declare global {
  // biome-ignore lint/style/useConsistentTypeDefinitions: Window augmentation relies on interface merging.
  interface Window {
    agentControl: AgentControlRendererApi
    agentControlMeta?: {
      readonly logsRequireAction?: boolean
      readonly installedMode?: boolean
    }
  }
}
