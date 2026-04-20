#!/usr/bin/env node

import { spawn } from 'node:child_process'
import fsSync from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const DEFAULT_DOCKER_IMAGE = 'amake/innosetup'
const DEFAULT_INSTALLER_SCRIPT = 'apps/agent/src/installer/installer.iss'
const VALID_MODES = ['auto', 'native', 'docker', 'wine']
const REQUIRED_WINDOWS_SETUP_INPUTS = [
  'release/ct-agent-startup.exe',
  'release/control-ui/package.json',
  'release/electron/electron.exe',
]

function toErrorMessage(error) {
  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}

function resolveRepoRoot(startDir) {
  let cursor = startDir

  for (;;) {
    const marker = path.join(cursor, 'apps', 'agent', 'src', 'runtime', 'runtime.entry.ts')
    if (fsSync.existsSync(marker)) {
      return cursor
    }

    const parent = path.dirname(cursor)
    if (parent === cursor) {
      throw new Error('Could not resolve repository root from script location')
    }
    cursor = parent
  }
}

function printUsage() {
  const usage = [
    'Usage: node scripts/agent/setup-installer.mjs [options] [iscc options] [installer.iss]',
    '',
    'Options:',
    '  --mode <auto|native|docker|wine>   Select compiler strategy (default: auto)',
    `  --docker-image <image>             Docker image for --mode=docker (default: ${DEFAULT_DOCKER_IMAGE})`,
    '  --wine-iscc-path <path>            ISCC.exe path for --mode=wine',
    '  --help                             Show this help',
    '',
    'Environment variables:',
    '  AGENT_SETUP_MODE',
    '  AGENT_SETUP_DOCKER_IMAGE',
    '  AGENT_SETUP_WINE_ISCC_PATH',
  ].join('\n')

  process.stdout.write(`${usage}\n`)
}

function readOptionValue(argv, index, optionName) {
  if (index + 1 >= argv.length) {
    throw new Error(`Missing value for ${optionName}`)
  }

  return {
    value: argv[index + 1],
    consumedArgs: 2,
  }
}

function parseCliArgs(argv) {
  let mode = process.env.AGENT_SETUP_MODE ?? 'auto'
  let dockerImage = process.env.AGENT_SETUP_DOCKER_IMAGE ?? DEFAULT_DOCKER_IMAGE
  let wineIsccPath = process.env.AGENT_SETUP_WINE_ISCC_PATH ?? ''
  let installerScriptPath = DEFAULT_INSTALLER_SCRIPT
  const isccArgs = []

  let index = 0
  while (index < argv.length) {
    const arg = argv[index]

    if (arg === '--help' || arg === '-h') {
      printUsage()
      process.exit(0)
    }

    if (arg === '--mode') {
      const { value, consumedArgs } = readOptionValue(argv, index, '--mode')
      mode = value
      index += consumedArgs
      continue
    }
    if (arg.startsWith('--mode=')) {
      mode = arg.slice('--mode='.length)
      index += 1
      continue
    }

    if (arg === '--docker-image') {
      const { value, consumedArgs } = readOptionValue(argv, index, '--docker-image')
      dockerImage = value
      index += consumedArgs
      continue
    }
    if (arg.startsWith('--docker-image=')) {
      dockerImage = arg.slice('--docker-image='.length)
      index += 1
      continue
    }

    if (arg === '--wine-iscc-path') {
      const { value, consumedArgs } = readOptionValue(argv, index, '--wine-iscc-path')
      wineIsccPath = value
      index += consumedArgs
      continue
    }
    if (arg.startsWith('--wine-iscc-path=')) {
      wineIsccPath = arg.slice('--wine-iscc-path='.length)
      index += 1
      continue
    }

    if (arg.endsWith('.iss') && installerScriptPath === DEFAULT_INSTALLER_SCRIPT) {
      installerScriptPath = arg
      index += 1
      continue
    }

    isccArgs.push(arg)
    index += 1
  }

  if (!VALID_MODES.includes(mode)) {
    throw new Error(`Invalid --mode "${mode}". Valid values: ${VALID_MODES.join(', ')}`)
  }

  return {
    mode,
    dockerImage,
    wineIsccPath,
    installerScriptPath,
    isccArgs,
  }
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath)
    return true
  } catch {
    return false
  }
}

