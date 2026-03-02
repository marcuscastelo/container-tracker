import { spawn } from 'node:child_process'
import fsSync from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const DEFAULT_NODE_WINDOWS_VERSION = 'v22.11.0'
const DEFAULT_WINSW_VERSION = 'v2.12.0'
const AGENT_RUNTIME_DIRECT_DEPENDENCIES = [
  '@supabase/supabase-js',
  '@supabase/functions-js',
  'axios',
  'puppeteer',
  'puppeteer-extra',
  'puppeteer-extra-plugin-stealth',
  'zod',
] as const
const RELEASE_APP_REQUIRED_TOP_LEVEL_ENTRIES = ['dist', 'node_modules', 'package.json'] as const
const NODE_MODULES_METADATA_ENTRIES = [
  '.bin',
  '.modules.yaml',
  '.pnpm',
  '.pnpm-workspace-state-v1.json',
] as const

const REQUIRED_RELEASE_FILES = [
  'node/node.exe',
  'app/dist/agent.js',
  'app/dist/updater.js',
  'winsw/ContainerTrackerAgent.exe',
  'winsw/ContainerTrackerAgent.xml',
  'config/bootstrap.env',
] as const

const REQUIRED_CONFIG_KEYS = [
  'BACKEND_URL',
  'INSTALLER_TOKEN',
  'AGENT_ID',
  'INTERVAL_SEC',
  'LIMIT',
] as const

const REQUIRED_RUNTIME_DEPENDENCY_FILES = [
  'app/node_modules/@supabase/functions-js/package.json',
] as const

type RuntimeDependencyResolution = {
  readonly packageName: string
  readonly packageDir: string
  readonly depId: string
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath)
    return true
  } catch {
    return false
  }
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

async function extractZip(zipPath: string, destinationDir: string, cwd: string): Promise<void> {
  if (process.platform === 'win32') {
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
  await fs.writeFile(agentShimPath, `${shimBanner}import './tools/agent/agent.js'\n`, 'utf8')
  await fs.writeFile(updaterShimPath, `${shimBanner}import './tools/agent/updater.js'\n`, 'utf8')
}

function isInsideDirectory(rootDir: string, targetPath: string): boolean {
  const relativePath = path.relative(rootDir, targetPath)
  return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath))
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

