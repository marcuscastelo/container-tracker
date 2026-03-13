import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import fsSync from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const DEFAULT_NODE_WINDOWS_VERSION = 'v22.11.0'
const DEFAULT_AGENT_DEPLOY_WORKSPACE = 'example-with-tailwindcss'
const NODE_WINDOWS_SHA256_BY_VERSION: Readonly<Record<string, string>> = {
  'v22.11.0': '905373a059aecaf7f48c1ce10ffbd5334457ca00f678747f19db5ea7d256c236',
}
const AGENT_RUNTIME_DIRECT_DEPENDENCIES = [
  '@supabase/supabase-js',
  '@supabase/functions-js',
  'axios',
  'puppeteer',
  'puppeteer-extra',
  'puppeteer-extra-plugin-stealth',
  'puppeteer-extra-plugin-user-data-dir',
  'puppeteer-extra-plugin-user-preferences',
  'zod',
] as const
const RELEASE_APP_REQUIRED_TOP_LEVEL_ENTRIES = ['dist', 'node_modules', 'package.json'] as const
const NODE_MODULES_METADATA_ENTRIES = [
  '.modules.yaml',
  '.pnpm',
  '.pnpm-workspace-state-v1.json',
] as const

const REQUIRED_RELEASE_FILES = [
  'node/node.exe',
  'app/dist/agent.js',
  'app/dist/updater.js',
  'app/dist/tools/agent/supervisor.js',
  'config/bootstrap.env',
] as const

const REQUIRED_CONFIG_KEYS = [
  'BACKEND_URL',
  'INSTALLER_TOKEN',
  'AGENT_ID',
  'INTERVAL_SEC',
  'LIMIT',
] as const

const REQUIRED_RUNTIME_DEPENDENCY_PACKAGES = [
  '@supabase/supabase-js',
  '@supabase/functions-js',
] as const

const STATIC_GATE_FILES = [
  'tools/agent/installer/installer.iss',
  'tools/agent/agent.ts',
  'tools/agent/supervisor.ts',
  'tools/agent/updater.ts',
  'tools/agent/rebuild-reinstall.ps1',
] as const

const STATIC_GATE_FORBIDDEN_PATTERNS = [
  {
    label: 'ProgramData',
    pattern: /programdata/iu,
  },
  {
    label: '{commonappdata}',
    pattern: /\{commonappdata\}/iu,
  },
  {
    label: '/RU SYSTEM',
    pattern: /\/ru\s+system/iu,
  },
  {
    label: 'highest privileges',
    pattern: /highest privileges/iu,
  },
] as const

type RuntimeDependencyResolution = {
  readonly packageName: string
  readonly packageDir: string
  readonly depId: string
}

type RuntimeDependencySnapshot = {
  readonly directResolutions: readonly RuntimeDependencyResolution[]
  readonly dependencyIds: ReadonlySet<string>
}

type BootstrapEnvConfig = {
  readonly BACKEND_URL: string
  readonly INSTALLER_TOKEN: string
  readonly AGENT_ID: string
  readonly INTERVAL_SEC: string
  readonly LIMIT: string
  readonly MAERSK_ENABLED: string
  readonly MAERSK_HEADLESS: string
  readonly MAERSK_TIMEOUT_MS: string
  readonly MAERSK_USER_DATA_DIR: string | null
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}

function normalizeEnvValue(value: string | undefined): string | null {
  if (value === undefined) {
    return null
  }

  const normalized = value.trim()
  if (normalized.length === 0) {
    return null
  }

  if (
    normalized.length >= 2 &&
    ((normalized.startsWith('"') && normalized.endsWith('"')) ||
      (normalized.startsWith("'") && normalized.endsWith("'")))
  ) {
    return normalized.slice(1, -1)
  }

  return normalized
}

async function readEnvFileMap(filePath: string): Promise<ReadonlyMap<string, string>> {
  if (!(await pathExists(filePath))) {
    return new Map()
  }

  const content = await fs.readFile(filePath, 'utf8')
  const result = new Map<string, string>()
  const lines = content.split(/\r?\n/)
  for (const rawLine of lines) {
    let entry = rawLine.trim()
    if (entry.length === 0 || entry.startsWith('#')) {
      continue
    }

    if (entry.startsWith('export ')) {
      entry = entry.slice(7).trimStart()
    }

    const separatorIndex = entry.indexOf('=')
    if (separatorIndex <= 0) {
      continue
    }

    const key = entry.slice(0, separatorIndex).trim()
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/u.test(key)) {
      continue
    }

    const value = normalizeEnvValue(entry.slice(separatorIndex + 1))
    if (value) {
      result.set(key, value)
    }
  }

  return result
}

function getFirstEnvValue(command: {
  readonly dotenvValues: ReadonlyMap<string, string>
  readonly keys: readonly string[]
  readonly fallback?: string
}): string | null {
  for (const key of command.keys) {
    const dotenvValue = normalizeEnvValue(command.dotenvValues.get(key))
    if (dotenvValue) {
      return dotenvValue
    }

    const processValue = normalizeEnvValue(process.env[key])
    if (processValue) {
      return processValue
    }
  }

  if (command.fallback !== undefined) {
    return command.fallback
  }

  return null
}

