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

const DEFAULT_WINDOWS_TASK_NAME = 'ContainerTrackerAgent'

type CreateWindowsTaskControlStrategyDeps = {
  readonly env?: NodeJS.ProcessEnv
  readonly runCommand?: ControlCommandRunner
}

export function resolveWindowsTaskName(
  command?: PlatformControlCommand,
  env: NodeJS.ProcessEnv = process.env,
): string {
  return (
    command?.serviceName?.trim() || env.AGENT_WINDOWS_TASK_NAME?.trim() || DEFAULT_WINDOWS_TASK_NAME
  )
}

export function buildWindowsTaskRunCommand(taskName: string): string {
  return `schtasks /Run /TN "${taskName}" >NUL 2>&1`
}

export function buildWindowsTaskEndCommand(taskName: string): string {
  return `schtasks /End /TN "${taskName}" >NUL 2>&1 || exit /B 0`
}

export function parseWindowsTaskQueryOutput(output: string): PlatformServiceQueryResult {
  const normalized = output.toLowerCase()
  if (
    normalized.includes('status: running') ||
    normalized.includes('scheduled task state: running')
  ) {
    return { status: 'running', detail: output.trim() }
  }

  if (
    normalized.includes('status: ready') ||
    normalized.includes('status: queued') ||
    normalized.includes('scheduled task state: ready')
  ) {
    return { status: 'stopped', detail: output.trim() }
  }

  return { status: 'unknown', detail: output.trim() }
}

function runWindowsTaskCommand(command: {
  readonly runCommand: ControlCommandRunner
  readonly commandLine: string
}): Promise<void> {
  return command
    .runCommand('cmd.exe', ['/d', '/s', '/c', command.commandLine])
    .then(() => undefined)
}

async function queryWindowsTask(command: {
  readonly runCommand: ControlCommandRunner
  readonly env: NodeJS.ProcessEnv
  readonly platformCommand?: PlatformControlCommand
}): Promise<PlatformServiceQueryResult> {
  const taskName = resolveWindowsTaskName(command.platformCommand, command.env)

  try {
    const result = await command.runCommand('schtasks', [
      '/Query',
      '/TN',
      taskName,
      '/FO',
      'LIST',
      '/V',
    ])
    return parseWindowsTaskQueryOutput(result.stdout)
  } catch (error) {
    return {
      status: 'unknown',
      detail: toErrorMessage(error),
    }
  }
}

export function createWindowsTaskControlStrategy(
  providedDeps?: CreateWindowsTaskControlStrategyDeps,
): AgentControlStrategy {
  const env = providedDeps?.env ?? process.env
  const runCommand = providedDeps?.runCommand ?? createControlCommandRunner(env)

  return {
    queryAgent(platformCommand) {
      return queryWindowsTask({
        runCommand,
        env,
        platformCommand,
      })
    },
    async startAgent(platformCommand) {
      await runWindowsTaskCommand({
        runCommand,
        commandLine: buildWindowsTaskRunCommand(resolveWindowsTaskName(platformCommand, env)),
      })
    },
    async stopAgent(platformCommand) {
      await runWindowsTaskCommand({
        runCommand,
        commandLine: buildWindowsTaskEndCommand(resolveWindowsTaskName(platformCommand, env)),
      })
    },
    async restartAgent(platformCommand) {
      const taskName = resolveWindowsTaskName(platformCommand, env)
      await runWindowsTaskCommand({
        runCommand,
        commandLine: buildWindowsTaskEndCommand(taskName),
      })
      await runWindowsTaskCommand({
        runCommand,
        commandLine: buildWindowsTaskRunCommand(taskName),
      })
    },
  }
}