function isInsideDirectory(baseDir, candidatePath) {
  const relative = path.relative(baseDir, candidatePath)
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative)
}

function toPosixPath(inputPath) {
  return inputPath.split(path.sep).join('/')
}

function checkCommandAvailability(command, args = ['--version']) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      stdio: 'ignore',
      shell: false,
    })

    child.on('error', () => resolve(false))
    child.on('exit', () => resolve(true))
  })
}

function runCommand(command, args, cwd, extraEnv = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: {
        ...process.env,
        ...extraEnv,
      },
      stdio: 'inherit',
      shell: false,
    })

    child.on('error', (error) => {
      reject(new Error(`failed to run "${command}": ${toErrorMessage(error)}`))
    })

    child.on('exit', (code) => {
      if (code === 0) {
        resolve()
        return
      }

      reject(new Error(`"${command}" exited with code ${code ?? 'unknown'}`))
    })
  })
}

async function resolveInstallerScriptPath(repoRoot, installerScriptPathArg) {
  if (path.isAbsolute(installerScriptPathArg)) {
    if (!(await pathExists(installerScriptPathArg))) {
      throw new Error(`Installer script not found: ${installerScriptPathArg}`)
    }

    if (!isInsideDirectory(repoRoot, installerScriptPathArg)) {
      throw new Error(`Installer script must be inside repository root: ${installerScriptPathArg}`)
    }

    return installerScriptPathArg
  }

  const fromRepoRoot = path.resolve(repoRoot, installerScriptPathArg)
  const fromCwd = path.resolve(process.cwd(), installerScriptPathArg)
  const preferredCandidates =
    installerScriptPathArg === DEFAULT_INSTALLER_SCRIPT
      ? [fromRepoRoot, fromCwd]
      : [fromCwd, fromRepoRoot]
  const candidatePaths = [...new Set(preferredCandidates)]

  for (const candidatePath of candidatePaths) {
    if (await pathExists(candidatePath)) {
      if (!isInsideDirectory(repoRoot, candidatePath)) {
        throw new Error(`Installer script must be inside repository root: ${candidatePath}`)
      }

      return candidatePath
    }
  }

  throw new Error(`Installer script not found: ${candidatePaths.join(' or ')}`)
}

async function resolveWineIsccPath(explicitPath) {
  const candidates = []
  if (explicitPath.trim() !== '') {
    candidates.push(explicitPath.trim())
  }

  if (process.env.HOME) {
    candidates.push(
      path.join(
        process.env.HOME,
        '.wine',
        'drive_c',
        'Program Files (x86)',
        'Inno Setup 6',
        'ISCC.exe',
      ),
      path.join(process.env.HOME, '.wine', 'drive_c', 'Program Files', 'Inno Setup 6', 'ISCC.exe'),
    )
  }

  for (const candidate of candidates) {
    if (await pathExists(candidate)) {
      return candidate
    }
  }

  return ''
}

