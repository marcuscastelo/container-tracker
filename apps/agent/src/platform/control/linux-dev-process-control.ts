import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

import { AGENT_PATH_LAYOUT } from '@agent/platform/agent-path-layout'
import {
  type ControlCommandRunner,
  createControlCommandRunner,
} from '@agent/platform/control/control-command'
import type { AgentControlStrategy } from '@agent/platform/control/control-strategy.contract'
import { writeSupervisorControl } from '@agent/runtime/infrastructure/supervisor-control.repository'

const DEFAULT_PROCESS_EXIT_WAIT_MS = 5_000
const PROCESS_EXIT_POLL_INTERVAL_MS = 100
const DEV_FALLBACK_DATA_DIR_NAME = '.agent-runtime'
const SUPERVISOR_PID_FILE_NAME = 'supervisor.pid'

type ResolveEffectiveSupervisorPidCommand = {
  readonly supervisorPidPath: string
  readonly runtimeStatePath: string
}

type StartLocalRuntimeSupervisorCommand = {
  readonly dataDir: string
  readonly dotenvPath: string
  readonly bootstrapPath: string
}

type LocalRuntimeConfigPaths = {
  readonly dataDir: string
  readonly dotenvPath: string
  readonly bootstrapPath: string
  readonly runtimeStatePath: string
  readonly supervisorPidPath: string
  readonly supervisorControlPath: string
}

type CreateLinuxDevProcessControlStrategyDeps = {
  readonly env?: NodeJS.ProcessEnv
  readonly cwd?: () => string
  readonly runCommand?: ControlCommandRunner
  readonly resolveEffectiveSupervisorPid?: (
    command: ResolveEffectiveSupervisorPidCommand,
  ) => Promise<number | null>
  readonly startSupervisor?: (command: StartLocalRuntimeSupervisorCommand) => void
  readonly requestRestart?: (supervisorControlPath: string) => void
  readonly killProcess?: (pid: number, signal?: NodeJS.Signals | number) => void
  readonly waitForProcessExit?: (pid: number, timeoutMs: number) => Promise<boolean>
  readonly cleanupSupervisorPidFile?: (pidFilePath: string) => void
}

export function shouldUseLocalRuntimeProcessControl(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.CT_AGENT_UI_INSTALLED === '0'
}

function resolveLocalRuntimeDataDir(command: {
  readonly env: NodeJS.ProcessEnv
  readonly cwd: string
}): string {
  const configured = command.env.AGENT_DATA_DIR?.trim()
  if (typeof configured === 'string' && configured.length > 0) {
    return configured
  }

  return path.resolve(command.cwd, DEV_FALLBACK_DATA_DIR_NAME)
}

