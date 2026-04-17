import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

export type WindowsStartupLauncherPaths = {
  readonly installRoot: string
  readonly nodePath: string
  readonly startupScriptPath: string
  readonly aliasLoaderPath: string
}

export type WindowsStartupLauncherResult = WindowsStartupLauncherPaths & {
  readonly forwardedArgv: readonly string[]
  readonly nodeArgs: readonly string[]
}

export type WindowsStartupLauncherSpawnOptions = {
  readonly cwd: string
  readonly detached: true
  readonly env: NodeJS.ProcessEnv
  readonly stdio: 'ignore'
  readonly shell: false
  readonly windowsHide: true
}

type SpawnDetached = (
  command: string,
  args: readonly string[],
  options: WindowsStartupLauncherSpawnOptions,
) => void

type LaunchWindowsStartupLauncherDeps = {
  readonly execPath?: string
  readonly argv0?: string
  readonly argv?: readonly string[]
  readonly spawnDetached?: SpawnDetached
}

function resolveInstalledExecutablePath(command: {
  readonly execPath: string
  readonly argv0?: string
}): string {
  const argv0 = command.argv0?.trim()
  if (argv0 && path.win32.extname(argv0).toLowerCase() === '.exe' && fs.existsSync(argv0)) {
    return argv0
  }

  return command.execPath
}

function spawnDetached(
  command: string,
  args: readonly string[],
  options: WindowsStartupLauncherSpawnOptions,
): void {
  const child = spawn(command, [...args], options)
  child.unref()
}

export function resolveWindowsStartupLauncherPaths(execPath: string): WindowsStartupLauncherPaths {
  const installRoot = path.win32.dirname(execPath)
  return {
    installRoot,
    nodePath: path.win32.join(installRoot, 'node', 'node.exe'),
    startupScriptPath: path.win32.join(
      installRoot,
      'app',
      'dist',
      'apps',
      'agent',
      'src',
      'platform',
      'windows',
      'startup.js',
    ),
    aliasLoaderPath: path.win32.join(
      installRoot,
      'app',
      'dist',
      'apps',
      'agent',
      'src',
      'runtime',
      'register-alias-loader.js',
    ),
  }
}

export function buildWindowsStartupLauncherNodeArgs(command: {
  readonly paths: WindowsStartupLauncherPaths
  readonly forwardedArgv: readonly string[]
}): readonly string[] {
  const args: string[] = []
  if (fs.existsSync(command.paths.aliasLoaderPath)) {
    args.push(`--import=${pathToFileURL(command.paths.aliasLoaderPath).href}`)
  }

  args.push(command.paths.startupScriptPath, ...command.forwardedArgv)
  return args
}

export function launchWindowsStartupLauncher(
  providedDeps?: LaunchWindowsStartupLauncherDeps,
): WindowsStartupLauncherResult {
  const execPath = providedDeps?.execPath ?? process.execPath
  const argv0 = providedDeps?.argv0 ?? process.argv[0]
  const argv = providedDeps?.argv ?? process.argv.slice(2)
  const spawnDetachedFn = providedDeps?.spawnDetached ?? spawnDetached
  const paths = resolveWindowsStartupLauncherPaths(
    resolveInstalledExecutablePath({ execPath, argv0 }),
  )

  if (!fs.existsSync(paths.nodePath)) {
    throw new Error(`node.exe not found at ${paths.nodePath}`)
  }

  if (!fs.existsSync(paths.startupScriptPath)) {
    throw new Error(`startup.js not found at ${paths.startupScriptPath}`)
  }

  const nodeArgs = buildWindowsStartupLauncherNodeArgs({
    paths,
    forwardedArgv: argv,
  })

  spawnDetachedFn(paths.nodePath, nodeArgs, {
    cwd: paths.installRoot,
    detached: true,
    env: {
      ...process.env,
      CT_AGENT_INSTALL_ROOT: paths.installRoot,
    },
    stdio: 'ignore',
    shell: false,
    windowsHide: true,
  })

  return {
    ...paths,
    forwardedArgv: argv,
    nodeArgs,
  }
}
