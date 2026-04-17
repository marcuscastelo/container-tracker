#!/usr/bin/env node

import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import fsSync from 'node:fs'
import fs from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { build as esbuild } from 'esbuild'

export const DEFAULT_NODE_WINDOWS_VERSION = 'v22.11.0'
export const NODE_SEA_RESOURCE_NAME = 'NODE_SEA_BLOB'
export const NODE_SEA_SENTINEL_FUSE = 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2'
export const DEFAULT_ENTRY_RELATIVE_PATH = 'apps/agent/src/installer/ct-agent-startup.entry.ts'
export const DEFAULT_OUTPUT_RELATIVE_PATH = 'apps/agent/src/installer/bin/ct-agent-startup.exe'
const DEFAULT_CACHE_RELATIVE_PATH = 'apps/agent/.cache/startup-launcher'

const NODE_RUNTIME_TARGETS = {
  'v22.11.0': {
    windowsX64: {
      archiveName: 'node-v22.11.0-win-x64.zip',
      archiveKind: 'zip',
      archiveSha256: '905373a059aecaf7f48c1ce10ffbd5334457ca00f678747f19db5ea7d256c236',
      extractedDirectoryName: 'node-v22.11.0-win-x64',
      executableRelativePath: 'node.exe',
    },
    linuxX64: {
      archiveName: 'node-v22.11.0-linux-x64.tar.xz',
      archiveKind: 'tar',
      archiveSha256: '83bf07dd343002a26211cf1fcd46a9d9534219aad42ee02847816940bf610a72',
      extractedDirectoryName: 'node-v22.11.0-linux-x64',
      executableRelativePath: path.posix.join('bin', 'node'),
    },
    darwinX64: {
      archiveName: 'node-v22.11.0-darwin-x64.tar.gz',
      archiveKind: 'tgz',
      archiveSha256: '668d30b9512137b5f5baeef6c1bb4c46efff9a761ba990a034fb6b28b9da2465',
      extractedDirectoryName: 'node-v22.11.0-darwin-x64',
      executableRelativePath: path.posix.join('bin', 'node'),
    },
    darwinArm64: {
      archiveName: 'node-v22.11.0-darwin-arm64.tar.gz',
      archiveKind: 'tgz',
      archiveSha256: '2e89afe6f4e3aa6c7e21c560d8a0453d84807e97850bbb819b998531a22bdfde',
      extractedDirectoryName: 'node-v22.11.0-darwin-arm64',
      executableRelativePath: path.posix.join('bin', 'node'),
    },
  },
}

function toErrorMessage(error) {
  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}

function resolveRepoRoot(startDir) {
  let cursor = startDir

  for (;;) {
    const marker = path.join(cursor, DEFAULT_ENTRY_RELATIVE_PATH)
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

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath)
    return true
  } catch {
    return false
  }
}

function normalizeOptionValue(value) {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

export function parseCliArgs(argv) {
  let outputPath = null
  let windowsNodePath = null
  let seaNodePath = null
  let nodeVersion = DEFAULT_NODE_WINDOWS_VERSION
  let cacheDir = null

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === '--output') {
      outputPath = normalizeOptionValue(argv[index + 1])
      index += 1
      continue
    }
    if (arg?.startsWith('--output=')) {
      outputPath = normalizeOptionValue(arg.slice('--output='.length))
      continue
    }

    if (arg === '--windows-node') {
      windowsNodePath = normalizeOptionValue(argv[index + 1])
      index += 1
      continue
    }
    if (arg?.startsWith('--windows-node=')) {
      windowsNodePath = normalizeOptionValue(arg.slice('--windows-node='.length))
      continue
    }

    if (arg === '--sea-node') {
      seaNodePath = normalizeOptionValue(argv[index + 1])
      index += 1
      continue
    }
    if (arg?.startsWith('--sea-node=')) {
      seaNodePath = normalizeOptionValue(arg.slice('--sea-node='.length))
      continue
    }

    if (arg === '--node-version') {
      nodeVersion = normalizeOptionValue(argv[index + 1]) ?? DEFAULT_NODE_WINDOWS_VERSION
      index += 1
      continue
    }
    if (arg?.startsWith('--node-version=')) {
      nodeVersion =
        normalizeOptionValue(arg.slice('--node-version='.length)) ?? DEFAULT_NODE_WINDOWS_VERSION
      continue
    }

    if (arg === '--cache-dir') {
      cacheDir = normalizeOptionValue(argv[index + 1])
      index += 1
      continue
    }
    if (arg?.startsWith('--cache-dir=')) {
      cacheDir = normalizeOptionValue(arg.slice('--cache-dir='.length))
      continue
    }

    throw new Error(`Unknown option: ${arg}`)
  }

  return {
    outputPath,
    windowsNodePath,
    seaNodePath,
    nodeVersion,
    cacheDir,
  }
}

