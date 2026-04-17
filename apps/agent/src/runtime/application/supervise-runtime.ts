import type { ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { monitorRuntimeHealthGate } from '@agent/runtime/application/run-health-check'
import { startRuntime } from '@agent/runtime/application/start-runtime'
import type { ChildRunOutcome } from '@agent/runtime/domain/runtime-lifecycle'
import { createRotatingChunkWriter } from '@agent/runtime/infrastructure/runtime-stdio-log-writer'

export type { ChildRunOutcome } from '@agent/runtime/domain/runtime-lifecycle'

const MAX_RUNTIME_STDIO_LOG_FILE_SIZE_BYTES = 20 * 1024 * 1024

type RuntimeLifecycleLogger = (message: string) => void

function toErrorDetails(error: unknown): string {
  if (error instanceof Error) {
    if (typeof error.stack === 'string' && error.stack.length > 0) {
      return error.stack
    }
    return error.message
  }
  return String(error)
}

function logLifecycle(log: RuntimeLifecycleLogger | undefined, message: string): void {
  if (!log) {
    return
  }
  log(message)
}

function attachChildLifecycleLogging(command: {
  readonly child: ChildProcess
  readonly expectedVersion: string
  readonly scriptPath: string
  readonly execArgv: readonly string[]
  readonly log?: RuntimeLifecycleLogger
}): void {
  command.child.once('spawn', () => {
    logLifecycle(
      command.log,
      `runtime child spawn event pid=${command.child.pid ?? 'unknown'} version=${command.expectedVersion} script=${command.scriptPath} exec_argv=[${command.execArgv.join(', ')}]`,
    )
  })
  command.child.once('error', (error) => {
    logLifecycle(
      command.log,
      `runtime child error event version=${command.expectedVersion} script=${command.scriptPath} error=${toErrorDetails(error)}`,
    )
  })
  command.child.once('exit', (code, signal) => {
    logLifecycle(
      command.log,
      `runtime child exit event version=${command.expectedVersion} code=${code ?? 'null'} signal=${signal ?? 'null'}`,
    )
  })
  command.child.once('close', (code, signal) => {
    logLifecycle(
      command.log,
      `runtime child close event version=${command.expectedVersion} code=${code ?? 'null'} signal=${signal ?? 'null'}`,
    )
  })
  command.child.once('disconnect', () => {
    logLifecycle(command.log, `runtime child disconnect event version=${command.expectedVersion}`)
  })
}

function mirrorRuntimeOutput(command: {
  readonly child: ChildProcess
  readonly logsDir: string
  readonly onOutput: () => void
  readonly log?: RuntimeLifecycleLogger
}): void {
  const stdout = command.child.stdout
  if (stdout) {
    const stdoutLogPath = path.join(command.logsDir, 'agent.out.log')
    const stdoutWriter = createRotatingChunkWriter({
      logPath: stdoutLogPath,
      maxSizeBytes: MAX_RUNTIME_STDIO_LOG_FILE_SIZE_BYTES,
    })
    stdout.on('data', (chunk: Buffer | string) => {
      process.stdout.write(chunk)
      stdoutWriter.write(chunk)
      command.onOutput()
    })
    stdout.on('error', (error) => {
      logLifecycle(command.log, `runtime stdout stream error: ${toErrorDetails(error)}`)
    })
    command.child.once('exit', () => {
      void stdoutWriter.close()
    })
  }

  const stderr = command.child.stderr
  if (stderr) {
    const stderrLogPath = path.join(command.logsDir, 'agent.err.log')
    const stderrWriter = createRotatingChunkWriter({
      logPath: stderrLogPath,
      maxSizeBytes: MAX_RUNTIME_STDIO_LOG_FILE_SIZE_BYTES,
    })
    stderr.on('data', (chunk: Buffer | string) => {
      process.stderr.write(chunk)
      stderrWriter.write(chunk)
      command.onOutput()
    })
    stderr.on('error', (error) => {
      logLifecycle(command.log, `runtime stderr stream error: ${toErrorDetails(error)}`)
    })
    command.child.once('exit', () => {
      void stderrWriter.close()
    })
  }
}

export function resolveRuntimeExecArgv(scriptPath: string): readonly string[] {
  const registerCandidates = [
    path.resolve(path.dirname(scriptPath), './runtime/register-alias-loader.js'),
    path.resolve(path.dirname(scriptPath), '../runtime/register-alias-loader.js'),
  ]

  for (const registerPath of registerCandidates) {
    if (fs.existsSync(registerPath) && fs.statSync(registerPath).isFile()) {
      return [`--import=${pathToFileURL(registerPath).href}`]
    }
  }

  return []
}

export async function runRuntimeWithHealthGate(command: {
  readonly scriptPath: string
  readonly expectedVersion: string
  readonly startupTimeoutMs: number
  readonly healthGraceMs: number
  readonly healthPath: string
  readonly env: NodeJS.ProcessEnv
  readonly logsDir: string
  readonly onOutput: () => void
  readonly onStabilityConfirmed: () => void
  readonly onRuntimeStarted: (child: ChildProcess) => void
  readonly log?: RuntimeLifecycleLogger
}): Promise<ChildRunOutcome> {
  const execArgv = resolveRuntimeExecArgv(command.scriptPath)
  logLifecycle(
    command.log,
    `launching runtime with health gate version=${command.expectedVersion} script=${command.scriptPath} startup_timeout_ms=${command.startupTimeoutMs} health_grace_ms=${command.healthGraceMs} exec_argv=[${execArgv.join(', ')}]`,
  )
  const child = startRuntime({
    scriptPath: command.scriptPath,
    execArgv,
    env: command.env,
    stdio: 'pipe',
  })
  attachChildLifecycleLogging({
    child,
    expectedVersion: command.expectedVersion,
    scriptPath: command.scriptPath,
    execArgv,
    log: command.log,
  })
  command.onRuntimeStarted(child)
  mirrorRuntimeOutput({
    child,
    logsDir: command.logsDir,
    onOutput: command.onOutput,
    log: command.log,
  })

  const exitPromise = new Promise<number | null>((resolve) => {
    child.once('exit', (code) => {
      resolve(code)
    })
  })

  const healthMonitorPromise = monitorRuntimeHealthGate({
    child,
    expectedVersion: command.expectedVersion,
    startupTimeoutMs: command.startupTimeoutMs,
    healthGraceMs: command.healthGraceMs,
    healthPath: command.healthPath,
    onStabilityConfirmed: command.onStabilityConfirmed,
  })

  const exitCode = await exitPromise
  const health = await healthMonitorPromise
  logLifecycle(
    command.log,
    `runtime health gate completed version=${command.expectedVersion} exit_code=${exitCode ?? 'null'} startup_confirmed=${health.startupConfirmed} startup_timed_out=${health.startupTimedOut} health_grace_confirmed=${health.healthGraceConfirmed}`,
  )

  return {
    exitCode,
    startupConfirmed: health.startupConfirmed,
    startupTimedOut: health.startupTimedOut,
    healthGraceConfirmed: health.healthGraceConfirmed,
  }
}

export async function runRuntimeWithoutHealthGate(command: {
  readonly scriptPath: string
  readonly expectedVersion: string
  readonly env: NodeJS.ProcessEnv
  readonly logsDir: string
  readonly onOutput: () => void
  readonly onRuntimeStarted: (child: ChildProcess) => void
  readonly log?: RuntimeLifecycleLogger
}): Promise<ChildRunOutcome> {
  const execArgv = resolveRuntimeExecArgv(command.scriptPath)
  logLifecycle(
    command.log,
    `launching runtime without health gate version=${command.expectedVersion} script=${command.scriptPath} exec_argv=[${execArgv.join(', ')}]`,
  )
  const child = startRuntime({
    scriptPath: command.scriptPath,
    execArgv,
    env: command.env,
    stdio: 'pipe',
  })
  attachChildLifecycleLogging({
    child,
    expectedVersion: command.expectedVersion,
    scriptPath: command.scriptPath,
    execArgv,
    log: command.log,
  })
  command.onRuntimeStarted(child)
  mirrorRuntimeOutput({
    child,
    logsDir: command.logsDir,
    onOutput: command.onOutput,
    log: command.log,
  })

  const exitCode = await new Promise<number | null>((resolve) => {
    child.once('exit', (code) => {
      resolve(code)
    })
  })
  logLifecycle(
    command.log,
    `runtime exited without health gate version=${command.expectedVersion} exit_code=${exitCode ?? 'null'}`,
  )

  return {
    exitCode,
    startupConfirmed: false,
    startupTimedOut: false,
    healthGraceConfirmed: false,
  }
}
