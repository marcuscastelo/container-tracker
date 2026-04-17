import type { AgentControlStrategy } from '@agent/platform/control/control-strategy.contract'
import {
  createLinuxDevProcessControlStrategy,
  shouldUseLocalRuntimeProcessControl,
} from '@agent/platform/control/linux-dev-process-control'
import { createLinuxServiceControlStrategy } from '@agent/platform/control/linux-service-control'
import { createWindowsProcessControlStrategy } from '@agent/platform/control/windows-process-control'
import type { AgentPlatformControlAdapter } from '@agent/platform/platform.contract'

function createAdapter(
  key: AgentPlatformControlAdapter['key'],
  strategy: AgentControlStrategy,
): AgentPlatformControlAdapter {
  return {
    key,
    queryAgent(command) {
      return strategy.queryAgent(command)
    },
    startAgent(command) {
      return strategy.startAgent(command)
    },
    stopAgent(command) {
      return strategy.stopAgent(command)
    },
    restartAgent(command) {
      return strategy.restartAgent(command)
    },
  }
}

function createLinuxControlStrategy(): AgentControlStrategy {
  return shouldUseLocalRuntimeProcessControl()
    ? createLinuxDevProcessControlStrategy()
    : createLinuxServiceControlStrategy()
}

export function createLinuxLocalControlAdapter(): AgentPlatformControlAdapter {
  return createAdapter('linux', createLinuxControlStrategy())
}

export function createWindowsLocalControlAdapter(): AgentPlatformControlAdapter {
  return createAdapter('windows', createWindowsProcessControlStrategy())
}
