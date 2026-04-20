#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

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
]

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath)
    return true
  } catch {
    return false
  }
}

async function removePathSafely(targetPath) {
  let stats
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

function toPackageNameSegments(packageName) {
  if (!packageName.startsWith('@')) {
    return [packageName]
  }

  const segments = packageName.split('/')
  if (segments.length !== 2 || segments[0].length === 0 || segments[1].length === 0) {
    throw new Error(`Invalid scoped package name: ${packageName}`)
  }

  return [segments[0], segments[1]]
}

function resolvePackageEntryPath(nodeModulesDir, packageName) {
  return path.join(nodeModulesDir, ...toPackageNameSegments(packageName))
}

function isInsideDirectory(rootDir, targetPath) {
  const relativePath = path.relative(rootDir, targetPath)
  return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath))
}

function extractRelativePathFromAnyNodeModules(targetPath) {
  const normalizedTargetPath = path.normalize(targetPath)
  const marker = `${path.sep}node_modules${path.sep}`
  const markerIndex = normalizedTargetPath.lastIndexOf(marker)
  if (markerIndex < 0) {
    return null
  }

  const relativePath = normalizedTargetPath.slice(markerIndex + marker.length)
  return relativePath.length > 0 ? relativePath : null
}

function remapAbsoluteRuntimeSymlinkTarget({
  sourceNodeModulesDir,
  targetNodeModulesDir,
  resolvedTargetPath,
}) {
  if (isInsideDirectory(sourceNodeModulesDir, resolvedTargetPath)) {
    const relativeFromSourceRoot = path.relative(sourceNodeModulesDir, resolvedTargetPath)
    return path.join(targetNodeModulesDir, relativeFromSourceRoot)
  }

  const relativeFromNodeModules = extractRelativePathFromAnyNodeModules(resolvedTargetPath)
  if (!relativeFromNodeModules) {
    return null
  }

  return path.join(targetNodeModulesDir, relativeFromNodeModules)
}

