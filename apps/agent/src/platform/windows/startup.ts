import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import type { PlatformPathResolution } from '@agent/platform/platform.contract'
import {
  normalizeOptionalWindowsEnv,
  resolveWindowsInstallRoot,
  resolveWindowsPlatformPaths,
} from '@agent/platform/windows-paths'

const SUPERVISOR_PID_FILE_NAME = 'supervisor.pid'
const STARTUP_LOG_FILE_NAME = 'startup.log'

type WindowsStartupMode = 'full' | 'runtime-only' | 'tray-only'

type WindowsStartupSpawnOptions = {
  readonly cwd: string
  readonly detached: true
  readonly stdio: 'ignore'
  readonly shell: false
  readonly windowsHide: true
  readonly env: NodeJS.ProcessEnv
}

type SpawnDetached = (
  command: string,
  args: readonly string[],
  options: WindowsStartupSpawnOptions,
) => void

type WindowsStartupDeps = {
  readonly env?: NodeJS.ProcessEnv
  readonly argv?: readonly string[]
  readonly resolvePaths?: (env: NodeJS.ProcessEnv) => PlatformPathResolution
  readonly spawnDetached?: SpawnDetached
  readonly isProcessAlive?: (pid: number) => boolean
  readonly nowIso?: () => string
}

type WindowsStartupResult = {
  readonly supervisorStarted: boolean
  readonly trayStarted: boolean
}

type SupervisorLaunchSpec = {
  readonly nodePath: string
  readonly supervisorScriptPath: string
  readonly aliasLoaderPath: string | null
  readonly cwd: string
  readonly env: NodeJS.ProcessEnv
}

type TrayLaunchSpec = {
  readonly electronPath: string
  readonly appDir: string
  readonly cwd: string
  readonly env: NodeJS.ProcessEnv
}

