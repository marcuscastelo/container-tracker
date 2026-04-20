import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import type { AgentControlStrategy } from '@agent/platform/control/control-strategy.contract'
import type { PlatformPathResolution } from '@agent/platform/platform.contract'
import {
  normalizeOptionalWindowsEnv,
  resolveWindowsInstallRoot,
  resolveWindowsPlatformPaths,
} from '@agent/platform/windows-paths'
import { writeSupervisorControl } from '@agent/runtime/infrastructure/supervisor-control.repository'

const SUPERVISOR_PID_FILE_NAME = 'supervisor.pid'
const DEFAULT_PROCESS_EXIT_WAIT_MS = 5_000
const PROCESS_EXIT_POLL_INTERVAL_MS = 100

type WindowsProcessControlPaths = {
  readonly layout: PlatformPathResolution
  readonly installRoot: string
  readonly startupExecutablePath: string
  readonly supervisorPidPath: string
  readonly runtimeStatePath: string
  readonly supervisorControlPath: string
}

type StartWindowsStartupCommand = {
  readonly startupExecutablePath: string
  readonly installRoot: string
  readonly layout: PlatformPathResolution
  readonly runtimeOnly: boolean
}

type CreateWindowsProcessControlStrategyDeps = {
  readonly env?: NodeJS.ProcessEnv
  readonly resolvePaths?: (env: NodeJS.ProcessEnv) => WindowsProcessControlPaths
  readonly resolveSupervisorPid?: (command: {
    readonly supervisorPidPath: string
    readonly runtimeStatePath: string
  }) => Promise<number | null>
  readonly startStartup?: (command: StartWindowsStartupCommand) => void
  readonly requestRestart?: (supervisorControlPath: string) => void
  readonly killProcess?: (pid: number, signal?: NodeJS.Signals | number) => void
  readonly isProcessAlive?: (pid: number) => boolean
  readonly waitForProcessExit?: (pid: number, timeoutMs: number) => Promise<boolean>
  readonly cleanupSupervisorPidFile?: (pidFilePath: string) => void
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

async function waitForProcessExit(
  pid: number,
  timeoutMs: number,
  isAlive: (pid: number) => boolean = isProcessAlive,
): Promise<boolean> {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    if (!isAlive(pid)) {
      return true
    }

    await sleep(PROCESS_EXIT_POLL_INTERVAL_MS)
  }

  return !isAlive(pid)
}

function readPidFile(pidFilePath: string): number | null {
  if (!fs.existsSync(pidFilePath)) {
    return null
  }

  const raw = fs.readFileSync(pidFilePath, 'utf8').trim()
  const parsed = Number.parseInt(raw, 10)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
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
    const parsed: unknown = JSON.parse(fs.readFileSync(runtimeStatePath, 'utf8'))
    return extractPositiveIntegerPid(parsed)
  } catch {
    return null
  }
}

function cleanupStaleSupervisorPidFile(pidFilePath: string): void {
  try {
    fs.rmSync(pidFilePath, { force: true })
  } catch {
    // Best effort stale-pid cleanup.
  }
}

export function resolveWindowsStartupExecutablePath(env: NodeJS.ProcessEnv): string {
  const explicitPath = normalizeOptionalWindowsEnv(env.CT_AGENT_STARTUP_EXE)
  if (explicitPath) {
    return explicitPath
  }

  return path.win32.join(resolveWindowsInstallRoot(env), 'ct-agent-startup.exe')
}

export function resolveWindowsProcessControlPaths(
  env: NodeJS.ProcessEnv,
): WindowsProcessControlPaths {
  const layout = resolveWindowsPlatformPaths(env)
  const installRoot = resolveWindowsInstallRoot(env)

  return {
    layout,
    installRoot,
    startupExecutablePath: resolveWindowsStartupExecutablePath(env),
    supervisorPidPath: path.win32.join(layout.dataDir, SUPERVISOR_PID_FILE_NAME),
    runtimeStatePath: layout.runtimeStatePath,
    supervisorControlPath: layout.supervisorControlPath,
  }
}

async function resolveEffectiveSupervisorPid(command: {
  readonly supervisorPidPath: string
  readonly runtimeStatePath: string
  readonly isAlive: (pid: number) => boolean
}): Promise<number | null> {
  const supervisorPid = readPidFile(command.supervisorPidPath)
  if (supervisorPid !== null && command.isAlive(supervisorPid)) {
    return supervisorPid
  }

  cleanupStaleSupervisorPidFile(command.supervisorPidPath)

  const runtimePid = readRuntimePidFromState(command.runtimeStatePath)
  if (runtimePid !== null && command.isAlive(runtimePid)) {
    return null
  }

  return null
}

function readLiveRuntimePid(command: {
  readonly runtimeStatePath: string
  readonly isAlive: (pid: number) => boolean
}): number | null {
  const runtimePid = readRuntimePidFromState(command.runtimeStatePath)
  if (runtimePid === null || !command.isAlive(runtimePid)) {
    return null
  }

  return runtimePid
}

function requestWindowsRuntimeRestart(supervisorControlPath: string): void {
  writeSupervisorControl(supervisorControlPath, {
    drain_requested: true,
    reason: 'restart',
    requested_at: new Date().toISOString(),
  })
}