async function resolveBootstrapEnvConfig(repoRoot: string): Promise<BootstrapEnvConfig> {
  const dotenvValues = await readEnvFileMap(path.join(repoRoot, '.env'))

  const backendUrl = getFirstEnvValue({
    dotenvValues,
    keys: ['BACKEND_URL', 'AGENT_BACKEND_URL'],
  })
  const installerToken = getFirstEnvValue({
    dotenvValues,
    keys: ['INSTALLER_TOKEN', 'AGENT_INSTALLER_TOKEN'],
  })

  if (!backendUrl || !installerToken) {
    throw new Error(
      'missing BACKEND_URL and/or INSTALLER_TOKEN in process env or repository .env for bootstrap.env generation',
    )
  }

  const hostnameFallback =
    normalizeEnvValue(process.env.COMPUTERNAME) ??
    normalizeEnvValue(process.env.HOSTNAME) ??
    'container-tracker-agent'

  return {
    BACKEND_URL: backendUrl,
    INSTALLER_TOKEN: installerToken,
    AGENT_ID:
      getFirstEnvValue({
        dotenvValues,
        keys: ['AGENT_ID'],
        fallback: hostnameFallback,
      }) ?? hostnameFallback,
    INTERVAL_SEC:
      getFirstEnvValue({
        dotenvValues,
        keys: ['INTERVAL_SEC', 'AGENT_ENROLL_DEFAULT_INTERVAL_SEC'],
        fallback: '60',
      }) ?? '60',
    LIMIT:
      getFirstEnvValue({
        dotenvValues,
        keys: ['LIMIT', 'AGENT_ENROLL_DEFAULT_LIMIT'],
        fallback: '10',
      }) ?? '10',
    MAERSK_ENABLED:
      getFirstEnvValue({
        dotenvValues,
        keys: ['MAERSK_ENABLED', 'AGENT_ENROLL_DEFAULT_MAERSK_ENABLED'],
        fallback: '1',
      }) ?? '1',
    MAERSK_HEADLESS:
      getFirstEnvValue({
        dotenvValues,
        keys: ['MAERSK_HEADLESS', 'AGENT_ENROLL_DEFAULT_MAERSK_HEADLESS'],
        fallback: '1',
      }) ?? '1',
    MAERSK_TIMEOUT_MS:
      getFirstEnvValue({
        dotenvValues,
        keys: ['MAERSK_TIMEOUT_MS', 'AGENT_ENROLL_DEFAULT_MAERSK_TIMEOUT_MS'],
        fallback: '120000',
      }) ?? '120000',
    MAERSK_USER_DATA_DIR: getFirstEnvValue({
      dotenvValues,
      keys: ['MAERSK_USER_DATA_DIR', 'AGENT_ENROLL_DEFAULT_MAERSK_USER_DATA_DIR'],
    }),
  }
}

function serializeBootstrapEnv(config: BootstrapEnvConfig): string {
  const lines = [
    '# Container Tracker Agent bootstrap configuration',
    '# Generated by tools/agent/build-release.ts',
    '# This file is consumed by runtime enrollment and then renamed to bootstrap.env.consumed.',
    '',
    `BACKEND_URL=${config.BACKEND_URL}`,
    `INSTALLER_TOKEN=${config.INSTALLER_TOKEN}`,
    `AGENT_ID=${config.AGENT_ID}`,
    `INTERVAL_SEC=${config.INTERVAL_SEC}`,
    `LIMIT=${config.LIMIT}`,
    '',
    '# Optional provider settings',
    `MAERSK_ENABLED=${config.MAERSK_ENABLED}`,
    `MAERSK_HEADLESS=${config.MAERSK_HEADLESS}`,
    `MAERSK_TIMEOUT_MS=${config.MAERSK_TIMEOUT_MS}`,
  ]

  if (config.MAERSK_USER_DATA_DIR) {
    lines.push(`MAERSK_USER_DATA_DIR=${config.MAERSK_USER_DATA_DIR}`)
  } else {
    lines.push('MAERSK_USER_DATA_DIR=')
  }

  return `${lines.join('\n')}\n`
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath)
    return true
  } catch {
    return false
  }
}

async function removePathSafely(targetPath: string): Promise<void> {
  let stats: fsSync.Stats
  try {
    stats = await fs.lstat(targetPath)
  } catch {
    return
  }

  if (stats.isSymbolicLink()) {
    await fs.unlink(targetPath)
    return
  }

  await fs.rm(targetPath, { recursive: true, force: true })
}

async function ensurePathExists(targetPath: string, label: string): Promise<void> {
  if (!(await pathExists(targetPath))) {
    throw new Error(`${label} not found: ${targetPath}`)
  }
}

function resolveRepoRoot(startDir: string): string {
  let cursor = startDir

  for (;;) {
    const marker = path.join(cursor, 'tools', 'agent', 'agent.ts')
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

function runCommand(command: string, args: readonly string[], cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
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

async function runPnpmCommand(args: readonly string[], cwd: string): Promise<void> {
  if (process.platform === 'win32') {
    let lastError: unknown = null
    const comspec = process.env.ComSpec ?? 'cmd.exe'

    try {
      await runCommand(comspec, ['/d', '/s', '/c', 'pnpm.cmd', ...args], cwd)
      return
    } catch (error) {
      lastError = error
      console.warn(
        `[agent:release] failed to run "pnpm.cmd" via cmd.exe (${toErrorMessage(error)}), trying direct binary...`,
      )
    }

    try {
      await runCommand('pnpm', args, cwd)
      return
    } catch (error) {
      lastError = error
    }

    throw new Error(`failed to run pnpm command: ${toErrorMessage(lastError)}`)
  }

  await runCommand('pnpm', args, cwd)
}

async function runPnpmDeployWithLegacyFallback(command: {
  readonly args: readonly string[]
  readonly cwd: string
}): Promise<void> {
  const argsWithLegacy = [...command.args]
  const deployIndex = argsWithLegacy.indexOf('deploy')
  if (deployIndex < 0) {
    await runPnpmCommand(command.args, command.cwd)
    return
  }

  argsWithLegacy.splice(deployIndex + 1, 0, '--legacy')

  try {
    await runPnpmCommand(argsWithLegacy, command.cwd)
    return
  } catch (legacyError) {
    console.warn(
      `[agent:release] pnpm deploy with --legacy failed (${toErrorMessage(
        legacyError,
      )}); retrying without --legacy`,
    )
  }

  try {
    await runPnpmCommand(command.args, command.cwd)
  } catch (defaultError) {
    throw new Error(
      `pnpm deploy failed both with and without --legacy (${toErrorMessage(defaultError)})`,
    )
  }
}

async function extractZip(zipPath: string, destinationDir: string, cwd: string): Promise<void> {
  if (process.platform === 'win32') {
    try {
      await runCommand('tar', ['-xf', zipPath, '-C', destinationDir], cwd)
      return
    } catch {
      // Fall back to Expand-Archive when tar is unavailable.
    }

    const powershellCommand = [
      `$zip = '${zipPath.replaceAll("'", "''")}'`,
      `$destination = '${destinationDir.replaceAll("'", "''")}'`,
      'Expand-Archive -LiteralPath $zip -DestinationPath $destination -Force',
    ].join('; ')
    await runCommand(
      'powershell',
      [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-Command',
        powershellCommand,
      ],
      cwd,
    )
    return
  }

  try {
    await runCommand('unzip', ['-q', '-o', zipPath, '-d', destinationDir], cwd)
  } catch {
    await runCommand('tar', ['-xf', zipPath, '-C', destinationDir], cwd)
  }
}

async function downloadFile(url: string, targetPath: string): Promise<void> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`download failed (${response.status}) for ${url}`)
  }

  await fs.mkdir(path.dirname(targetPath), { recursive: true })
  const arrayBuffer = await response.arrayBuffer()
  const fileBuffer = Buffer.from(arrayBuffer)
  await fs.writeFile(targetPath, fileBuffer)
}