function resolveLocalRuntimeConfigPaths(command: {
  readonly env: NodeJS.ProcessEnv
  readonly cwd: string
}): LocalRuntimeConfigPaths {
  const dataDir = resolveLocalRuntimeDataDir(command)
  const dotenvPath =
    command.env.DOTENV_PATH?.trim() || path.join(dataDir, AGENT_PATH_LAYOUT.files.configEnv)
  const bootstrapPath =
    command.env.BOOTSTRAP_DOTENV_PATH?.trim() ||
    path.join(dataDir, AGENT_PATH_LAYOUT.files.bootstrapEnv)

  return {
    dataDir,
    dotenvPath,
    bootstrapPath,
    runtimeStatePath: path.join(dataDir, AGENT_PATH_LAYOUT.files.runtimeState),
    supervisorPidPath: path.join(dataDir, SUPERVISOR_PID_FILE_NAME),
    supervisorControlPath: path.join(dataDir, AGENT_PATH_LAYOUT.files.supervisorControl),
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
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

async function resolveRuntimeParentPid(command: {
  readonly runtimePid: number
  readonly runCommand: ControlCommandRunner
}): Promise<number | null> {
  try {
    const result = await command.runCommand('ps', ['-o', 'ppid=', '-p', String(command.runtimePid)])
    const parsed = Number.parseInt(result.stdout.trim(), 10)
    if (!Number.isFinite(parsed) || parsed <= 1) {
      return null
    }

    return parsed
  } catch {
    return null
  }
}

async function resolveLocalSupervisorPidFromRuntimeState(command: {
  readonly runtimeStatePath: string
  readonly runCommand: ControlCommandRunner
}): Promise<number | null> {
  const runtimePid = readRuntimePidFromState(command.runtimeStatePath)
  if (runtimePid === null || !isProcessAlive(runtimePid)) {
    return null
  }

  const parentPid = await resolveRuntimeParentPid({
    runtimePid,
    runCommand: command.runCommand,
  })
  if (parentPid === null || !isProcessAlive(parentPid)) {
    return null
  }

  return parentPid
}

async function resolveEffectiveSupervisorPid(command: {
  readonly runCommand: ControlCommandRunner
  readonly supervisorPidPath: string
  readonly runtimeStatePath: string
}): Promise<number | null> {
  const pidFromFile = readSupervisorPid(command.supervisorPidPath)
  if (pidFromFile !== null && isProcessAlive(pidFromFile)) {
    return pidFromFile
  }

  cleanupStaleSupervisorPidFile(command.supervisorPidPath)
  return resolveLocalSupervisorPidFromRuntimeState({
    runtimeStatePath: command.runtimeStatePath,
    runCommand: command.runCommand,
  })
}

function requestLocalRuntimeRestart(supervisorControlPath: string): void {
  writeSupervisorControl(supervisorControlPath, {
    drain_requested: true,
    reason: 'manual',
    requested_at: new Date().toISOString(),
  })
}

function startLocalRuntimeSupervisor(command: {
  readonly repoRoot: string
  readonly dataDir: string
  readonly dotenvPath: string
  readonly bootstrapPath: string
}): void {
  const launcherPath = path.join(command.repoRoot, 'scripts', 'agent', 'run-linux.sh')
  if (!fs.existsSync(launcherPath)) {
    throw new Error(`Local runtime launcher not found at ${launcherPath}`)
  }

  fs.mkdirSync(command.dataDir, { recursive: true })

  const child = spawn('bash', [launcherPath], {
    cwd: command.repoRoot,
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

export function createLinuxDevProcessControlStrategy(
  providedDeps?: CreateLinuxDevProcessControlStrategyDeps,
): AgentControlStrategy {
  const env = providedDeps?.env ?? process.env
  const cwd = providedDeps?.cwd ?? (() => process.cwd())
  const runCommand = providedDeps?.runCommand ?? createControlCommandRunner(env)
  const resolveEffectiveSupervisorPidFn =
    providedDeps?.resolveEffectiveSupervisorPid ??
    ((command: ResolveEffectiveSupervisorPidCommand) =>
      resolveEffectiveSupervisorPid({
        runCommand,
        supervisorPidPath: command.supervisorPidPath,
        runtimeStatePath: command.runtimeStatePath,
      }))
  const startSupervisor =
    providedDeps?.startSupervisor ??
    ((command: StartLocalRuntimeSupervisorCommand) =>
      startLocalRuntimeSupervisor({
        repoRoot: cwd(),
        dataDir: command.dataDir,
        dotenvPath: command.dotenvPath,
        bootstrapPath: command.bootstrapPath,
      }))
  const requestRestart = providedDeps?.requestRestart ?? requestLocalRuntimeRestart
  const killProcess = providedDeps?.killProcess ?? process.kill
  const waitForProcessExitFn = providedDeps?.waitForProcessExit ?? waitForProcessExit
  const cleanupSupervisorPidFile =
    providedDeps?.cleanupSupervisorPidFile ?? cleanupStaleSupervisorPidFile

  return {
    async queryAgent() {
      const { supervisorPidPath, runtimeStatePath } = resolveLocalRuntimeConfigPaths({
        env,
        cwd: cwd(),
      })
      const pid = await resolveEffectiveSupervisorPidFn({
        supervisorPidPath,
        runtimeStatePath,
      })
      if (pid === null) {
        return { status: 'stopped', detail: 'local supervisor pid not found' }
      }

      return { status: 'running', detail: `local supervisor pid=${pid}` }
    },
    async startAgent() {
      const { dataDir, dotenvPath, bootstrapPath, supervisorPidPath, runtimeStatePath } =
        resolveLocalRuntimeConfigPaths({
          env,
          cwd: cwd(),
        })
      const runningPid = await resolveEffectiveSupervisorPidFn({
        supervisorPidPath,
        runtimeStatePath,
      })
      if (runningPid !== null) {
        return
      }

      startSupervisor({
        dataDir,
        dotenvPath,
        bootstrapPath,
      })
    },
    async stopAgent() {
      const { supervisorPidPath, runtimeStatePath } = resolveLocalRuntimeConfigPaths({
        env,
        cwd: cwd(),
      })
      const supervisorPid = await resolveEffectiveSupervisorPidFn({
        supervisorPidPath,
        runtimeStatePath,
      })
      if (supervisorPid === null) {
        return
      }

      killProcess(supervisorPid, 'SIGTERM')
      const exitedGracefully = await waitForProcessExitFn(
        supervisorPid,
        DEFAULT_PROCESS_EXIT_WAIT_MS,
      )
      if (!exitedGracefully) {
        killProcess(supervisorPid, 'SIGKILL')
        await waitForProcessExitFn(supervisorPid, 1_000)
      }
      cleanupSupervisorPidFile(supervisorPidPath)
    },
    async restartAgent() {
      const {
        dataDir,
        dotenvPath,
        bootstrapPath,
        supervisorPidPath,
        runtimeStatePath,
        supervisorControlPath,
      } = resolveLocalRuntimeConfigPaths({
        env,
        cwd: cwd(),
      })
      const supervisorPid = await resolveEffectiveSupervisorPidFn({
        supervisorPidPath,
        runtimeStatePath,
      })
      if (supervisorPid === null) {
        startSupervisor({
          dataDir,
          dotenvPath,
          bootstrapPath,
        })
        return
      }

      requestRestart(supervisorControlPath)
    },
  }
}
