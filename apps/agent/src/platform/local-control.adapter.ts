import { execFile, spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

import type {
  AgentPlatformControlAdapter,
  PlatformControlCommand,
  PlatformServiceQueryResult,
} from '@agent/platform/platform.contract'

const DEFAULT_LINUX_SERVICE_NAME = 'container-tracker-agent'
const DEFAULT_WINDOWS_TASK_NAME = 'ContainerTrackerAgent'
const DEFAULT_CONTROL_COMMAND_TIMEOUT_MS = 45_000
const DEFAULT_PROCESS_EXIT_WAIT_MS = 5_000
const PROCESS_EXIT_POLL_INTERVAL_MS = 100
const DEV_FALLBACK_DATA_DIR_NAME = '.agent-runtime'
const SUPERVISOR_PID_FILE_NAME = 'supervisor.pid'
const SUPERVISOR_CONTROL_FILE_NAME = 'supervisor-control.json'

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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
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

function shouldUseLocalRuntimeProcessControl(): boolean {
  return process.env.CT_AGENT_UI_INSTALLED === '0'
}

function resolveLocalRuntimeDataDir(): string {
  const configured = process.env.AGENT_DATA_DIR?.trim()
  if (typeof configured === 'string' && configured.length > 0) {
    return configured
  }

  return path.resolve(process.cwd(), DEV_FALLBACK_DATA_DIR_NAME)
}

function resolveLocalRuntimeConfigPaths(): {
  readonly dataDir: string
  readonly dotenvPath: string
  readonly bootstrapPath: string
  readonly runtimeStatePath: string
  readonly supervisorPidPath: string
  readonly supervisorControlPath: string
} {
  const dataDir = resolveLocalRuntimeDataDir()
  const dotenvPath = process.env.DOTENV_PATH?.trim() || path.join(dataDir, 'config.env')
  const bootstrapPath =
    process.env.BOOTSTRAP_DOTENV_PATH?.trim() || path.join(dataDir, 'bootstrap.env')
  return {
    dataDir,
    dotenvPath,
    bootstrapPath,
    runtimeStatePath: path.join(dataDir, 'runtime-state.json'),
    supervisorPidPath: path.join(dataDir, SUPERVISOR_PID_FILE_NAME),
    supervisorControlPath: path.join(dataDir, SUPERVISOR_CONTROL_FILE_NAME),
  }
}

function readSupervisorPid(pidFilePath: string): number | null {
  if (!fs.existsSync(pidFilePath)) {
    return null
  }

  const raw = fs.readFileSync(pidFilePath, 'utf8').trim()
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null
  }

  return parsed
}

function extractPositiveIntegerPid(value: unknown): number | null {
  if (typeof value !== 'object' || value === null) {
    return null
  }

  const pid = Reflect.get(value, 'pid')
  if (typeof pid !== 'number' || !Number.isInteger(pid) || pid <= 0) {
    return null
  }

  return pid
}

function readRuntimePidFromState(runtimeStatePath: string): number | null {
  if (!fs.existsSync(runtimeStatePath)) {
    return null
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(runtimeStatePath, 'utf8'))
    return extractPositiveIntegerPid(parsed)
  } catch {
    return null
  }
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function cleanupStaleSupervisorPidFile(pidFilePath: string): void {
  try {
    fs.rmSync(pidFilePath, { force: true })
  } catch {
    // Best effort stale-pid cleanup.
  }
}

async function waitForProcessExit(pid: number, timeoutMs: number): Promise<boolean> {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    if (!isProcessAlive(pid)) {
      return true
    }

    await sleep(PROCESS_EXIT_POLL_INTERVAL_MS)
  }

  return !isProcessAlive(pid)
}

async function resolveRuntimeParentPid(runtimePid: number): Promise<number | null> {
  try {
    const result = await runCommand('ps', ['-o', 'ppid=', '-p', String(runtimePid)])
    const parsed = Number.parseInt(result.stdout.trim(), 10)
    if (!Number.isFinite(parsed) || parsed <= 1) {
      return null
    }

    return parsed
  } catch {
    return null
  }
}

async function resolveLocalSupervisorPidFromRuntimeState(
  runtimeStatePath: string,
): Promise<number | null> {
  const runtimePid = readRuntimePidFromState(runtimeStatePath)
  if (runtimePid === null || !isProcessAlive(runtimePid)) {
    return null
  }

  const parentPid = await resolveRuntimeParentPid(runtimePid)
  if (parentPid === null || !isProcessAlive(parentPid)) {
    return null
  }

  return parentPid
}