async function ensureDownloadedFile(command: {
  readonly label: string
  readonly url: string
  readonly targetPath: string
}): Promise<void> {
  if (await pathExists(command.targetPath)) {
    console.log(`[agent:release] using cached ${command.label}: ${command.targetPath}`)
    return
  }

  console.log(`[agent:release] downloading ${command.label}: ${command.url}`)
  await downloadFile(command.url, command.targetPath)
}

async function computeFileSha256(filePath: string): Promise<string> {
  const fileBuffer = await fs.readFile(filePath)
  return createHash('sha256').update(fileBuffer).digest('hex')
}

async function verifyNodeRuntimeChecksum(command: {
  readonly nodeVersion: string
  readonly nodeZipPath: string
}): Promise<void> {
  const expectedSha256 = NODE_WINDOWS_SHA256_BY_VERSION[command.nodeVersion]
  if (!expectedSha256) {
    console.warn(
      `[agent:release] node checksum verification skipped: no pinned SHA-256 for ${command.nodeVersion}`,
    )
    return
  }

  const observedSha256 = await computeFileSha256(command.nodeZipPath)
  if (observedSha256 !== expectedSha256) {
    throw new Error(
      `node runtime checksum mismatch for ${command.nodeVersion} (expected ${expectedSha256}, got ${observedSha256})`,
    )
  }

  console.log(`[agent:release] verified node runtime SHA-256 for ${command.nodeVersion}`)
}

async function findExtractedNodeDirectory(extractDir: string): Promise<string> {
  const entries = await fs.readdir(extractDir, { withFileTypes: true })
  const candidate = entries.find((entry) => entry.isDirectory() && entry.name.includes('-win-x64'))
  if (!candidate) {
    throw new Error(`could not find extracted node win-x64 directory inside ${extractDir}`)
  }

  return path.join(extractDir, candidate.name)
}

async function writeAgentEntrypointShims(distDir: string): Promise<void> {
  const agentShimPath = path.join(distDir, 'agent.js')
  const updaterShimPath = path.join(distDir, 'updater.js')

  const shimBanner = '// Generated by tools/agent/build-release.ts\n'
  await fs.writeFile(agentShimPath, `${shimBanner}import './tools/agent/supervisor.js'\n`, 'utf8')
  await fs.writeFile(updaterShimPath, `${shimBanner}import './tools/agent/updater.js'\n`, 'utf8')
}

function isInsideDirectory(rootDir: string, targetPath: string): boolean {
  const relativePath = path.relative(rootDir, targetPath)
  return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath))
}

function extractRelativePathFromAnyNodeModules(targetPath: string): string | null {
  const normalizedTargetPath = path.normalize(targetPath)
  const marker = `${path.sep}node_modules${path.sep}`
  const markerIndex = normalizedTargetPath.lastIndexOf(marker)
  if (markerIndex < 0) {
    return null
  }

  const relativePath = normalizedTargetPath.slice(markerIndex + marker.length)
  return relativePath.length > 0 ? relativePath : null
}

function remapAbsoluteRuntimeSymlinkTarget(command: {
  readonly sourceNodeModulesDir: string
  readonly targetNodeModulesDir: string
  readonly resolvedTargetPath: string
}): string | null {
  if (isInsideDirectory(command.sourceNodeModulesDir, command.resolvedTargetPath)) {
    const relativeFromSourceRoot = path.relative(
      command.sourceNodeModulesDir,
      command.resolvedTargetPath,
    )
    return path.join(command.targetNodeModulesDir, relativeFromSourceRoot)
  }

  const relativeFromNodeModules = extractRelativePathFromAnyNodeModules(command.resolvedTargetPath)
  if (!relativeFromNodeModules) {
    return null
  }

  return path.join(command.targetNodeModulesDir, relativeFromNodeModules)
}

function toPackageNameSegments(packageName: string): readonly [string, string] | readonly [string] {
  if (!packageName.startsWith('@')) {
    return [packageName]
  }

  const segments = packageName.split('/')
  if (segments.length !== 2 || segments[0].length === 0 || segments[1].length === 0) {
    throw new Error(`invalid scoped package name: ${packageName}`)
  }

  return [segments[0], segments[1]]
}

function resolvePackageEntryPath(nodeModulesDir: string, packageName: string): string {
  return path.join(nodeModulesDir, ...toPackageNameSegments(packageName))
}

