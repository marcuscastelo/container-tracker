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
  let packageDir = null

  if (await pathExists(topLevelEntryPath)) {
    packageDir = await fs.realpath(topLevelEntryPath)
  } else {
    packageDir = await resolvePackageDirFromPnpmStore(pnpmStoreDir, packageName)
  }

  if (!packageDir) {
    throw new Error(`Missing runtime dependency package: ${packageName}`)
  }

  const depId = extractPnpmDepId(pnpmStoreDir, packageDir)
  if (!depId) {
    throw new Error(`Could not derive pnpm dep id for ${packageName}: ${packageDir}`)
  }

  return {
    packageName,
    depId,
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
  const dependencyIds = new Set()
  const queue = directResolutions.map((resolution) => resolution.depId)

  while (queue.length > 0) {
    const currentDepId = queue.pop()
    if (!currentDepId || visitedDepIds.has(currentDepId)) {
      continue
    }

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
      const remappedTargetPath = remapAbsoluteRuntimeSymlinkTarget({
        sourceNodeModulesDir,
        targetNodeModulesDir,
        resolvedTargetPath,
      })
      if (!remappedTargetPath) {
        throw new Error(
          `Could not remap absolute runtime symlink target: ${entryPath} -> ${rawTargetPath}`,
        )
      }

      if (!(await pathExists(remappedTargetPath))) {
        throw new Error(`Absolute runtime symlink target missing after sync: ${remappedTargetPath}`)
      }

      const targetStats = await fs.lstat(remappedTargetPath)
      const relativeLinkTarget = path.relative(path.dirname(entryPath), remappedTargetPath)
      const symlinkType =
        process.platform === 'win32' ? (targetStats.isDirectory() ? 'junction' : 'file') : undefined

      await fs.rm(entryPath, { recursive: true, force: true })
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

    await fs.mkdir(path.dirname(topLevelEntryPath), { recursive: true })
    await fs.rm(topLevelEntryPath, { recursive: true, force: true })
    const relativeLinkTarget = path.relative(path.dirname(topLevelEntryPath), storePackagePath)
    await fs.symlink(relativeLinkTarget, topLevelEntryPath, symlinkType)
  }

  await normalizeAbsoluteRuntimeSymlinks({
    sourceNodeModulesDir,
    targetNodeModulesDir,
  })

  console.log(
    `[agent:linux-package] synced ${runtimeSnapshot.dependencyIds.size} pnpm snapshots and ${runtimeSnapshot.directResolutions.length} direct runtime links`,
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