async function resolveEffectiveSupervisorPid(command: {
  readonly supervisorPidPath: string
  readonly runtimeStatePath: string
}): Promise<number | null> {
  const pidFromFile = readSupervisorPid(command.supervisorPidPath)
  if (pidFromFile !== null && isProcessAlive(pidFromFile)) {
    return pidFromFile
  }

  cleanupStaleSupervisorPidFile(command.supervisorPidPath)
  return resolveLocalSupervisorPidFromRuntimeState(command.runtimeStatePath)
}

function requestLocalRuntimeRestart(supervisorControlPath: string): void {
  fs.mkdirSync(path.dirname(supervisorControlPath), { recursive: true })
  fs.writeFileSync(
    supervisorControlPath,
    `${JSON.stringify(
      {
        drain_requested: true,
        reason: 'manual',
        requested_at: new Date().toISOString(),
      },
      null,
      2,
    )}\n`,
    'utf8',
  )
}

function startLocalRuntimeSupervisor(command: {
  readonly dataDir: string
  readonly dotenvPath: string
  readonly bootstrapPath: string
}): void {
  const repoRoot = process.cwd()
  const launcherPath = path.join(repoRoot, 'scripts', 'agent', 'run-linux.sh')
  if (!fs.existsSync(launcherPath)) {
    throw new Error(`Local runtime launcher not found at ${launcherPath}`)
  }

  fs.mkdirSync(command.dataDir, { recursive: true })

  const child = spawn('bash', [launcherPath], {
    cwd: repoRoot,
    detached: true,
    stdio: 'ignore',
    shell: false,
    env: {
      ...process.env,
      AGENT_DATA_DIR: command.dataDir,
      DOTENV_PATH: command.dotenvPath,
      BOOTSTRAP_DOTENV_PATH: command.bootstrapPath,
    },
  })
  child.unref()
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
  if (shouldUseLocalRuntimeProcessControl()) {
    const { supervisorPidPath, runtimeStatePath } = resolveLocalRuntimeConfigPaths()
    const pid = await resolveEffectiveSupervisorPid({
      supervisorPidPath,
      runtimeStatePath,
    })
    if (pid === null) {
      return { status: 'stopped', detail: 'local supervisor pid not found' }
    }

    return { status: 'running', detail: `local supervisor pid=${pid}` }
  }

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
      if (shouldUseLocalRuntimeProcessControl()) {
        const { dataDir, dotenvPath, bootstrapPath, supervisorPidPath, runtimeStatePath } =
          resolveLocalRuntimeConfigPaths()
        const runningPid = await resolveEffectiveSupervisorPid({
          supervisorPidPath,
          runtimeStatePath,
        })
        if (runningPid !== null) {
          return
        }

        startLocalRuntimeSupervisor({
          dataDir,
          dotenvPath,
          bootstrapPath,
        })
        return
      }

      await runCommand('systemctl', ['start', resolveLinuxServiceName(command)])
    },
    async stopAgent(command) {
      if (shouldUseLocalRuntimeProcessControl()) {
        const { supervisorPidPath, runtimeStatePath } = resolveLocalRuntimeConfigPaths()
        const supervisorPid = await resolveEffectiveSupervisorPid({
          supervisorPidPath,
          runtimeStatePath,
        })
        if (supervisorPid !== null) {
          process.kill(supervisorPid, 'SIGTERM')
          const exitedGracefully = await waitForProcessExit(
            supervisorPid,
            DEFAULT_PROCESS_EXIT_WAIT_MS,
          )
          if (!exitedGracefully) {
            process.kill(supervisorPid, 'SIGKILL')
            await waitForProcessExit(supervisorPid, 1_000)
          }
          cleanupStaleSupervisorPidFile(supervisorPidPath)
        }

        return
      }

      await runCommand('systemctl', ['stop', resolveLinuxServiceName(command)])
    },
    async restartAgent(command) {
      if (shouldUseLocalRuntimeProcessControl()) {
        const {
          dataDir,
          dotenvPath,
          bootstrapPath,
          supervisorPidPath,
          runtimeStatePath,
          supervisorControlPath,
        } = resolveLocalRuntimeConfigPaths()
        const supervisorPid = await resolveEffectiveSupervisorPid({
          supervisorPidPath,
          runtimeStatePath,
        })
        if (supervisorPid === null) {
          startLocalRuntimeSupervisor({
            dataDir,
            dotenvPath,
            bootstrapPath,
          })
          return
        }

        requestLocalRuntimeRestart(supervisorControlPath)
        return
      }

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
