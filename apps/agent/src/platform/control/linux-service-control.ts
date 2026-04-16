import process from 'node:process'
import {
  type ControlCommandRunner,
  createControlCommandRunner,
  toErrorMessage,
} from '@agent/platform/control/control-command'
import type { AgentControlStrategy } from '@agent/platform/control/control-strategy.contract'
import type {
  PlatformControlCommand,
  PlatformServiceQueryResult,
} from '@agent/platform/platform.contract'

const DEFAULT_LINUX_SERVICE_NAME = 'container-tracker-agent'

type CreateLinuxServiceControlStrategyDeps = {
  readonly env?: NodeJS.ProcessEnv
  readonly runCommand?: ControlCommandRunner
}

export function resolveLinuxServiceName(
  command?: PlatformControlCommand,
  env: NodeJS.ProcessEnv = process.env,
): string {
  return (
    command?.serviceName?.trim() || env.AGENT_SERVICE_NAME?.trim() || DEFAULT_LINUX_SERVICE_NAME
  )
}

async function queryLinuxService(command: {
  readonly runCommand: ControlCommandRunner
  readonly env: NodeJS.ProcessEnv
  readonly platformCommand?: PlatformControlCommand
}): Promise<PlatformServiceQueryResult> {
  const serviceName = resolveLinuxServiceName(command.platformCommand, command.env)

  try {
    const result = await command.runCommand('systemctl', ['is-active', serviceName])
    const status = result.stdout.trim().toLowerCase()
    if (status === 'active') {
      return { status: 'running', detail: result.stdout.trim() }
    }

    return { status: 'unknown', detail: result.stdout.trim() }
  } catch (error) {
    const detail = toErrorMessage(error)
    if (detail.toLowerCase().includes('inactive') || detail.toLowerCase().includes('unknown')) {
      return { status: 'stopped', detail }
    }

    return { status: 'unknown', detail }
  }
}

export function createLinuxServiceControlStrategy(
  providedDeps?: CreateLinuxServiceControlStrategyDeps,
): AgentControlStrategy {
  const env = providedDeps?.env ?? process.env
  const runCommand = providedDeps?.runCommand ?? createControlCommandRunner(env)

  return {
    queryAgent(platformCommand) {
      return queryLinuxService({
        runCommand,
        env,
        platformCommand,
      })
    },
    async startAgent(platformCommand) {
      await runCommand('systemctl', ['start', resolveLinuxServiceName(platformCommand, env)])
    },
    async stopAgent(platformCommand) {
      await runCommand('systemctl', ['stop', resolveLinuxServiceName(platformCommand, env)])
    },
    async restartAgent(platformCommand) {
      await runCommand('systemctl', ['restart', resolveLinuxServiceName(platformCommand, env)])
    },
  }
}
