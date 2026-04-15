import fs from 'node:fs'
import path from 'node:path'
import { resolvePlatformAdapter } from '@agent/platform/platform.adapter'
import type { AgentPathLayout } from '@agent/runtime-paths'
import { writeFileAtomic } from '@agent/state/file-io'
import {
  removeReleaseDirectoryWhenEntrypointMissing,
  resolveReleaseDir,
  resolveReleaseEntrypoint,
  sanitizeVersionForPath,
} from '@agent/release/application/release-layout'
import type { ReleaseArchiveKind } from '@agent/release/infrastructure/bundle-downloader'

export type PreparedRelease = {
  readonly releaseDir: string
  readonly archivePath: string
  readonly archiveKind: ReleaseArchiveKind
}

function findReleaseDirFromExtractedRoot(extractedRoot: string): string | null {
  const rootEntrypoint = resolveReleaseEntrypoint(extractedRoot)
  if (rootEntrypoint) {
    return extractedRoot
  }

  const entries = fs.readdirSync(extractedRoot, { withFileTypes: true })
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue
    }

    const candidateDir = path.join(extractedRoot, entry.name)
    const candidateEntrypoint = resolveReleaseEntrypoint(candidateDir)
    if (candidateEntrypoint) {
      return candidateDir
    }
  }

  return null
}

export function prepareReleaseDirectory(command: {
  readonly layout: AgentPathLayout
  readonly version: string
  readonly archiveKind: ReleaseArchiveKind
  readonly payload: Buffer
}): PreparedRelease {
  const sanitizedVersion = sanitizeVersionForPath(command.version)
  const releaseDir = resolveReleaseDir(command.layout.releasesDir, sanitizedVersion)
  const archivePath = path.join(command.layout.downloadsDir, `${sanitizedVersion}.download`)

  if (fs.existsSync(releaseDir) && resolveReleaseEntrypoint(releaseDir)) {
    return {
      releaseDir,
      archivePath,
      archiveKind: command.archiveKind,
    }
  }

  if (command.archiveKind === 'javascript') {
    removeReleaseDirectoryWhenEntrypointMissing(releaseDir)
    fs.mkdirSync(releaseDir, { recursive: true })
    writeFileAtomic(path.join(releaseDir, 'agent.js'), command.payload)
    return {
      releaseDir,
      archivePath,
      archiveKind: command.archiveKind,
    }
  }

  writeFileAtomic(archivePath, command.payload)

  const stagingDir = path.join(
    command.layout.releasesDir,
    `.staging-${sanitizedVersion}-${Date.now().toString(36)}`,
  )
  fs.mkdirSync(stagingDir, { recursive: true })

  const platformAdapter = resolvePlatformAdapter()
  platformAdapter.extractBundle({
    archiveKind: command.archiveKind,
    archivePath,
    destinationDir: stagingDir,
  })

  const extractedReleaseDir = findReleaseDirFromExtractedRoot(stagingDir)
  if (!extractedReleaseDir) {
    fs.rmSync(stagingDir, { recursive: true, force: true })
    throw new Error(
      `release archive does not contain a valid entrypoint for version ${command.version}`,
    )
  }

  removeReleaseDirectoryWhenEntrypointMissing(releaseDir)

  fs.renameSync(extractedReleaseDir, releaseDir)
  fs.rmSync(stagingDir, { recursive: true, force: true })

  return {
    releaseDir,
    archivePath,
    archiveKind: command.archiveKind,
  }
}