function resolveTargetConfig(version, key) {
  const versionConfig = NODE_RUNTIME_TARGETS[version]
  if (!versionConfig) {
    throw new Error(`Unsupported Node runtime version for startup launcher: ${version}`)
  }

  const targetConfig = versionConfig[key]
  if (!targetConfig) {
    throw new Error(`Missing runtime descriptor "${key}" for Node ${version}`)
  }

  return targetConfig
}

export function resolveHostRuntimeDescriptor(command = {}) {
  const version = command.nodeVersion ?? DEFAULT_NODE_WINDOWS_VERSION
  const platform = command.platform ?? process.platform
  const arch = command.arch ?? process.arch

  if (platform === 'linux' && arch === 'x64') {
    return resolveTargetConfig(version, 'linuxX64')
  }

  if (platform === 'darwin' && arch === 'x64') {
    return resolveTargetConfig(version, 'darwinX64')
  }

  if (platform === 'darwin' && arch === 'arm64') {
    return resolveTargetConfig(version, 'darwinArm64')
  }

  if (platform === 'win32' && arch === 'x64') {
    return resolveTargetConfig(version, 'windowsX64')
  }

  throw new Error(`Unsupported host platform for startup launcher SEA build: ${platform}-${arch}`)
}

export function resolveWindowsRuntimeDescriptor(nodeVersion = DEFAULT_NODE_WINDOWS_VERSION) {
  return resolveTargetConfig(nodeVersion, 'windowsX64')
}

function buildNodeDownloadUrl(nodeVersion, descriptor) {
  return `https://nodejs.org/dist/${nodeVersion}/${descriptor.archiveName}`
}

async function computeFileSha256(filePath) {
  const fileBuffer = await fs.readFile(filePath)
  return createHash('sha256').update(fileBuffer).digest('hex')
}

async function verifyFileSha256(filePath, expectedSha256) {
  const observedSha256 = await computeFileSha256(filePath)
  if (observedSha256 !== expectedSha256) {
    throw new Error(
      `Checksum mismatch for ${path.basename(filePath)} (expected ${expectedSha256}, got ${observedSha256})`,
    )
  }
}

async function downloadFile(url, targetPath) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`download failed (${response.status}) for ${url}`)
  }

  await fs.mkdir(path.dirname(targetPath), { recursive: true })
  const arrayBuffer = await response.arrayBuffer()
  await fs.writeFile(targetPath, Buffer.from(arrayBuffer))
}

async function ensureDownloadedFile(command) {
  if (await pathExists(command.targetPath)) {
    return
  }

  await downloadFile(command.url, command.targetPath)
}

function run(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: 'inherit',
      shell: false,
    })

    child.once('error', (error) => {
      reject(error)
    })
    child.once('exit', (code) => {
      if (code === 0) {
        resolve()
        return
      }

      reject(new Error(`${command} exited with code ${code ?? 'unknown'}`))
    })
  })
}