async function listPackageNamesInNodeModules(nodeModulesDir: string): Promise<readonly string[]> {
  const packageNames: string[] = []
  const entries = await fs.readdir(nodeModulesDir, { withFileTypes: true })
  entries.sort((left, right) => left.name.localeCompare(right.name))

  for (const entry of entries) {
    if (entry.name.startsWith('.')) {
      continue
    }

    const entryPath = path.join(nodeModulesDir, entry.name)
    if (entry.name.startsWith('@')) {
      if (!entry.isDirectory()) {
        continue
      }

      const scopedEntries = await fs.readdir(entryPath, { withFileTypes: true })
      scopedEntries.sort((left, right) => left.name.localeCompare(right.name))
      for (const scopedEntry of scopedEntries) {
        if (!scopedEntry.isDirectory() && !scopedEntry.isSymbolicLink()) {
          continue
        }

        packageNames.push(`${entry.name}/${scopedEntry.name}`)
      }
      continue
    }

    if (!entry.isDirectory() && !entry.isSymbolicLink()) {
      continue
    }

    packageNames.push(entry.name)
  }

  return packageNames
}

function extractPnpmDepId(pnpmStoreDir: string, packageDir: string): string | null {
  if (!isInsideDirectory(pnpmStoreDir, packageDir)) {
    return null
  }

  const relativePath = path.relative(pnpmStoreDir, packageDir)
  const segments = relativePath.split(path.sep)
  if (segments.length < 3) {
    return null
  }

  if (segments[0] === 'node_modules' || segments[1] !== 'node_modules') {
    return null
  }

  return segments[0]
}

async function resolvePackageDirFromPnpmStore(
  pnpmStoreDir: string,
  packageName: string,
): Promise<string | null> {
  if (!(await pathExists(pnpmStoreDir))) {
    return null
  }

  const packageSuffix = path.join('node_modules', ...toPackageNameSegments(packageName))
  const entries = await fs.readdir(pnpmStoreDir, { withFileTypes: true })
  entries.sort((left, right) => left.name.localeCompare(right.name))

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === 'node_modules') {
      continue
    }

    const candidatePackageDir = path.join(pnpmStoreDir, entry.name, packageSuffix)
    const candidatePackageJson = path.join(candidatePackageDir, 'package.json')
    if (await pathExists(candidatePackageJson)) {
      return candidatePackageDir
    }
  }

  return null
}

async function resolveRuntimeDependencyPackage(command: {
  readonly nodeModulesDir: string
  readonly pnpmStoreDir: string
  readonly packageName: string
}): Promise<RuntimeDependencyResolution> {
  const topLevelEntryPath = resolvePackageEntryPath(command.nodeModulesDir, command.packageName)
  let packageDir: string | null = null

  if (await pathExists(topLevelEntryPath)) {
    packageDir = await fs.realpath(topLevelEntryPath)
  } else {
    packageDir = await resolvePackageDirFromPnpmStore(command.pnpmStoreDir, command.packageName)
  }

  if (!packageDir) {
    throw new Error(`missing runtime dependency package: ${command.packageName}`)
  }

  const depId = extractPnpmDepId(command.pnpmStoreDir, packageDir)
  if (!depId) {
    throw new Error(
      `runtime dependency package "${command.packageName}" is outside pnpm store: ${packageDir}`,
    )
  }

  return {
    packageName: command.packageName,
    packageDir,
    depId,
  }
}

async function collectRuntimePnpmDependencyIds(command: {
  readonly nodeModulesDir: string
  readonly pnpmStoreDir: string
  readonly directDependencies: readonly string[]
}): Promise<{
  readonly directResolutions: readonly RuntimeDependencyResolution[]
  readonly dependencyIds: ReadonlySet<string>
}> {
  const directResolutions: RuntimeDependencyResolution[] = []
  for (const packageName of command.directDependencies) {
    directResolutions.push(
      await resolveRuntimeDependencyPackage({
        nodeModulesDir: command.nodeModulesDir,
        pnpmStoreDir: command.pnpmStoreDir,
        packageName,
      }),
    )
  }

  const visitedDepIds = new Set<string>()
  const dependencyIds = new Set<string>()
  const queue = directResolutions.map((resolution) => resolution.depId)

  while (queue.length > 0) {
    const currentDepId = queue.pop()
    if (!currentDepId || visitedDepIds.has(currentDepId)) {
      continue
    }

    const currentStoreNodeModulesDir = path.join(command.pnpmStoreDir, currentDepId, 'node_modules')
    if (!(await pathExists(currentStoreNodeModulesDir))) {
      continue
    }

    visitedDepIds.add(currentDepId)
    dependencyIds.add(currentDepId)

    const nestedPackageNames = await listPackageNamesInNodeModules(currentStoreNodeModulesDir)
    for (const nestedPackageName of nestedPackageNames) {
      const nestedEntryPath = resolvePackageEntryPath(currentStoreNodeModulesDir, nestedPackageName)
      let resolvedNestedPackageDir: string

      try {
        resolvedNestedPackageDir = await fs.realpath(nestedEntryPath)
      } catch {
        continue
      }

      if (!isInsideDirectory(command.pnpmStoreDir, resolvedNestedPackageDir)) {
        continue
      }

      const nestedDepId = extractPnpmDepId(command.pnpmStoreDir, resolvedNestedPackageDir)
      if (!nestedDepId || visitedDepIds.has(nestedDepId)) {
        continue
      }

      queue.push(nestedDepId)
    }
  }

  return {
    directResolutions,
    dependencyIds,
  }
}

async function pruneReleaseAppTopLevelEntries(releaseAppDir: string): Promise<void> {
  const keepEntries = new Set<string>(RELEASE_APP_REQUIRED_TOP_LEVEL_ENTRIES)
  const entries = await fs.readdir(releaseAppDir, { withFileTypes: true })
  for (const entry of entries) {
    if (keepEntries.has(entry.name)) {
      continue
    }

    await fs.rm(path.join(releaseAppDir, entry.name), { recursive: true, force: true })
  }
}