function startWindowsStartup(command: StartWindowsStartupCommand): void {
  if (!fs.existsSync(command.startupExecutablePath)) {
    throw new Error(`Windows startup launcher not found at ${command.startupExecutablePath}`)
  }

  fs.mkdirSync(command.layout.dataDir, { recursive: true })

  const args = command.runtimeOnly ? ['--runtime-only'] : []
  const child = spawn(command.startupExecutablePath, args, {
    cwd: command.installRoot,
    detached: true,
    stdio: 'ignore',
    shell: false,
    windowsHide: true,
    env: {
      ...process.env,
      AGENT_DATA_DIR: command.layout.dataDir,
      DOTENV_PATH: command.layout.configEnvPath,
      BOOTSTRAP_DOTENV_PATH: command.layout.bootstrapEnvPath,
      AGENT_PUBLIC_STATE_DIR: command.layout.publicStateDir,
      CT_AGENT_INSTALL_ROOT: command.installRoot,
    },
  })
  child.unref()
}

export function createWindowsProcessControlStrategy(
  providedDeps?: CreateWindowsProcessControlStrategyDeps,
): AgentControlStrategy {
  const env = providedDeps?.env ?? process.env
  const isAlive = providedDeps?.isProcessAlive ?? isProcessAlive
  const resolvePaths = providedDeps?.resolvePaths ?? resolveWindowsProcessControlPaths
  const resolveSupervisorPid =
    providedDeps?.resolveSupervisorPid ??
    ((command: { readonly supervisorPidPath: string; readonly runtimeStatePath: string }) =>
      resolveEffectiveSupervisorPid({
        ...command,
        isAlive,
      }))
  const startStartup = providedDeps?.startStartup ?? startWindowsStartup
  const requestRestart = providedDeps?.requestRestart ?? requestWindowsRuntimeRestart
  const killProcess = providedDeps?.killProcess ?? process.kill
  const waitForProcessExitFn =
    providedDeps?.waitForProcessExit ??
    ((pid: number, timeoutMs: number) => waitForProcessExit(pid, timeoutMs, isAlive))
  const cleanupSupervisorPidFile =
    providedDeps?.cleanupSupervisorPidFile ?? cleanupStaleSupervisorPidFile

  return {
    async queryAgent() {
      const paths = resolvePaths(env)
      const supervisorPid = await resolveSupervisorPid({
        supervisorPidPath: paths.supervisorPidPath,
        runtimeStatePath: paths.runtimeStatePath,
      })

      if (supervisorPid !== null) {
        return { status: 'running', detail: `windows supervisor pid=${supervisorPid}` }
      }

      const runtimePid = readLiveRuntimePid({
        runtimeStatePath: paths.runtimeStatePath,
        isAlive,
      })
      if (runtimePid !== null) {
        return {
          status: 'unknown',
          detail: `runtime pid=${runtimePid} is alive without a live supervisor pid`,
        }
      }

      return { status: 'stopped', detail: 'windows supervisor pid not found' }
    },
    async startAgent() {
      const paths = resolvePaths(env)
      const supervisorPid = await resolveSupervisorPid({
        supervisorPidPath: paths.supervisorPidPath,
        runtimeStatePath: paths.runtimeStatePath,
      })
      if (supervisorPid !== null) {
        return
      }

      startStartup({
        startupExecutablePath: paths.startupExecutablePath,
        installRoot: paths.installRoot,
        layout: paths.layout,
        runtimeOnly: true,
      })
    },
    async stopAgent() {
      const paths = resolvePaths(env)
      const killedPids = new Set<number>()
      const supervisorPid = await resolveSupervisorPid({
        supervisorPidPath: paths.supervisorPidPath,
        runtimeStatePath: paths.runtimeStatePath,
      })
      if (supervisorPid !== null) {
        killProcess(supervisorPid, 'SIGTERM')
        killedPids.add(supervisorPid)
        const exitedGracefully = await waitForProcessExitFn(
          supervisorPid,
          DEFAULT_PROCESS_EXIT_WAIT_MS,
        )
        if (!exitedGracefully) {
          killProcess(supervisorPid, 'SIGKILL')
          await waitForProcessExitFn(supervisorPid, 1_000)
        }
      }

      const runtimePid = readLiveRuntimePid({
        runtimeStatePath: paths.runtimeStatePath,
        isAlive,
      })
      if (runtimePid !== null && !killedPids.has(runtimePid)) {
        killProcess(runtimePid, 'SIGTERM')
        await waitForProcessExitFn(runtimePid, 1_000)
      }

      cleanupSupervisorPidFile(paths.supervisorPidPath)
    },
    async restartAgent() {
      const paths = resolvePaths(env)
      const supervisorPid = await resolveSupervisorPid({
        supervisorPidPath: paths.supervisorPidPath,
        runtimeStatePath: paths.runtimeStatePath,
      })
      if (supervisorPid === null) {
        startStartup({
          startupExecutablePath: paths.startupExecutablePath,
          installRoot: paths.installRoot,
          layout: paths.layout,
          runtimeOnly: true,
        })
        return
      }

      requestRestart(paths.supervisorControlPath)
    },
  }
}
