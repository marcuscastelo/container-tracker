import { execFile } from 'node:child_process'
import process from 'node:process'

const DEFAULT_CONTROL_COMMAND_TIMEOUT_MS = 45_000

type ExecFileFailure = {
  readonly killed?: boolean
  readonly signal?: NodeJS.Signals | null
}

export type ControlCommandResult = {
  readonly stdout: string
  readonly stderr: string
}

export type ControlCommandRunner = (
  command: string,
  args: readonly string[],
) => Promise<ControlCommandResult>

function isExecFileFailure(value: unknown): value is ExecFileFailure {
  return typeof value === 'object' && value !== null
}

export function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}

export function resolveControlCommandTimeoutMs(env: NodeJS.ProcessEnv = process.env): number {
  const rawValue = env.AGENT_CONTROL_COMMAND_TIMEOUT_MS
  if (typeof rawValue !== 'string') {
    return DEFAULT_CONTROL_COMMAND_TIMEOUT_MS
  }

  const parsed = Number.parseInt(rawValue, 10)
  if (!Number.isFinite(parsed) || parsed < 1) {
    return DEFAULT_CONTROL_COMMAND_TIMEOUT_MS
  }

  return parsed
}

export function createControlCommandRunner(
  env: NodeJS.ProcessEnv = process.env,
): ControlCommandRunner {
  return (command, args) => {
    const timeoutMs = resolveControlCommandTimeoutMs(env)

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

            reject(new Error(`${command} ${args.join(' ')} failed: ${baseDetail}`))
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
}
