import fs from 'node:fs'
import path from 'node:path'
import type { AgentPathLayout } from '@agent/config/config.contract'
import type { ResolvedActiveRelease } from '@agent/core/contracts/release-runtime-handoff.contract'
import type { ReleaseState } from '@agent/core/contracts/release-state.contract'
import { resolvePlatformAdapter } from '@agent/platform/platform.adapter'

const RELEASE_ENTRYPOINT_CANDIDATES = [
  path.join('dist', 'apps', 'agent', 'src', 'agent.js'),
  path.join('app', 'dist', 'apps', 'agent', 'src', 'agent.js'),
  path.join('dist', 'agent.js'),
  path.join('app', 'dist', 'agent.js'),
  'agent.js',
] as const

const SUPERVISOR_SHIM_IMPORT_PATTERN =
  /^\s*import\s+['"]\.\/apps\/agent\/src\/supervisor\.js['"];?\s*$/mu

export function sanitizeVersionForPath(version: string): string {
  const trimmed = version.trim()
  if (trimmed.length === 0) {
    throw new Error('release version cannot be empty')
  }

  return trimmed.replace(/[^a-zA-Z0-9._-]/gu, '_')
}

export function resolveReleaseDir(releasesDir: string, version: string): string {
  return path.join(releasesDir, sanitizeVersionForPath(version))
}

function pathExists(targetPath: string): boolean {
  try {
    fs.lstatSync(targetPath)
    return true
  } catch {
    return false
  }
}

function removePathIfExists(targetPath: string): void {
  if (!pathExists(targetPath)) {
    return
  }

  fs.rmSync(targetPath, { recursive: true, force: true })
}

function safeRealpath(targetPath: string): string | null {
  return resolvePlatformAdapter().readSymlinkOrPointer({ pointerPath: targetPath })
}

function basenameFromPath(targetPath: string | null): string | null {
  if (!targetPath) {
    return null
  }

  const base = path.basename(targetPath)
  return base.length > 0 ? base : null
}

function normalizePathForComparison(targetPath: string): string {
  const normalized = path.resolve(targetPath).replaceAll('\\', '/')
  return resolvePlatformAdapter().key === 'windows-x64' ? normalized.toLowerCase() : normalized
}

function arePathsEqual(leftPath: string, rightPath: string): boolean {
  return normalizePathForComparison(leftPath) === normalizePathForComparison(rightPath)
}

function isPathWithinDirectory(directoryPath: string, candidatePath: string): boolean {
  const normalizedDirectory = normalizePathForComparison(directoryPath)
  const normalizedCandidate = normalizePathForComparison(candidatePath)
  const relativePath = path.relative(normalizedDirectory, normalizedCandidate)

  if (relativePath.length === 0) {
    return true
  }

  return !relativePath.startsWith('..') && !path.isAbsolute(relativePath)
}

function removeInvalidCurrentRelease(layout: AgentPathLayout, linkedReleasePath: string): void {
  removePathIfExists(layout.currentPath)

  const previousLinkedReleasePath = safeRealpath(layout.previousPath)
  if (previousLinkedReleasePath && arePathsEqual(previousLinkedReleasePath, linkedReleasePath)) {
    removePathIfExists(layout.previousPath)
  }

  if (isPathWithinDirectory(layout.releasesDir, linkedReleasePath)) {
    removePathIfExists(linkedReleasePath)
  }
}

function isSupervisorShimEntrypoint(entrypointPath: string): boolean {
  if (path.basename(entrypointPath).toLowerCase() !== 'agent.js') {
    return false
  }

  try {
    const content = fs.readFileSync(entrypointPath, 'utf8')
    return SUPERVISOR_SHIM_IMPORT_PATTERN.test(content)
  } catch {
    return false
  }
}

export function resolveReleaseEntrypoint(releaseDir: string): string | null {
  for (const candidate of RELEASE_ENTRYPOINT_CANDIDATES) {
    const fullPath = path.join(releaseDir, candidate)
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
      if (isSupervisorShimEntrypoint(fullPath)) {
        continue
      }

      return fullPath
    }
  }

  return null
}

export function resolveActiveRelease(command: {
  readonly layout: AgentPathLayout
  readonly fallbackEntrypoint: string
  readonly expectedVersion: string
}): ResolvedActiveRelease {
  const linkedReleasePath = safeRealpath(command.layout.currentPath)
  if (linkedReleasePath) {
    const releaseEntrypoint = resolveReleaseEntrypoint(linkedReleasePath)
    if (releaseEntrypoint) {
      const linkedVersion = basenameFromPath(linkedReleasePath) ?? command.expectedVersion
      return {
        version: linkedVersion,
        entrypointPath: releaseEntrypoint,
        source: 'release',
      }
    }

    removeInvalidCurrentRelease(command.layout, linkedReleasePath)
  }

  return {
    version: command.expectedVersion,
    entrypointPath: command.fallbackEntrypoint,
    source: 'fallback',
  }
}

export function ensureReleaseLinksForCurrentState(command: {
  readonly layout: AgentPathLayout
  readonly state: ReleaseState
}): void {
  const platformAdapter = resolvePlatformAdapter()
  const currentDir = resolveReleaseDir(command.layout.releasesDir, command.state.current_version)
  if (!pathExists(currentDir)) {
    return
  }

  const previousDir = command.state.previous_version
    ? resolveReleaseDir(command.layout.releasesDir, command.state.previous_version)
    : null
  const previousTargetPath = previousDir && pathExists(previousDir) ? previousDir : null
  const currentRealPath = safeRealpath(command.layout.currentPath)
  const previousRealPath = safeRealpath(command.layout.previousPath)
  const currentOk = currentRealPath !== null && arePathsEqual(currentRealPath, currentDir)
  const previousOk =
    (previousTargetPath === null && previousRealPath === null) ||
    (previousTargetPath !== null &&
      previousRealPath !== null &&
      arePathsEqual(previousRealPath, previousTargetPath))

  if (!currentOk || !previousOk) {
    platformAdapter.switchCurrentRelease({
      currentPath: command.layout.currentPath,
      previousPath: command.layout.previousPath,
      targetPath: currentDir,
      previousTargetPath,
    })
  }
}

export function removeReleaseDirectoryIfPresent(releaseDir: string): void {
  if (!fs.existsSync(releaseDir)) {
    return
  }

  fs.rmSync(releaseDir, { recursive: true, force: true })
}

export function removeReleaseDirectoryWhenEntrypointMissing(releaseDir: string): boolean {
  if (!fs.existsSync(releaseDir)) {
    return false
  }

  if (resolveReleaseEntrypoint(releaseDir)) {
    return false
  }

  console.warn(`[agent:update] removing release without executable entrypoint: ${releaseDir}`)
  removeReleaseDirectoryIfPresent(releaseDir)
  return true
}