async function extractArchive(command) {
  await fs.rm(command.destinationDir, { recursive: true, force: true })
  await fs.mkdir(command.destinationDir, { recursive: true })

  if (command.archiveKind === 'zip') {
    if (process.platform === 'win32') {
      try {
        await run('tar', ['-xf', command.archivePath, '-C', command.destinationDir], command.cwd)
        return
      } catch {
        // Fall back to Expand-Archive below.
      }

      const powershellCommand = [
        `$zip = '${command.archivePath.replaceAll("'", "''")}'`,
        `$destination = '${command.destinationDir.replaceAll("'", "''")}'`,
        'Expand-Archive -LiteralPath $zip -DestinationPath $destination -Force',
      ].join('; ')
      await run(
        'powershell',
        [
          '-NoProfile',
          '-NonInteractive',
          '-ExecutionPolicy',
          'Bypass',
          '-Command',
          powershellCommand,
        ],
        command.cwd,
      )
      return
    }

    try {
      await run(
        'unzip',
        ['-q', '-o', command.archivePath, '-d', command.destinationDir],
        command.cwd,
      )
      return
    } catch {
      await run('tar', ['-xf', command.archivePath, '-C', command.destinationDir], command.cwd)
      return
    }
  }

  if (command.archiveKind === 'tgz') {
    await run('tar', ['-xzf', command.archivePath, '-C', command.destinationDir], command.cwd)
    return
  }

  await run('tar', ['-xf', command.archivePath, '-C', command.destinationDir], command.cwd)
}

async function ensureExtractedRuntime(command) {
  const executablePath = path.join(
    command.extractDir,
    command.descriptor.extractedDirectoryName,
    ...command.descriptor.executableRelativePath.split('/'),
  )

  if (await pathExists(executablePath)) {
    return executablePath
  }

  await extractArchive({
    archiveKind: command.descriptor.archiveKind,
    archivePath: command.archivePath,
    destinationDir: command.extractDir,
    cwd: command.cwd,
  })

  if (!(await pathExists(executablePath))) {
    throw new Error(`Extracted Node runtime executable not found: ${executablePath}`)
  }

  return executablePath
}

async function ensurePinnedNodeExecutable(command) {
  const targetDir = path.join(
    command.cacheDir,
    command.descriptor.archiveName.replace(/\.[^.]+$/u, ''),
  )
  const archivePath = path.join(command.cacheDir, command.descriptor.archiveName)

  await fs.mkdir(command.cacheDir, { recursive: true })
  await ensureDownloadedFile({
    url: buildNodeDownloadUrl(command.nodeVersion, command.descriptor),
    targetPath: archivePath,
  })
  await verifyFileSha256(archivePath, command.descriptor.archiveSha256)

  return ensureExtractedRuntime({
    descriptor: command.descriptor,
    extractDir: targetDir,
    archivePath,
    cwd: command.repoRoot,
  })
}

export function createStartupLauncherSeaConfig(command) {
  return {
    main: command.mainPath,
    output: command.outputBlobPath,
    useSnapshot: false,
    useCodeCache: false,
    disableExperimentalSEAWarning: true,
  }
}

export function createStartupLauncherEsbuildOptions(command) {
  return {
    entryPoints: [command.entryPath],
    outfile: command.outfile,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: ['node22.11'],
    sourcemap: false,
    legalComments: 'none',
    logLevel: 'silent',
  }
}

export function createPostjectInvocation(command) {
  return {
    resourceName: NODE_SEA_RESOURCE_NAME,
    sentinelFuse: NODE_SEA_SENTINEL_FUSE,
    args: [
      command.executablePath,
      NODE_SEA_RESOURCE_NAME,
      command.blobPath,
      '--sentinel-fuse',
      NODE_SEA_SENTINEL_FUSE,
    ],
  }
}

async function assertPortableExecutable(filePath) {
  const header = await fs.readFile(filePath)
  if (header.length < 2 || header[0] !== 0x4d || header[1] !== 0x5a) {
    throw new Error(`Generated launcher is not a PE executable: ${filePath}`)
  }
}

function resolvePostjectCliPath() {
  const require = createRequire(import.meta.url)
  return require.resolve('postject/dist/cli.js')
}

async function generateSeaBlob(command) {
  const seaConfigPath = path.join(command.workDir, 'sea-config.json')
  await fs.writeFile(
    seaConfigPath,
    `${JSON.stringify(
      createStartupLauncherSeaConfig({
        mainPath: command.bundlePath,
        outputBlobPath: command.blobPath,
      }),
      null,
      2,
    )}\n`,
    'utf8',
  )

  await run(command.seaNodePath, ['--experimental-sea-config', seaConfigPath], command.workDir)
}

async function injectSeaBlob(command) {
  const postjectCliPath = resolvePostjectCliPath()
  const invocation = createPostjectInvocation({
    executablePath: command.outputPath,
    blobPath: command.blobPath,
  })
  await run(process.execPath, [postjectCliPath, ...invocation.args], command.repoRoot)
}