function isMainModule(): boolean {
  const entrypoint = process.argv[1]
  if (!entrypoint) {
    return false
  }

  try {
    return path.resolve(entrypoint) === fileURLToPath(import.meta.url)
  } catch {
    return false
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

function readPidFile(pidFilePath: string): number | null {
  if (!fs.existsSync(pidFilePath)) {
    return null
  }

  const raw = fs.readFileSync(pidFilePath, 'utf8').trim()
  const parsed = Number.parseInt(raw, 10)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

function appendStartupLog(command: {
  readonly layout: PlatformPathResolution
  readonly nowIso: () => string
  readonly message: string
}): void {
  try {
    fs.mkdirSync(command.layout.logsDir, { recursive: true })
    fs.appendFileSync(
      path.win32.join(command.layout.logsDir, STARTUP_LOG_FILE_NAME),
      `[${command.nowIso()}] [windows-startup] ${command.message}\n`,
      'utf8',
    )
  } catch {
    // Startup logging must never prevent the runtime from booting.
  }
}

export function parseWindowsStartupMode(command: {
  readonly argv: readonly string[]
  readonly env: NodeJS.ProcessEnv
}): WindowsStartupMode {
  const explicitMode = normalizeOptionalWindowsEnv(command.env.CT_AGENT_STARTUP_MODE)
  if (explicitMode === 'full' || explicitMode === 'runtime-only' || explicitMode === 'tray-only') {
    return explicitMode
  }

  if (command.argv.includes('--runtime-only')) {
    return 'runtime-only'
  }

  if (command.argv.includes('--tray-only')) {
    return 'tray-only'
  }

  return 'full'
}

function resolveSupervisorPidPath(layout: PlatformPathResolution): string {
  return path.win32.join(layout.dataDir, SUPERVISOR_PID_FILE_NAME)
}

function isSupervisorRunning(command: {
  readonly layout: PlatformPathResolution
  readonly isAlive: (pid: number) => boolean
}): boolean {
  const supervisorPid = readPidFile(resolveSupervisorPidPath(command.layout))
  return supervisorPid !== null && command.isAlive(supervisorPid)
}

function ensureStartupDirectories(layout: PlatformPathResolution): void {
  fs.mkdirSync(layout.dataDir, { recursive: true })
  fs.mkdirSync(layout.releasesDir, { recursive: true })
  fs.mkdirSync(layout.downloadsDir, { recursive: true })
  fs.mkdirSync(layout.logsDir, { recursive: true })
  fs.mkdirSync(layout.publicStateDir, { recursive: true })
}

function findExistingFile(candidates: readonly string[]): string | null {
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate
    }
  }

  return null
}

function findExistingAppDir(candidates: readonly string[]): string | null {
  for (const candidate of candidates) {
    const manifestPath = path.win32.join(candidate, 'package.json')
    if (fs.existsSync(manifestPath) && fs.statSync(manifestPath).isFile()) {
      return candidate
    }
  }

  return null
}

function resolveSupervisorLaunchSpec(command: {
  readonly installRoot: string
  readonly layout: PlatformPathResolution
  readonly env: NodeJS.ProcessEnv
}): SupervisorLaunchSpec {
  const nodePath = path.win32.join(command.installRoot, 'node', 'node.exe')
  const supervisorScriptPath = path.win32.join(
    command.installRoot,
    'app',
    'dist',
    'apps',
    'agent',
    'src',
    'supervisor.js',
  )
  const aliasLoaderPath = findExistingFile([
    path.win32.join(
      command.installRoot,
      'app',
      'dist',
      'apps',
      'agent',
      'src',
      'runtime',
      'register-alias-loader.js',
    ),
  ])

  return {
    nodePath,
    supervisorScriptPath,
    aliasLoaderPath,
    cwd: command.installRoot,
    env: {
      ...command.env,
      AGENT_DATA_DIR: command.layout.dataDir,
      DOTENV_PATH: command.layout.configEnvPath,
      BOOTSTRAP_DOTENV_PATH: command.layout.bootstrapEnvPath,
      AGENT_PUBLIC_STATE_DIR: command.layout.publicStateDir,
      CT_AGENT_INSTALL_ROOT: command.installRoot,
    },
  }
}

function resolveTrayLaunchSpec(command: {
  readonly installRoot: string
  readonly layout: PlatformPathResolution
  readonly env: NodeJS.ProcessEnv
}): TrayLaunchSpec | null {
  const electronPath = findExistingFile([
    normalizeOptionalWindowsEnv(command.env.CT_AGENT_ELECTRON_EXE) ?? '',
    path.win32.join(command.installRoot, 'electron', 'electron.exe'),
  ])
  if (electronPath === null) {
    return null
  }

  const appDir = findExistingAppDir([
    path.win32.join(command.layout.currentPath, 'control-ui'),
    path.win32.join(command.layout.currentPath, 'app', 'control-ui'),
    path.win32.join(command.installRoot, 'control-ui'),
  ])
  if (appDir === null) {
    return null
  }

  const trayEnv: NodeJS.ProcessEnv = {
    ...command.env,
    AGENT_DATA_DIR: command.layout.dataDir,
    DOTENV_PATH: command.layout.configEnvPath,
    BOOTSTRAP_DOTENV_PATH: command.layout.bootstrapEnvPath,
    AGENT_PUBLIC_STATE_DIR: command.layout.publicStateDir,
    CT_AGENT_INSTALL_ROOT: command.installRoot,
    CT_AGENT_UI_INSTALLED: '1',
    CT_AGENT_UI_MODE: 'tray',
    CT_AGENT_UI_WINDOWS_INSTALLED: '1',
    CT_AGENT_UI_ICON_PATH: path.win32.join(command.installRoot, 'app', 'assets', 'tray.ico'),
    CT_AGENT_UI_USER_DATA_DIR: path.win32.join(command.layout.dataDir, 'control-ui-user-data'),
  }
  delete trayEnv.ELECTRON_RUN_AS_NODE

  return {
    electronPath,
    appDir,
    cwd: command.installRoot,
    env: trayEnv,
  }
}

function spawnDetached(
  command: string,
  args: readonly string[],
  options: WindowsStartupSpawnOptions,
): void {
  const child = spawn(command, [...args], options)
  child.unref()
}

function startSupervisor(command: {
  readonly spec: SupervisorLaunchSpec
  readonly spawnDetached: SpawnDetached
}): void {
  if (!fs.existsSync(command.spec.nodePath)) {
    throw new Error(`node.exe not found at ${command.spec.nodePath}`)
  }
  if (!fs.existsSync(command.spec.supervisorScriptPath)) {
    throw new Error(`supervisor.js not found at ${command.spec.supervisorScriptPath}`)
  }

  const args =
    command.spec.aliasLoaderPath === null
      ? [command.spec.supervisorScriptPath]
      : [
          `--import=${pathToFileURL(command.spec.aliasLoaderPath).href}`,
          command.spec.supervisorScriptPath,
        ]

  command.spawnDetached(command.spec.nodePath, args, {
    cwd: command.spec.cwd,
    detached: true,
    stdio: 'ignore',
    shell: false,
    windowsHide: true,
    env: command.spec.env,
  })
}

function startTray(command: {
  readonly spec: TrayLaunchSpec
  readonly spawnDetached: SpawnDetached
}): void {
  command.spawnDetached(command.spec.electronPath, [command.spec.appDir], {
    cwd: command.spec.cwd,
    detached: true,
    stdio: 'ignore',
    shell: false,
    windowsHide: true,
    env: command.spec.env,
  })
}

export function launchWindowsAgentStartup(providedDeps?: WindowsStartupDeps): WindowsStartupResult {
  const env = providedDeps?.env ?? process.env
  const argv = providedDeps?.argv ?? process.argv.slice(2)
  const resolvePaths = providedDeps?.resolvePaths ?? resolveWindowsPlatformPaths
  const spawnDetachedFn = providedDeps?.spawnDetached ?? spawnDetached
  const isAlive = providedDeps?.isProcessAlive ?? isProcessAlive
  const nowIso = providedDeps?.nowIso ?? (() => new Date().toISOString())
  const layout = resolvePaths(env)
  const installRoot = resolveWindowsInstallRoot(env)
  const mode = parseWindowsStartupMode({ argv, env })

  ensureStartupDirectories(layout)
  appendStartupLog({
    layout,
    nowIso,
    message: `startup mode=${mode} install_root=${installRoot} data_dir=${layout.dataDir}`,
  })

  let supervisorStarted = false
  let trayStarted = false

  if (mode !== 'tray-only' && !isSupervisorRunning({ layout, isAlive })) {
    const supervisorSpec = resolveSupervisorLaunchSpec({ installRoot, layout, env })
    startSupervisor({ spec: supervisorSpec, spawnDetached: spawnDetachedFn })
    supervisorStarted = true
    appendStartupLog({
      layout,
      nowIso,
      message: `supervisor launch requested path=${supervisorSpec.supervisorScriptPath}`,
    })
  }

  if (mode !== 'runtime-only') {
    const traySpec = resolveTrayLaunchSpec({ installRoot, layout, env })
    if (traySpec !== null) {
      startTray({ spec: traySpec, spawnDetached: spawnDetachedFn })
      trayStarted = true
      appendStartupLog({
        layout,
        nowIso,
        message: `tray launch requested app_dir=${traySpec.appDir}`,
      })
    } else {
      appendStartupLog({
        layout,
        nowIso,
        message: 'tray launch skipped because Electron runtime or app manifest was not found',
      })
    }
  }

  return {
    supervisorStarted,
    trayStarted,
  }
}

if (isMainModule()) {
  try {
    launchWindowsAgentStartup()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    process.stderr.write(`[windows-startup] ${message}\n`)
    process.exitCode = 1
  }
}