async function pruneRuntimeNodeModules(
  releaseAppDir: string,
  runtimeSnapshot?: RuntimeDependencySnapshot,
): Promise<void> {
  const nodeModulesDir = path.join(releaseAppDir, 'node_modules')
  const pnpmStoreDir = path.join(nodeModulesDir, '.pnpm')

  if (!(await pathExists(nodeModulesDir))) {
    throw new Error(`release app is missing node_modules: ${nodeModulesDir}`)
  }
  if (!(await pathExists(pnpmStoreDir))) {
    throw new Error(`release app node_modules is missing .pnpm store: ${pnpmStoreDir}`)
  }

  const resolvedSnapshot =
    runtimeSnapshot ??
    (await collectRuntimePnpmDependencyIds({
      nodeModulesDir,
      pnpmStoreDir,
      directDependencies: AGENT_RUNTIME_DIRECT_DEPENDENCIES,
    }))
  const { directResolutions, dependencyIds } = resolvedSnapshot

  const pnpmStoreEntries = await fs.readdir(pnpmStoreDir, { withFileTypes: true })
  for (const entry of pnpmStoreEntries) {
    if (entry.name === 'node_modules') {
      continue
    }

    if (!entry.isDirectory()) {
      continue
    }

    if (dependencyIds.has(entry.name)) {
      continue
    }

    await fs.rm(path.join(pnpmStoreDir, entry.name), { recursive: true, force: true })
  }

  await fs.rm(path.join(pnpmStoreDir, 'node_modules'), { recursive: true, force: true })

  const topLevelEntries = await fs.readdir(nodeModulesDir, { withFileTypes: true })
  const keepTopLevelEntries = new Set<string>(NODE_MODULES_METADATA_ENTRIES)
  for (const entry of topLevelEntries) {
    if (keepTopLevelEntries.has(entry.name)) {
      continue
    }

    await fs.rm(path.join(nodeModulesDir, entry.name), { recursive: true, force: true })
  }

  const symlinkType: fsSync.symlink.Type = process.platform === 'win32' ? 'junction' : 'dir'
  const topLevelLinkTargets = new Map<string, string>()
  const sortedDependencyIds = [...dependencyIds].sort((left, right) => left.localeCompare(right))
  for (const dependencyId of sortedDependencyIds) {
    const dependencyNodeModulesDir = path.join(pnpmStoreDir, dependencyId, 'node_modules')
    if (!(await pathExists(dependencyNodeModulesDir))) {
      continue
    }

    const packageNames = await listPackageNamesInNodeModules(dependencyNodeModulesDir)
    for (const packageName of packageNames) {
      if (topLevelLinkTargets.has(packageName)) {
        continue
      }

      const packagePath = resolvePackageEntryPath(dependencyNodeModulesDir, packageName)
      const packageJsonPath = path.join(packagePath, 'package.json')
      if (!(await pathExists(packageJsonPath))) {
        continue
      }

      topLevelLinkTargets.set(packageName, packagePath)
    }
  }

  // Ensure direct runtime dependencies always point to the exact synced snapshot.
  for (const resolution of directResolutions) {
    topLevelLinkTargets.set(
      resolution.packageName,
      path.join(
        pnpmStoreDir,
        resolution.depId,
        'node_modules',
        ...toPackageNameSegments(resolution.packageName),
      ),
    )
  }

  for (const [packageName, storePackagePath] of topLevelLinkTargets) {
    const storePackageJson = path.join(storePackagePath, 'package.json')
    if (!(await pathExists(storePackageJson))) {
      continue
    }

    const topLevelEntryPath = resolvePackageEntryPath(nodeModulesDir, packageName)
    await fs.mkdir(path.dirname(topLevelEntryPath), { recursive: true })
    await removePathSafely(topLevelEntryPath)
    const relativeLinkTarget = path.relative(path.dirname(topLevelEntryPath), storePackagePath)
    await fs.symlink(relativeLinkTarget, topLevelEntryPath, symlinkType)
  }

  console.log(
    `[agent:release] pruned runtime node_modules to ${dependencyIds.size} package snapshots and ${topLevelLinkTargets.size} top-level links`,
  )
}

async function pruneRuntimeNodeModulesArtifacts(releaseAppDir: string): Promise<void> {
  const nodeModulesDir = path.join(releaseAppDir, 'node_modules')
  const pendingDirs = [nodeModulesDir]
  const removableSuffixes = ['.map', '.d.ts', '.d.mts', '.d.cts']
  let removedFilesCount = 0

  while (pendingDirs.length > 0) {
    const currentDir = pendingDirs.pop()
    if (!currentDir) {
      continue
    }

    const entries = await fs.readdir(currentDir, { withFileTypes: true })
    for (const entry of entries) {
      const entryPath = path.join(currentDir, entry.name)
      if (entry.isDirectory()) {
        pendingDirs.push(entryPath)
        continue
      }

      if (!entry.isFile()) {
        continue
      }

      if (!removableSuffixes.some((suffix) => entry.name.endsWith(suffix))) {
        continue
      }

      await fs.rm(entryPath, { force: true })
      removedFilesCount += 1
    }
  }

  console.log(`[agent:release] stripped ${removedFilesCount} non-runtime metadata files`)
}