async function resolveWindowsNodePath(command) {
  if (command.windowsNodePath !== null) {
    if (!(await pathExists(command.windowsNodePath))) {
      throw new Error(`Windows node executable not found: ${command.windowsNodePath}`)
    }
    return command.windowsNodePath
  }

  return ensurePinnedNodeExecutable({
    repoRoot: command.repoRoot,
    cacheDir: path.join(command.cacheDir, 'windows-node'),
    nodeVersion: command.nodeVersion,
    descriptor: resolveWindowsRuntimeDescriptor(command.nodeVersion),
  })
}

async function resolveSeaNodePath(command) {
  if (command.seaNodePath !== null) {
    if (!(await pathExists(command.seaNodePath))) {
      throw new Error(`SEA blob node executable not found: ${command.seaNodePath}`)
    }
    return command.seaNodePath
  }

  if (process.platform === 'win32') {
    return command.windowsNodeExecutablePath
  }

  return ensurePinnedNodeExecutable({
    repoRoot: command.repoRoot,
    cacheDir: path.join(command.cacheDir, 'host-node'),
    nodeVersion: command.nodeVersion,
    descriptor: resolveHostRuntimeDescriptor({
      nodeVersion: command.nodeVersion,
    }),
  })
}

export async function buildWindowsStartupLauncher(command = {}) {
  const repoRoot = command.repoRoot ?? resolveRepoRoot(path.dirname(fileURLToPath(import.meta.url)))
  const outputPath = path.resolve(repoRoot, command.outputPath ?? DEFAULT_OUTPUT_RELATIVE_PATH)
  const cacheDir = path.resolve(repoRoot, command.cacheDir ?? DEFAULT_CACHE_RELATIVE_PATH)
  const nodeVersion = command.nodeVersion ?? DEFAULT_NODE_WINDOWS_VERSION
  const entryPath = path.resolve(repoRoot, DEFAULT_ENTRY_RELATIVE_PATH)

  if (!(await pathExists(entryPath))) {
    throw new Error(`Launcher entrypoint not found: ${entryPath}`)
  }

  const windowsNodeExecutablePath = await resolveWindowsNodePath({
    repoRoot,
    cacheDir,
    nodeVersion,
    windowsNodePath: command.windowsNodePath ?? null,
  })
  const seaNodePath = await resolveSeaNodePath({
    repoRoot,
    cacheDir,
    nodeVersion,
    seaNodePath: command.seaNodePath ?? null,
    windowsNodeExecutablePath,
  })

  await fs.mkdir(cacheDir, { recursive: true })
  const workDir = await fs.mkdtemp(path.join(cacheDir, 'build-'))
  try {
    const bundlePath = path.join(workDir, 'ct-agent-startup.cjs')
    const blobPath = path.join(workDir, 'ct-agent-startup.blob')

    await esbuild(
      createStartupLauncherEsbuildOptions({
        entryPath,
        outfile: bundlePath,
      }),
    )

    await generateSeaBlob({
      workDir,
      seaNodePath,
      bundlePath,
      blobPath,
    })

    await fs.mkdir(path.dirname(outputPath), { recursive: true })
    await fs.copyFile(windowsNodeExecutablePath, outputPath)

    await injectSeaBlob({
      repoRoot,
      outputPath,
      blobPath,
    })
    await assertPortableExecutable(outputPath)
  } finally {
    await fs.rm(workDir, { recursive: true, force: true })
  }

  return {
    outputPath,
    windowsNodeExecutablePath,
    seaNodePath,
    nodeVersion,
  }
}

async function main() {
  const parsed = parseCliArgs(process.argv.slice(2))
  const result = await buildWindowsStartupLauncher(parsed)
  const repoRoot = resolveRepoRoot(path.dirname(fileURLToPath(import.meta.url)))
  console.log(`[agent:startup-launcher] output=${path.relative(repoRoot, result.outputPath)}`)
}

const isDirectExecution =
  process.argv[1] != null && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isDirectExecution) {
  main().catch((error) => {
    console.error(`[agent:startup-launcher] failed: ${toErrorMessage(error)}`)
    process.exitCode = 1
  })
}