async function chooseStrategy(command) {
  const hasNativeIscc = await checkCommandAvailability('iscc', ['/?'])
  const hasDocker = await checkCommandAvailability('docker', ['--version'])
  const hasWine = await checkCommandAvailability('wine', ['--version'])
  const wineIsccPath = await resolveWineIsccPath(command.wineIsccPath)
  const hasWineIscc = wineIsccPath !== ''

  if (command.mode === 'native') {
    if (!hasNativeIscc) {
      throw new Error('Mode "native" requested, but "iscc" was not found in PATH')
    }

    return {
      strategyName: 'native',
      command: 'iscc',
      args: [...command.isccArgs, command.installerScriptPath],
    }
  }

  if (command.mode === 'docker') {
    if (!hasDocker) {
      throw new Error('Mode "docker" requested, but "docker" was not found in PATH')
    }

    const relativeInstallerPath = path.relative(command.repoRoot, command.installerScriptPath)
    const installerPathInContainer = `/work/${toPosixPath(relativeInstallerPath)}`

    return {
      strategyName: 'docker',
      command: 'docker',
      args: [
        'run',
        '--rm',
        '-i',
        '-v',
        `${command.repoRoot}:/work`,
        '-w',
        '/work',
        command.dockerImage,
        ...command.isccArgs,
        installerPathInContainer,
      ],
    }
  }

  if (command.mode === 'wine') {
    if (!hasWine) {
      throw new Error('Mode "wine" requested, but "wine" was not found in PATH')
    }
    if (!hasWineIscc) {
      throw new Error(
        'Mode "wine" requested, but ISCC.exe was not found. Use --wine-iscc-path or AGENT_SETUP_WINE_ISCC_PATH.',
      )
    }

    return {
      strategyName: 'wine',
      command: 'wine',
      args: [wineIsccPath, ...command.isccArgs, command.installerScriptPath],
    }
  }

  if (hasNativeIscc) {
    return {
      strategyName: 'native',
      command: 'iscc',
      args: [...command.isccArgs, command.installerScriptPath],
    }
  }

  if (hasDocker) {
    const relativeInstallerPath = path.relative(command.repoRoot, command.installerScriptPath)
    const installerPathInContainer = `/work/${toPosixPath(relativeInstallerPath)}`

    return {
      strategyName: 'docker',
      command: 'docker',
      args: [
        'run',
        '--rm',
        '-i',
        '-v',
        `${command.repoRoot}:/work`,
        '-w',
        '/work',
        command.dockerImage,
        ...command.isccArgs,
        installerPathInContainer,
      ],
    }
  }

  if (hasWine && hasWineIscc) {
    return {
      strategyName: 'wine',
      command: 'wine',
      args: [wineIsccPath, ...command.isccArgs, command.installerScriptPath],
    }
  }

  throw new Error(
    [
      'No compatible Inno Setup compiler strategy found.',
      'Tried: native iscc, docker image, wine+ISCC.exe.',
      'Use --mode=<native|docker|wine> for explicit mode.',
    ].join(' '),
  )
}

async function ensureWindowsSetupInputs(repoRoot) {
  const missing = []
  for (const relativePath of REQUIRED_WINDOWS_SETUP_INPUTS) {
    if (!(await pathExists(path.join(repoRoot, relativePath)))) {
      missing.push(relativePath)
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Windows setup inputs are missing: ${missing.join(', ')}. Run pnpm run agent:release before compiling Setup.exe.`,
    )
  }
}

async function main() {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url))
  const repoRoot = resolveRepoRoot(scriptDir)
  const parsed = parseCliArgs(process.argv.slice(2))
  const installerScriptPath = await resolveInstallerScriptPath(repoRoot, parsed.installerScriptPath)
  await ensureWindowsSetupInputs(repoRoot)

  const command = {
    ...parsed,
    repoRoot,
    installerScriptPath,
  }

  const selected = await chooseStrategy(command)

  console.log(
    `[agent:setup] strategy=${selected.strategyName} installer=${path.relative(repoRoot, installerScriptPath)}`,
  )
  await runCommand(selected.command, selected.args, repoRoot, {
    CONTAINER_TRACKER_REPO_ROOT: repoRoot,
  })

  const defaultOutputPath = path.join(
    path.dirname(installerScriptPath),
    'Output',
    'ContainerTrackerAgent-Setup.exe',
  )
  if (await pathExists(defaultOutputPath)) {
    console.log(`[agent:setup] output=${path.relative(repoRoot, defaultOutputPath)}`)
  }
}

main().catch((error) => {
  console.error(`[agent:setup] failed: ${toErrorMessage(error)}`)
  process.exitCode = 1
})