async function ensureAgentRuntimeDependenciesInReleaseApp(command: {
  readonly repoRoot: string
  readonly releaseAppDir: string
}): Promise<RuntimeDependencySnapshot> {
  const sourceNodeModulesDir = path.join(command.repoRoot, 'node_modules')
  const sourcePnpmStoreDir = path.join(sourceNodeModulesDir, '.pnpm')
  const targetNodeModulesDir = path.join(command.releaseAppDir, 'node_modules')
  const targetPnpmStoreDir = path.join(targetNodeModulesDir, '.pnpm')

  await ensurePathExists(sourceNodeModulesDir, 'source node_modules')
  await ensurePathExists(sourcePnpmStoreDir, 'source pnpm store')
  await ensurePathExists(targetNodeModulesDir, 'release node_modules')
  await ensurePathExists(targetPnpmStoreDir, 'release pnpm store')

  const runtimeSnapshot = await collectRuntimePnpmDependencyIds({
    nodeModulesDir: sourceNodeModulesDir,
    pnpmStoreDir: sourcePnpmStoreDir,
    directDependencies: AGENT_RUNTIME_DIRECT_DEPENDENCIES,
  })
  const { directResolutions, dependencyIds } = runtimeSnapshot

  for (const dependencyId of dependencyIds) {
    const sourceDependencyDir = path.join(sourcePnpmStoreDir, dependencyId)
    const targetDependencyDir = path.join(targetPnpmStoreDir, dependencyId)
    if (await pathExists(targetDependencyDir)) {
      continue
    }

    await fs.cp(sourceDependencyDir, targetDependencyDir, { recursive: true })
  }

  const symlinkType: fsSync.symlink.Type = process.platform === 'win32' ? 'junction' : 'dir'
  for (const resolution of directResolutions) {
    const topLevelEntryPath = resolvePackageEntryPath(targetNodeModulesDir, resolution.packageName)
    const storePackagePath = path.join(
      targetPnpmStoreDir,
      resolution.depId,
      'node_modules',
      ...toPackageNameSegments(resolution.packageName),
    )
    const storePackageJson = path.join(storePackagePath, 'package.json')
    if (!(await pathExists(storePackageJson))) {
      throw new Error(
        `runtime dependency missing after sync: ${resolution.packageName} (${storePackagePath})`,
      )
    }

    await fs.mkdir(path.dirname(topLevelEntryPath), { recursive: true })
    await removePathSafely(topLevelEntryPath)
    const relativeLinkTarget = path.relative(path.dirname(topLevelEntryPath), storePackagePath)
    await fs.symlink(relativeLinkTarget, topLevelEntryPath, symlinkType)
  }

  await normalizeAbsoluteRuntimeSymlinks({
    sourceNodeModulesDir,
    targetNodeModulesDir,
  })

  console.log(
    `[agent:release] synced ${dependencyIds.size} runtime package snapshots from workspace cache`,
  )

  return runtimeSnapshot
}

async function normalizeAbsoluteRuntimeSymlinks(command: {
  readonly sourceNodeModulesDir: string
  readonly targetNodeModulesDir: string
}): Promise<void> {
  const pendingDirs = [command.targetNodeModulesDir]
  let normalizedCount = 0

  while (pendingDirs.length > 0) {
    const currentDir = pendingDirs.pop()
    if (!currentDir) {
      continue
    }

    const entries = await fs.readdir(currentDir, { withFileTypes: true })
    for (const entry of entries) {
      const entryPath = path.join(currentDir, entry.name)

      if (entry.isDirectory()) {
        pendingDirs.push(entryPath)
        continue
      }

      if (!entry.isSymbolicLink()) {
        continue
      }

      let rawTargetPath: string
      try {
        rawTargetPath = await fs.readlink(entryPath)
      } catch {
        continue
      }

      if (!path.isAbsolute(rawTargetPath)) {
        continue
      }

      const resolvedTargetPath = path.resolve(path.dirname(entryPath), rawTargetPath)
      const remappedTargetPath = remapAbsoluteRuntimeSymlinkTarget({
        sourceNodeModulesDir: command.sourceNodeModulesDir,
        targetNodeModulesDir: command.targetNodeModulesDir,
        resolvedTargetPath,
      })
      if (!remappedTargetPath) {
        throw new Error(
          `could not remap absolute runtime symlink target: ${entryPath} -> ${rawTargetPath}`,
        )
      }

      if (!(await pathExists(remappedTargetPath))) {
        throw new Error(`absolute runtime symlink target missing after sync: ${remappedTargetPath}`)
      }

      const targetStats = await fs.lstat(remappedTargetPath)
      const relativeLinkTarget = path.relative(path.dirname(entryPath), remappedTargetPath)
      let remappedSymlinkType: fsSync.symlink.Type | undefined
      if (process.platform === 'win32') {
        remappedSymlinkType = targetStats.isDirectory() ? 'junction' : 'file'
      } else {
        remappedSymlinkType = undefined
      }

      await removePathSafely(entryPath)
      await fs.symlink(relativeLinkTarget, entryPath, remappedSymlinkType)
      normalizedCount += 1
    }
  }

  if (normalizedCount > 0) {
    console.log(`[agent:release] normalized ${normalizedCount} absolute runtime symlink(s)`)
  }
}

async function pruneReleaseAppForRuntime(
  releaseAppDir: string,
  runtimeSnapshot?: RuntimeDependencySnapshot,
): Promise<void> {
  await pruneReleaseAppTopLevelEntries(releaseAppDir)
  await pruneRuntimeNodeModules(releaseAppDir, runtimeSnapshot)
  await pruneRuntimeNodeModulesArtifacts(releaseAppDir)
}