function extractPnpmDepId(pnpmStoreDir, packageDir) {
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

function parsePackagePathFromNodeModulesRelativePath(relativePath) {
  const segments = relativePath.split(path.sep).filter((segment) => segment.length > 0)
  const firstSegment = segments[0]

  if (!firstSegment || firstSegment === '.pnpm') {
    return null
  }

  if (firstSegment.startsWith('@')) {
    const secondSegment = segments[1]
    if (!secondSegment) {
      return null
    }

    return {
      packageName: `${firstSegment}/${secondSegment}`,
      packageSubpath: segments.slice(2).join(path.sep),
    }
  }

  return {
    packageName: firstSegment,
    packageSubpath: segments.slice(1).join(path.sep),
  }
}

async function resolvePackagePathFromTargetPnpmStore({
  targetNodeModulesDir,
  relativePathFromNodeModules,
}) {
  const packagePath = parsePackagePathFromNodeModulesRelativePath(relativePathFromNodeModules)
  if (!packagePath) {
    return null
  }

  const targetPnpmStoreDir = path.join(targetNodeModulesDir, '.pnpm')
  const packageDirFromStore = await resolvePackageDirFromPnpmStore(
    targetPnpmStoreDir,
    packagePath.packageName,
  )
  if (!packageDirFromStore) {
    return null
  }

  if (packagePath.packageSubpath.length === 0) {
    return packageDirFromStore
  }

  return path.join(packageDirFromStore, packagePath.packageSubpath)
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function collectDependencyNames(source, dependencyNames) {
  if (!isPlainObject(source)) {
    return
  }

  for (const [packageName, versionRange] of Object.entries(source)) {
    if (packageName.length === 0 || typeof versionRange !== 'string') {
      continue
    }

    dependencyNames.add(packageName)
  }
}

async function readPackageDependencyNames(packageDir) {
  const packageJsonPath = path.join(packageDir, 'package.json')
  const packageJsonRaw = await fs.readFile(packageJsonPath, 'utf8')

  let parsedPackageJson
  try {
    parsedPackageJson = JSON.parse(packageJsonRaw)
  } catch {
    return []
  }

  if (!isPlainObject(parsedPackageJson)) {
    return []
  }

  const dependencyNames = new Set()
  collectDependencyNames(parsedPackageJson.dependencies, dependencyNames)
  collectDependencyNames(parsedPackageJson.optionalDependencies, dependencyNames)
  return [...dependencyNames].sort((left, right) => left.localeCompare(right))
}

async function listPackageNamesInNodeModules(nodeModulesDir) {
  const packageNames = []
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

async function resolvePackageDirFromPnpmStore(pnpmStoreDir, packageName) {
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

async function resolveRuntimeDependencyPackage({ nodeModulesDir, pnpmStoreDir, packageName }) {
  const topLevelEntryPath = resolvePackageEntryPath(nodeModulesDir, packageName)
  let topLevelPackageDir = null

  if (await pathExists(topLevelEntryPath)) {
    topLevelPackageDir = await fs.realpath(topLevelEntryPath)
    const topLevelDepId = extractPnpmDepId(pnpmStoreDir, topLevelPackageDir)
    if (topLevelDepId) {
      return {
        packageName,
        packageDir: topLevelPackageDir,
        depId: topLevelDepId,
      }
    }
  }

  const packageDirFromStore = await resolvePackageDirFromPnpmStore(pnpmStoreDir, packageName)
  if (packageDirFromStore) {
    const storeDepId = extractPnpmDepId(pnpmStoreDir, packageDirFromStore)
    if (!storeDepId) {
      throw new Error(`Could not derive pnpm dep id for ${packageName}: ${packageDirFromStore}`)
    }

    return {
      packageName,
      packageDir: packageDirFromStore,
      depId: storeDepId,
    }
  }

  if (!topLevelPackageDir) {
    throw new Error(`Missing runtime dependency package: ${packageName}`)
  }

  return {
    packageName,
    packageDir: topLevelPackageDir,
    depId: null,
  }
}

async function collectRuntimeDependencyIds({ nodeModulesDir, pnpmStoreDir, directDependencies }) {
  const directResolutions = []
  for (const packageName of directDependencies) {
    directResolutions.push(
      await resolveRuntimeDependencyPackage({
        nodeModulesDir,
        pnpmStoreDir,
        packageName,
      }),
    )
  }

  const visitedDepIds = new Set()
  const queuedDepIds = new Set()
  const dependencyIds = new Set()
  const queue = []

  function enqueueDependencyId(depId) {
    if (visitedDepIds.has(depId) || queuedDepIds.has(depId)) {
      return
    }

    queue.push(depId)
    queuedDepIds.add(depId)
  }

  for (const resolution of directResolutions) {
    if (resolution.depId !== null) {
      enqueueDependencyId(resolution.depId)
      continue
    }

    const dependencyNames = await readPackageDependencyNames(resolution.packageDir)
    for (const dependencyName of dependencyNames) {
      const nestedResolution = await resolveRuntimeDependencyPackage({
        nodeModulesDir,
        pnpmStoreDir,
        packageName: dependencyName,
      })
      if (nestedResolution.depId !== null) {
        enqueueDependencyId(nestedResolution.depId)
      }
    }
  }

  while (queue.length > 0) {
    const currentDepId = queue.pop()
    if (!currentDepId || visitedDepIds.has(currentDepId)) {
      continue
    }

    queuedDepIds.delete(currentDepId)

    const currentStoreNodeModulesDir = path.join(pnpmStoreDir, currentDepId, 'node_modules')
    if (!(await pathExists(currentStoreNodeModulesDir))) {
      continue
    }

    visitedDepIds.add(currentDepId)
    dependencyIds.add(currentDepId)

    const nestedPackageNames = await listPackageNamesInNodeModules(currentStoreNodeModulesDir)
    for (const nestedPackageName of nestedPackageNames) {
      const nestedEntryPath = resolvePackageEntryPath(currentStoreNodeModulesDir, nestedPackageName)
      let resolvedNestedPackageDir

      try {
        resolvedNestedPackageDir = await fs.realpath(nestedEntryPath)
      } catch {
        continue
      }

      if (!isInsideDirectory(pnpmStoreDir, resolvedNestedPackageDir)) {
        continue
      }

      const nestedDepId = extractPnpmDepId(pnpmStoreDir, resolvedNestedPackageDir)
      if (!nestedDepId) {
        continue
      }

      enqueueDependencyId(nestedDepId)
    }
  }

  return {
    directResolutions,
    dependencyIds,
  }
}

async function normalizeAbsoluteRuntimeSymlinks({ sourceNodeModulesDir, targetNodeModulesDir }) {
  const pendingDirs = [targetNodeModulesDir]
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

      let rawTargetPath
      try {
        rawTargetPath = await fs.readlink(entryPath)
      } catch {
        continue
      }

      if (!path.isAbsolute(rawTargetPath)) {
        continue
      }

      const resolvedTargetPath = path.resolve(path.dirname(entryPath), rawTargetPath)
      let resolvedRealTargetPath = resolvedTargetPath
      try {
        resolvedRealTargetPath = await fs.realpath(resolvedTargetPath)
      } catch {
        resolvedRealTargetPath = resolvedTargetPath
      }
      let remappedTargetPath = remapAbsoluteRuntimeSymlinkTarget({
        sourceNodeModulesDir,
        targetNodeModulesDir,
        resolvedTargetPath: resolvedRealTargetPath,
      })
      if (!remappedTargetPath) {
        throw new Error(
          `Could not remap absolute runtime symlink target: ${entryPath} -> ${rawTargetPath}`,
        )
      }

      if (!(await pathExists(remappedTargetPath))) {
        const relativePathFromNodeModules =
          extractRelativePathFromAnyNodeModules(resolvedRealTargetPath)
        if (relativePathFromNodeModules) {
          const targetStorePackagePath = await resolvePackagePathFromTargetPnpmStore({
            targetNodeModulesDir,
            relativePathFromNodeModules,
          })
          if (targetStorePackagePath) {
            remappedTargetPath = targetStorePackagePath
          }
        }
      }

      if (!(await pathExists(remappedTargetPath))) {
        throw new Error(`Absolute runtime symlink target missing after sync: ${remappedTargetPath}`)
      }

      const targetStats = await fs.lstat(remappedTargetPath)
      const relativeLinkTarget = path.relative(path.dirname(entryPath), remappedTargetPath)
      let symlinkType
      if (process.platform === 'win32') {
        symlinkType = targetStats.isDirectory() ? 'junction' : 'file'
      } else {
        symlinkType = undefined
      }

      await removePathSafely(entryPath)
      await fs.symlink(relativeLinkTarget, entryPath, symlinkType)
      normalizedCount += 1
    }
  }

  if (normalizedCount > 0) {
    console.log(`[agent:linux-package] normalized ${normalizedCount} absolute runtime symlink(s)`)
  }
}

async function syncRuntimeDependencies({ sourceNodeModulesDir, targetNodeModulesDir }) {
  const sourcePnpmStoreDir = path.join(sourceNodeModulesDir, '.pnpm')
  const targetPnpmStoreDir = path.join(targetNodeModulesDir, '.pnpm')

  if (!(await pathExists(sourcePnpmStoreDir))) {
    throw new Error(`Source pnpm store not found: ${sourcePnpmStoreDir}`)
  }
  if (!(await pathExists(targetPnpmStoreDir))) {
    throw new Error(`Target pnpm store not found: ${targetPnpmStoreDir}`)
  }

  const runtimeSnapshot = await collectRuntimeDependencyIds({
    nodeModulesDir: sourceNodeModulesDir,
    pnpmStoreDir: sourcePnpmStoreDir,
    directDependencies: AGENT_RUNTIME_DIRECT_DEPENDENCIES,
  })

  for (const dependencyId of runtimeSnapshot.dependencyIds) {
    const sourceDependencyDir = path.join(sourcePnpmStoreDir, dependencyId)
    const targetDependencyDir = path.join(targetPnpmStoreDir, dependencyId)
    await fs.rm(targetDependencyDir, { recursive: true, force: true })
    await fs.cp(sourceDependencyDir, targetDependencyDir, {
      recursive: true,
      verbatimSymlinks: true,
    })
  }

  const symlinkType = process.platform === 'win32' ? 'junction' : 'dir'
  for (const resolution of runtimeSnapshot.directResolutions) {
    const topLevelEntryPath = resolvePackageEntryPath(targetNodeModulesDir, resolution.packageName)
    await fs.mkdir(path.dirname(topLevelEntryPath), { recursive: true })
    await removePathSafely(topLevelEntryPath)

    if (resolution.depId === null) {
      await fs.cp(resolution.packageDir, topLevelEntryPath, {
        recursive: true,
        verbatimSymlinks: true,
      })
      continue
    }

    const storePackagePath = path.join(
      targetPnpmStoreDir,
      resolution.depId,
      'node_modules',
      ...toPackageNameSegments(resolution.packageName),
    )
    const packageJsonPath = path.join(storePackagePath, 'package.json')
    if (!(await pathExists(packageJsonPath))) {
      throw new Error(`Runtime dependency missing after sync: ${resolution.packageName}`)
    }

    const relativeLinkTarget = path.relative(path.dirname(topLevelEntryPath), storePackagePath)
    await fs.symlink(relativeLinkTarget, topLevelEntryPath, symlinkType)
  }

  await normalizeAbsoluteRuntimeSymlinks({
    sourceNodeModulesDir,
    targetNodeModulesDir,
  })

  const unpackedRuntimeDependencyCount = runtimeSnapshot.directResolutions.filter(
    (resolution) => resolution.depId === null,
  ).length
  const unpackedSuffix =
    unpackedRuntimeDependencyCount > 0
      ? ` and copied ${unpackedRuntimeDependencyCount} unpacked direct runtime package(s)`
      : ''
  console.log(
    `[agent:linux-package] synced ${runtimeSnapshot.dependencyIds.size} pnpm snapshots and ${runtimeSnapshot.directResolutions.length} direct runtime entries${unpackedSuffix}`,
  )
}

async function main() {
  const sourceNodeModulesDir = process.argv[2]
  const targetNodeModulesDir = process.argv[3]

  if (!sourceNodeModulesDir || !targetNodeModulesDir) {
    throw new Error(
      'usage: node scripts/agent/sync-runtime-pnpm-deps.mjs <source-node_modules-dir> <target-node_modules-dir>',
    )
  }

  await syncRuntimeDependencies({
    sourceNodeModulesDir: path.resolve(sourceNodeModulesDir),
    targetNodeModulesDir: path.resolve(targetNodeModulesDir),
  })
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`[agent:linux-package] failed: ${message}`)
  process.exit(1)
})
