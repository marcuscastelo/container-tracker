import type { AgentProvider } from '@agent/core/types/provider'
import { createCmaCgmRunner } from '@agent/providers/cmacgm/run-cmacgm-sync'
import type { ProviderRunner } from '@agent/providers/common/provider-result'
import { createMaerskRunner } from '@agent/providers/maersk/run-maersk-sync'
import { createMscRunner } from '@agent/providers/msc/run-msc-sync'
import { createOneRunner } from '@agent/providers/one/run-one-sync'
import { createPilRunner } from '@agent/providers/pil/run-pil-sync'

export type ProviderRunnerRegistry = {
  selectProviderRunner(provider: AgentProvider): ProviderRunner | null
}

export function createProviderRunnerRegistry(command?: {
  readonly runners?: readonly ProviderRunner[]
}): ProviderRunnerRegistry {
  const runners =
    command?.runners ??
    ([
      createMaerskRunner(),
      createMscRunner(),
      createCmaCgmRunner(),
      createPilRunner(),
      createOneRunner(),
    ] as const)

  const byProvider = new Map<AgentProvider, ProviderRunner>()
  for (const runner of runners) {
    byProvider.set(runner.provider, runner)
  }

  return {
    selectProviderRunner(provider: AgentProvider): ProviderRunner | null {
      return byProvider.get(provider) ?? null
    },
  }
}
