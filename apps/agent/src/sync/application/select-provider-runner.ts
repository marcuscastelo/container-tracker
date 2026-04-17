import type { AgentProvider } from '@agent/core/types/provider'
import type { ProviderRunner } from '@agent/providers/common/provider-result'
import type { ProviderRunnerRegistry } from '@agent/providers/common/provider-runner.registry'

export function selectProviderRunner(command: {
  readonly registry: ProviderRunnerRegistry
  readonly provider: AgentProvider
}): ProviderRunner | null {
  return command.registry.selectProviderRunner(command.provider)
}
