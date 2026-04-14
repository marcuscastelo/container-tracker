import { execFile } from 'node:child_process'
import process from 'node:process'

import type {
  AgentPlatformControlAdapter,
  PlatformControlCommand,
  PlatformServiceQueryResult,
} from '@agent/platform/platform.contract'

const DEFAULT_LINUX_SERVICE_NAME = 'container-tracker-agent'
const DEFAULT_WINDOWS_TASK_NAME = 'ContainerTrackerAgent'
const DEFAULT_CONTROL_COMMAND_TIMEOUT_MS = 45_000

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}

function isExecFileFailure(value: unknown): value is {
  readonly killed?: boolean
  readonly signal?: NodeJS.Signals | null
  readonly code?: string | number | null
} {
  return typeof value === 'object' && value !== null
}

function resolveControlCommandTimeoutMs(): number {
  const rawValue = process.env.AGENT_CONTROL_COMMAND_TIMEOUT_MS
  if (typeof rawValue !== 'string') {
    return DEFAULT_CONTROL_COMMAND_TIMEOUT_MS
  }

  const parsed = Number.parseInt(rawValue, 10)
  if (!Number.isFinite(parsed) || parsed < 1) {
    return DEFAULT_CONTROL_COMMAND_TIMEOUT_MS
  }

  return parsed
}

function runCommand(
  command: string,
  args: readonly string[],
): Promise<{
  readonly stdout: string
  readonly stderr: string
}> {
  const timeoutMs = resolveControlCommandTimeoutMs()

  return new Promise((resolve, reject) => {
    execFile(
      command,
      [...args],
      {
        maxBuffer: 1024 * 1024 * 4,
        timeout: timeoutMs,
      },
      (error, stdout, stderr) => {
        if (error) {
          const baseDetail = stderr.trim() || stdout.trim() || toErrorMessage(error)
          if (isExecFileFailure(error) && error.killed === true && error.signal === 'SIGTERM') {
            reject(
              new Error(`Command timed out after ${timeoutMs}ms: ${command} ${args.join(' ')}`),
            )
            return
          }

          const detail = `${command} ${args.join(' ')} failed: ${baseDetail}`
          reject(new Error(detail))
          return
        }

        resolve({
          stdout,
          stderr,
        })
      },
    )
  })
}

function resolveLinuxServiceName(command?: PlatformControlCommand): string {
  return (
    command?.serviceName?.trim() ||
    process.env.AGENT_SERVICE_NAME?.trim() ||
    DEFAULT_LINUX_SERVICE_NAME
  )
}

function resolveWindowsTaskName(command?: PlatformControlCommand): string {
  return (
    command?.serviceName?.trim() ||
    process.env.AGENT_WINDOWS_TASK_NAME?.trim() ||
    DEFAULT_WINDOWS_TASK_NAME
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

async function queryLinuxService(
  command?: PlatformControlCommand,
): Promise<PlatformServiceQueryResult> {
  const serviceName = resolveLinuxServiceName(command)

  try {
    const result = await runCommand('systemctl', ['is-active', serviceName])
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

function runWindowsTaskCommand(commandLine: string): Promise<void> {
  return runCommand('cmd.exe', ['/d', '/s', '/c', commandLine]).then(() => undefined)
}

async function queryWindowsTask(
  command?: PlatformControlCommand,
): Promise<PlatformServiceQueryResult> {
  const taskName = resolveWindowsTaskName(command)

  try {
    const result = await runCommand('schtasks', ['/Query', '/TN', taskName, '/FO', 'LIST', '/V'])
    return parseWindowsTaskQueryOutput(result.stdout)
  } catch (error) {
    return {
      status: 'unknown',
      detail: toErrorMessage(error),
    }
  }
}

export function createLinuxLocalControlAdapter(): AgentPlatformControlAdapter {
  return {
    key: 'linux',
    queryAgent(command) {
      return queryLinuxService(command)
    },
    async startAgent(command) {
      await runCommand('systemctl', ['start', resolveLinuxServiceName(command)])
    },
    async stopAgent(command) {
      await runCommand('systemctl', ['stop', resolveLinuxServiceName(command)])
    },
    async restartAgent(command) {
      await runCommand('systemctl', ['--no-block', 'restart', resolveLinuxServiceName(command)])
    },
  }
}

export function createWindowsLocalControlAdapter(): AgentPlatformControlAdapter {
  return {
    key: 'windows',
    queryAgent(command) {
      return queryWindowsTask(command)
    },
    async startAgent(command) {
      await runWindowsTaskCommand(buildWindowsTaskRunCommand(resolveWindowsTaskName(command)))
    },
    async stopAgent(command) {
      await runWindowsTaskCommand(buildWindowsTaskEndCommand(resolveWindowsTaskName(command)))
    },
    async restartAgent(command) {
      const taskName = resolveWindowsTaskName(command)
      await runWindowsTaskCommand(buildWindowsTaskEndCommand(taskName))
      await runWindowsTaskCommand(buildWindowsTaskRunCommand(taskName))
    },
  }
}