async function runPreflightChecks(command: {
  readonly repoRoot: string
  readonly releaseDir: string
  readonly installerFilePath: string
  readonly bootstrapTemplatePath: string
  readonly updaterSourcePath: string
  readonly runtimePathsSourcePath: string
  readonly canonicalRuntimePathsSourcePath: string
  readonly windowsAdapterSourcePath: string
}): Promise<void> {
  const errors: string[] = []

  for (const relativePath of REQUIRED_RELEASE_FILES) {
    const absolutePath = path.join(command.releaseDir, relativePath)
    if (!(await pathExists(absolutePath))) {
      errors.push(`missing required release file: ${relativePath}`)
    }
  }

  const releaseAppNodeModulesDir = path.join(command.releaseDir, 'app', 'node_modules')
  const releasePnpmStoreDir = path.join(releaseAppNodeModulesDir, '.pnpm')
  for (const packageName of REQUIRED_RUNTIME_DEPENDENCY_PACKAGES) {
    const topLevelPackageJson = path.join(
      resolvePackageEntryPath(releaseAppNodeModulesDir, packageName),
      'package.json',
    )
    if (await pathExists(topLevelPackageJson)) {
      continue
    }

    const packageDirFromStore = await resolvePackageDirFromPnpmStore(
      releasePnpmStoreDir,
      packageName,
    )
    if (packageDirFromStore && (await pathExists(path.join(packageDirFromStore, 'package.json')))) {
      continue
    }

    errors.push(`missing required runtime dependency package: ${packageName}`)
  }

  if (await pathExists(command.installerFilePath)) {
    const installerContentRaw = await fs.readFile(command.installerFilePath, 'utf8')

    const hasX64Mode =
      installerContentRaw.includes('ArchitecturesAllowed=x64') &&
      installerContentRaw.includes('ArchitecturesInstallIn64BitMode=x64')
    if (!hasX64Mode) {
      errors.push('installer.iss missing x64-only setup directives')
    }

    if (!installerContentRaw.includes('{app}') || !installerContentRaw.includes('{localappdata}')) {
      errors.push('installer.iss must reference both {app} and {localappdata}')
    }

    if (!installerContentRaw.includes('PrivilegesRequired=lowest')) {
      errors.push('installer.iss must use PrivilegesRequired=lowest')
    }

    if (!installerContentRaw.includes('DefaultDirName={localappdata}\\Programs\\')) {
      errors.push('installer.iss must install binaries under {localappdata}\\Programs')
    }

    if (installerContentRaw.includes('{commonappdata}')) {
      errors.push('installer.iss must not reference {commonappdata}')
    }

    if (
      !installerContentRaw.includes('agent-tray-host.ps1') ||
      !installerContentRaw.includes('updater-hidden.ps1')
    ) {
      errors.push('installer.iss must include tray/updater launcher scripts in [Files]/[Run]')
    }

    const schtasksCreateLines = installerContentRaw
      .split(/\r?\n/)
      .filter(
        (line) =>
          line.includes('Filename: "schtasks.exe"') && line.toLowerCase().includes('/create'),
      )

    if (schtasksCreateLines.length >= 2) {
      const normalizedCreateLines = schtasksCreateLines.map((line) =>
        line.replaceAll('""', '"').toLowerCase(),
      )
      const hasAgentCreate = normalizedCreateLines.some(
        (line) =>
          line.includes('powershell.exe') &&
          line.includes('-windowstyle hidden') &&
          line.includes('agent-tray-host.ps1'),
      )
      const hasUpdaterCreate = normalizedCreateLines.some(
        (line) =>
          line.includes('powershell.exe') &&
          line.includes('-windowstyle hidden') &&
          line.includes('updater-hidden.ps1'),
      )

      if (!hasAgentCreate || !hasUpdaterCreate) {
        errors.push('installer.iss missing expected ONLOGON task commands for agent/updater')
      }

      for (const line of normalizedCreateLines) {
        if (
          !line.includes('/sc onlogon') ||
          !line.includes('/it') ||
          !line.includes('/rl limited')
        ) {
          errors.push('installer.iss task commands must include /SC ONLOGON, /IT and /RL LIMITED')
          break
        }

        if (line.includes('/ru system') || line.includes('highest privileges')) {
          errors.push('installer.iss task commands must not use SYSTEM or highest privileges')
          break
        }
      }
    } else {
      errors.push('installer.iss must include two schtasks /Create commands')
    }
  } else {
    errors.push(`installer.iss not found: ${command.installerFilePath}`)
  }

  if (await pathExists(command.bootstrapTemplatePath)) {
    const templateContent = await fs.readFile(command.bootstrapTemplatePath, 'utf8')
    if (!/^MAERSK_ENABLED=0$/m.test(templateContent)) {
      errors.push('bootstrap.env.template must default MAERSK_ENABLED=0')
    }

    for (const key of REQUIRED_CONFIG_KEYS) {
      const pattern = new RegExp(`^${key}=`, 'm')
      if (!pattern.test(templateContent)) {
        errors.push(`bootstrap.env.template missing key: ${key}`)
      }
    }
  } else {
    errors.push(`bootstrap.env.template not found: ${command.bootstrapTemplatePath}`)
  }

  if (await pathExists(command.updaterSourcePath)) {
    const updaterSource = await fs.readFile(command.updaterSourcePath, 'utf8')
    if (!updaterSource.includes('DOTENV_PATH')) {
      errors.push('updater.ts must reference DOTENV_PATH')
    }

    if (!updaterSource.includes('resolveAgentPathLayout')) {
      errors.push('updater.ts must resolve runtime paths through resolveAgentPathLayout')
    }
  } else {
    errors.push(`updater.ts not found: ${command.updaterSourcePath}`)
  }

  if (await pathExists(command.runtimePathsSourcePath)) {
    const runtimePathsSource = await fs.readFile(command.runtimePathsSourcePath, 'utf8')
    if (!runtimePathsSource.includes("from './runtime/paths.ts'")) {
      errors.push('runtime-paths.ts must re-export canonical runtime path helpers')
    }
  } else {
    errors.push(`runtime-paths.ts not found: ${command.runtimePathsSourcePath}`)
  }

  if (await pathExists(command.canonicalRuntimePathsSourcePath)) {
    const canonicalRuntimePathsSource = await fs.readFile(
      command.canonicalRuntimePathsSourcePath,
      'utf8',
    )
    if (
      !canonicalRuntimePathsSource.includes('resolveAgentDataDir') ||
      !canonicalRuntimePathsSource.includes('/var/lib/container-tracker-agent') ||
      !canonicalRuntimePathsSource.includes('.agent-runtime')
    ) {
      errors.push(
        'runtime/paths.ts must provide Linux data-dir defaults (/var/lib/container-tracker-agent with .agent-runtime fallback)',
      )
    }
  } else {
    errors.push(`runtime/paths.ts not found: ${command.canonicalRuntimePathsSourcePath}`)
  }

  if (await pathExists(command.windowsAdapterSourcePath)) {
    const windowsAdapterSource = await fs.readFile(command.windowsAdapterSourcePath, 'utf8')
    if (
      !windowsAdapterSource.includes('DEFAULT_DATA_DIR_NAME') ||
      !windowsAdapterSource.includes('ContainerTracker') ||
      !windowsAdapterSource.includes('LOCALAPPDATA')
    ) {
      errors.push(
        'windows.adapter.ts must resolve fallback paths under LOCALAPPDATA\\ContainerTracker',
      )
    }
  } else {
    errors.push(`windows.adapter.ts not found: ${command.windowsAdapterSourcePath}`)
  }

  for (const relativePath of STATIC_GATE_FILES) {
    const absolutePath = path.join(command.repoRoot, relativePath)
    if (!(await pathExists(absolutePath))) {
      errors.push(`static gate file not found: ${relativePath}`)
      continue
    }

    const source = await fs.readFile(absolutePath, 'utf8')
    for (const forbidden of STATIC_GATE_FORBIDDEN_PATTERNS) {
      if (forbidden.pattern.test(source)) {
        errors.push(`forbidden token "${forbidden.label}" found in ${relativePath}`)
      }
    }
  }

  if (errors.length > 0) {
    console.error('[agent:release] preflight failed')
    for (const error of errors) {
      console.error(`  - ${error}`)
    }
    process.exit(1)
  }

  console.log('[agent:release] preflight ok')
  console.log(
    `[agent:release] release directory: ${path.relative(command.repoRoot, command.releaseDir)}`,
  )
}