async function pruneRuntimeNodeModules(releaseAppDir: string): Promise<void> {
  const nodeModulesDir = path.join(releaseAppDir, 'node_modules')
  const pnpmStoreDir = path.join(nodeModulesDir, '.pnpm')

  if (!(await pathExists(nodeModulesDir))) {
    throw new Error(`release app is missing node_modules: ${nodeModulesDir}`)
  }
  if (!(await pathExists(pnpmStoreDir))) {
    throw new Error(`release app node_modules is missing .pnpm store: ${pnpmStoreDir}`)
  }

  const { directResolutions, dependencyIds } = await collectRuntimePnpmDependencyIds({
    nodeModulesDir,
    pnpmStoreDir,
    directDependencies: AGENT_RUNTIME_DIRECT_DEPENDENCIES,
  })

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

  const topLevelEntries = await fs.readdir(nodeModulesDir, { withFileTypes: true })
  const keepTopLevelEntries = new Set<string>(NODE_MODULES_METADATA_ENTRIES)
  for (const entry of topLevelEntries) {
    if (keepTopLevelEntries.has(entry.name)) {
      continue
    }

    await fs.rm(path.join(nodeModulesDir, entry.name), { recursive: true, force: true })
  }

  const symlinkType: fsSync.symlink.Type = process.platform === 'win32' ? 'junction' : 'dir'
  for (const resolution of directResolutions) {
    const topLevelEntryPath = resolvePackageEntryPath(nodeModulesDir, resolution.packageName)
    const storePackagePath = path.join(
      pnpmStoreDir,
      resolution.depId,
      'node_modules',
      ...toPackageNameSegments(resolution.packageName),
    )
    const storePackageJson = path.join(storePackagePath, 'package.json')
    if (!(await pathExists(storePackageJson))) {
      throw new Error(
        `runtime dependency missing after pnpm pruning: ${resolution.packageName} (${storePackagePath})`,
      )
    }

    await fs.mkdir(path.dirname(topLevelEntryPath), { recursive: true })
    await fs.rm(topLevelEntryPath, { recursive: true, force: true })
    const relativeLinkTarget = path.relative(path.dirname(topLevelEntryPath), storePackagePath)
    await fs.symlink(relativeLinkTarget, topLevelEntryPath, symlinkType)
  }

  console.log(
    `[agent:release] pruned runtime node_modules to ${dependencyIds.size} package snapshots`,
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

async function pruneReleaseAppForRuntime(releaseAppDir: string): Promise<void> {
  await pruneReleaseAppTopLevelEntries(releaseAppDir)
  await pruneRuntimeNodeModules(releaseAppDir)
  await pruneRuntimeNodeModulesArtifacts(releaseAppDir)
}

async function runPreflightChecks(command: {
  readonly repoRoot: string
  readonly releaseDir: string
  readonly installerFilePath: string
  readonly bootstrapTemplatePath: string
  readonly updaterSourcePath: string
}): Promise<void> {
  const errors: string[] = []

  for (const relativePath of REQUIRED_RELEASE_FILES) {
    const absolutePath = path.join(command.releaseDir, relativePath)
    if (!(await pathExists(absolutePath))) {
      errors.push(`missing required release file: ${relativePath}`)
    }
  }

  for (const relativePath of REQUIRED_RUNTIME_DEPENDENCY_FILES) {
    const absolutePath = path.join(command.releaseDir, relativePath)
    if (!(await pathExists(absolutePath))) {
      errors.push(
        `missing required runtime dependency file: ${relativePath}`,
      )
    }
  }

  const winswXmlPath = path.join(command.releaseDir, 'winsw', 'ContainerTrackerAgent.xml')
  if (await pathExists(winswXmlPath)) {
    const xmlContent = await fs.readFile(winswXmlPath, 'utf8')
    const requiredXmlStrings = [
      'C:\\Program Files\\ContainerTrackerAgent\\node\\node.exe',
      'C:\\Program Files\\ContainerTrackerAgent\\app\\dist\\agent.js',
      'DOTENV_PATH=C:\\ProgramData\\ContainerTrackerAgent\\config.env',
    ]

    for (const value of requiredXmlStrings) {
      if (!xmlContent.includes(value)) {
        errors.push(`winsw xml missing required string: ${value}`)
      }
    }
  }

  if (await pathExists(command.installerFilePath)) {
    const installerContentRaw = await fs.readFile(command.installerFilePath, 'utf8')

    const hasX64Mode =
      installerContentRaw.includes('ArchitecturesAllowed=x64compatible') &&
      installerContentRaw.includes('ArchitecturesInstallIn64BitMode=x64compatible')
    if (!hasX64Mode) {
      errors.push('installer.iss missing x64-only setup directives')
    }

    if (
      !installerContentRaw.includes('{app}') ||
      !installerContentRaw.includes('{commonappdata}')
    ) {
      errors.push('installer.iss must reference both {app} and {commonappdata}')
    }

    const schtasksLine = installerContentRaw
      .split(/\r?\n/)
      .find((line) => line.includes('Filename: "schtasks.exe"'))

    if (schtasksLine) {
      const normalizedSchtasksLine = schtasksLine.replaceAll('""', '"')
      const hasCmdPrefix = normalizedSchtasksLine.includes('cmd /c')
      const hasNodeExecutable = normalizedSchtasksLine.includes('{app}\\node\\node.exe')
      const hasUpdaterScript = normalizedSchtasksLine.includes('{app}\\app\\dist\\updater.js')

      if (!hasCmdPrefix || !hasNodeExecutable || !hasUpdaterScript) {
        errors.push(
          'installer.iss missing expected task command: cmd /c "{app}\\node\\node.exe" "{app}\\app\\dist\\updater.js"',
        )
      }
    } else {
      errors.push('installer.iss missing schtasks creation command')
    }
  } else {
    errors.push(`installer.iss not found: ${command.installerFilePath}`)
  }

  if (await pathExists(command.bootstrapTemplatePath)) {
    const templateContent = await fs.readFile(command.bootstrapTemplatePath, 'utf8')
    if (!/^MAERSK_ENABLED=1$/m.test(templateContent)) {
      errors.push('bootstrap.env.template must contain MAERSK_ENABLED=1')
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

    const fallbackPathLiteral = 'C:\\\\ProgramData\\\\ContainerTrackerAgent\\\\config.env'
    const fallbackPathRuntime = 'C:\\ProgramData\\ContainerTrackerAgent\\config.env'
    if (
      !updaterSource.includes(fallbackPathLiteral) &&
      !updaterSource.includes(fallbackPathRuntime)
    ) {
      errors.push('updater.ts must include fallback ProgramData path')
    }
  } else {
    errors.push(`updater.ts not found: ${command.updaterSourcePath}`)
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
  const sourceNodeModulesDir = path.join(repoRoot, 'node_modules')
  const sourcePackageJsonPath = path.join(repoRoot, 'package.json')
  const releaseAppNodeModulesDir = path.join(releaseAppDir, 'node_modules')
  const releaseAppPackageJsonPath = path.join(releaseAppDir, 'package.json')
  const releaseAppDistDir = path.join(releaseAppDir, 'dist')
  const releaseWinswDir = path.join(releaseDir, 'winsw')
  const releaseNodeDir = path.join(releaseDir, 'node')
  const releaseConfigDir = path.join(releaseDir, 'config')
  const tempDownloadDir = path.join(releaseDir, '.downloads')
  const cacheDownloadDir = path.join(toolsAgentDir, '.cache', 'downloads')

  const nodeVersion = process.env.AGENT_NODE_WINDOWS_VERSION ?? DEFAULT_NODE_WINDOWS_VERSION
  const winswVersion = process.env.AGENT_WINSW_VERSION ?? DEFAULT_WINSW_VERSION

  const compiledAgentFile = path.join(distDir, 'tools', 'agent', 'agent.js')
  const compiledUpdaterFile = path.join(distDir, 'tools', 'agent', 'updater.js')

  await ensurePathExists(compiledAgentFile, 'compiled agent')
  await ensurePathExists(compiledUpdaterFile, 'compiled updater')

  await fs.rm(releaseDir, { recursive: true, force: true })
  await fs.mkdir(releaseDir, { recursive: true })
  await fs.mkdir(tempDownloadDir, { recursive: true })
  await fs.mkdir(releaseWinswDir, { recursive: true })
  await fs.mkdir(releaseConfigDir, { recursive: true })
  await fs.mkdir(cacheDownloadDir, { recursive: true })
  await ensurePathExists(sourceNodeModulesDir, 'repo node_modules')
  await ensurePathExists(sourcePackageJsonPath, 'repo package.json')
  await fs.cp(sourceNodeModulesDir, releaseAppNodeModulesDir, {
    recursive: true,
    verbatimSymlinks: true,
  })
  await fs.cp(sourcePackageJsonPath, releaseAppPackageJsonPath)

  await fs.cp(distDir, releaseAppDistDir, { recursive: true })
  await writeAgentEntrypointShims(releaseAppDistDir)
  await pruneReleaseAppForRuntime(releaseAppDir)

  const nodeZipName = `node-${nodeVersion}-win-x64.zip`
  const nodeZipPath = path.join(cacheDownloadDir, nodeZipName)
  const nodeExtractDir = path.join(tempDownloadDir, 'node-extracted')
  const nodeDownloadUrl = `https://nodejs.org/dist/${nodeVersion}/${nodeZipName}`
  await ensureDownloadedFile({
    label: 'node runtime',
    url: nodeDownloadUrl,
    targetPath: nodeZipPath,
  })

  await fs.rm(nodeExtractDir, { recursive: true, force: true })
  await fs.mkdir(nodeExtractDir, { recursive: true })
  await extractZip(nodeZipPath, nodeExtractDir, repoRoot)

  const extractedNodeDir = await findExtractedNodeDirectory(nodeExtractDir)
  await fs.cp(extractedNodeDir, releaseNodeDir, { recursive: true })

  const winswDownloadUrl = `https://github.com/winsw/winsw/releases/download/${winswVersion}/WinSW-x64.exe`
  const winswExePath = path.join(cacheDownloadDir, `WinSW-x64-${winswVersion}.exe`)
  await ensureDownloadedFile({
    label: 'winsw',
    url: winswDownloadUrl,
    targetPath: winswExePath,
  })
  await fs.cp(winswExePath, path.join(releaseWinswDir, 'ContainerTrackerAgent.exe'))

  await fs.cp(
    path.join(installerDir, 'ContainerTrackerAgent.xml'),
    path.join(releaseWinswDir, 'ContainerTrackerAgent.xml'),
  )
  await fs.cp(
    path.join(installerDir, 'bootstrap.env.template'),
    path.join(releaseConfigDir, 'bootstrap.env'),
  )

  await fs.rm(tempDownloadDir, { recursive: true, force: true })

  await runPreflightChecks({
    repoRoot,
    releaseDir,
    installerFilePath: path.join(installerDir, 'installer.iss'),
    bootstrapTemplatePath: path.join(installerDir, 'bootstrap.env.template'),
    updaterSourcePath: path.join(toolsAgentDir, 'updater.ts'),
  })
}

void buildRelease().catch((error) => {
  console.error(`[agent:release] failed: ${toErrorMessage(error)}`)
  process.exit(1)
})
