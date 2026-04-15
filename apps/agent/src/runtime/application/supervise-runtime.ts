import type { ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import type { ChildRunOutcome } from '@agent/runtime/domain/runtime-lifecycle'
import { monitorRuntimeHealthGate } from '@agent/runtime/application/run-health-check'
import { startRuntime } from '@agent/runtime/application/start-runtime'
import { createRotatingChunkWriter } from '@agent/runtime/infrastructure/runtime-stdio-log-writer'

const MAX_RUNTIME_STDIO_LOG_FILE_SIZE_BYTES = 20 * 1024 * 1024

function mirrorRuntimeOutput(command: {
  readonly child: ChildProcess
  readonly logsDir: string
  readonly onOutput: () => void
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
}): Promise<ChildRunOutcome> {
  const child = startRuntime({
    scriptPath: command.scriptPath,
    execArgv: resolveRuntimeExecArgv(command.scriptPath),
    env: command.env,
    stdio: 'pipe',
  })
  command.onRuntimeStarted(child)
  mirrorRuntimeOutput({
    child,
    logsDir: command.logsDir,
    onOutput: command.onOutput,
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
}): Promise<ChildRunOutcome> {
  const child = startRuntime({
    scriptPath: command.scriptPath,
    execArgv: resolveRuntimeExecArgv(command.scriptPath),
    env: command.env,
    stdio: 'pipe',
  })
  command.onRuntimeStarted(child)
  mirrorRuntimeOutput({
    child,
    logsDir: command.logsDir,
    onOutput: command.onOutput,
  })

  const exitCode = await new Promise<number | null>((resolve) => {
    child.once('exit', (code) => {
      resolve(code)
    })
  })

  return {
    exitCode,
    startupConfirmed: false,
    startupTimedOut: false,
    healthGraceConfirmed: false,
  }
}