async function buildRelease(): Promise<void> {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url))
  const repoRoot = resolveRepoRoot(scriptDir)
  const toolsAgentDir = path.join(repoRoot, 'tools', 'agent')
  const installerDir = path.join(toolsAgentDir, 'installer')
  const distDir = path.join(toolsAgentDir, 'dist')
  const releaseDir = path.join(repoRoot, 'release')
  const releaseAppDir = path.join(releaseDir, 'app')
  const releaseAppDistDir = path.join(releaseAppDir, 'dist')
  const releaseNodeDir = path.join(releaseDir, 'node')
  const releaseConfigDir = path.join(releaseDir, 'config')
  const tempDownloadDir = path.join(releaseDir, '.downloads')
  const cacheDownloadDir = path.join(toolsAgentDir, '.cache', 'downloads')

  const nodeVersion = process.env.AGENT_NODE_WINDOWS_VERSION ?? DEFAULT_NODE_WINDOWS_VERSION
  const agentDeployWorkspace = process.env.AGENT_DEPLOY_WORKSPACE ?? DEFAULT_AGENT_DEPLOY_WORKSPACE

  const compiledAgentFile = path.join(distDir, 'tools', 'agent', 'agent.js')
  const compiledSupervisorFile = path.join(distDir, 'tools', 'agent', 'supervisor.js')
  const compiledUpdaterFile = path.join(distDir, 'tools', 'agent', 'updater.js')

  await ensurePathExists(compiledAgentFile, 'compiled agent')
  await ensurePathExists(compiledSupervisorFile, 'compiled supervisor')
  await ensurePathExists(compiledUpdaterFile, 'compiled updater')

  await fs.rm(releaseDir, { recursive: true, force: true })
  await fs.mkdir(releaseDir, { recursive: true })
  await fs.mkdir(tempDownloadDir, { recursive: true })
  await fs.mkdir(releaseConfigDir, { recursive: true })
  await fs.mkdir(cacheDownloadDir, { recursive: true })
  const bootstrapEnvConfig = await resolveBootstrapEnvConfig(repoRoot)
  await fs.writeFile(
    path.join(releaseConfigDir, 'bootstrap.env'),
    serializeBootstrapEnv(bootstrapEnvConfig),
    'utf8',
  )
  console.log('[agent:release] generated release/config/bootstrap.env from effective environment')
  console.log(
    `[agent:release] deploying production dependencies from workspace "${agentDeployWorkspace}"`,
  )
  await runPnpmDeployWithLegacyFallback({
    args: ['--filter', agentDeployWorkspace, 'deploy', '--prod', releaseAppDir],
    cwd: repoRoot,
  })

  await fs.cp(distDir, releaseAppDistDir, { recursive: true })
  await writeAgentEntrypointShims(releaseAppDistDir)
  const runtimeSnapshot = await ensureAgentRuntimeDependenciesInReleaseApp({
    repoRoot,
    releaseAppDir,
  })
  await pruneReleaseAppForRuntime(releaseAppDir, runtimeSnapshot)

  const nodeZipName = `node-${nodeVersion}-win-x64.zip`
  const nodeZipPath = path.join(cacheDownloadDir, nodeZipName)
  const nodeExtractDir = path.join(tempDownloadDir, 'node-extracted')
  const nodeDownloadUrl = `https://nodejs.org/dist/${nodeVersion}/${nodeZipName}`
  await ensureDownloadedFile({
    label: 'node runtime',
    url: nodeDownloadUrl,
    targetPath: nodeZipPath,
  })
  await verifyNodeRuntimeChecksum({
    nodeVersion,
    nodeZipPath,
  })

  await fs.rm(nodeExtractDir, { recursive: true, force: true })
  await fs.mkdir(nodeExtractDir, { recursive: true })
  await extractZip(nodeZipPath, nodeExtractDir, repoRoot)

  const extractedNodeDir = await findExtractedNodeDirectory(nodeExtractDir)
  const extractedNodeExePath = path.join(extractedNodeDir, 'node.exe')
  await ensurePathExists(extractedNodeExePath, 'extracted node runtime executable')
  await fs.mkdir(releaseNodeDir, { recursive: true })
  await fs.cp(extractedNodeExePath, path.join(releaseNodeDir, 'node.exe'))

  await fs.rm(tempDownloadDir, { recursive: true, force: true })

  await runPreflightChecks({
    repoRoot,
    releaseDir,
    installerFilePath: path.join(installerDir, 'installer.iss'),
    bootstrapTemplatePath: path.join(installerDir, 'bootstrap.env.template'),
    updaterSourcePath: path.join(toolsAgentDir, 'updater.ts'),
    runtimePathsSourcePath: path.join(toolsAgentDir, 'runtime-paths.ts'),
    canonicalRuntimePathsSourcePath: path.join(toolsAgentDir, 'runtime', 'paths.ts'),
    windowsAdapterSourcePath: path.join(toolsAgentDir, 'platform', 'windows.adapter.ts'),
  })
}

void buildRelease().catch((error) => {
  console.error(`[agent:release] failed: ${toErrorMessage(error)}`)
  process.exit(1)
})
