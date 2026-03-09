import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { z } from 'zod/v4'
// biome-ignore lint/style/noRestrictedImports: Shared updater runtime resolves direct .ts imports in release artifacts.
// biome-ignore lint/performance/noNamespaceImport: Updater core keeps grouped release-manager symbols for stable formatting.
import * as releaseManager from './release-manager.ts'
// biome-ignore lint/style/noRestrictedImports: Shared updater runtime resolves direct .ts imports in release artifacts.
import type { ReleaseState } from './release-state.ts'
// biome-ignore lint/style/noRestrictedImports: Shared updater runtime resolves direct .ts imports in release artifacts.
import { hasBlockedVersion } from './release-state.ts'
// biome-ignore lint/style/noRestrictedImports: Shared updater runtime resolves direct .ts imports in release artifacts.
import type { AgentPathLayout } from './runtime-paths.ts'

const CHECKSUM_PATTERN = /^[a-f0-9]{64}$/iu

const updateManifestResponseSchema = z.object({
  version: z.string().min(1),
  download_url: z.string().url().nullable(),
  checksum: z.string().regex(CHECKSUM_PATTERN).nullable(),
  channel: z.string().min(1),
  published_at: z.string().datetime({ offset: true }).nullable().optional(),
  update_available: z.boolean(),
  desired_version: z.string().min(1).nullable(),
  current_version: z.string().min(1),
  update_ready_version: z.string().min(1).nullable(),
  restart_required: z.boolean(),
  restart_requested_at: z.string().datetime({ offset: true }).nullable(),
})

export type UpdateManifestResponse = z.infer<typeof updateManifestResponseSchema>

export type UpdateFetchCommand = {
  readonly backendUrl: string
  readonly agentToken: string
  readonly agentId: string
}

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

type DownloadedRelease = {
  readonly releaseDir: string
  readonly archivePath: string
  readonly archiveKind: 'javascript' | 'zip' | 'tar' | 'tgz'
}

export type StageReleaseResult =
  | {
      readonly kind: 'no_update'
      readonly manifest: UpdateManifestResponse
    }
  | {
      readonly kind: 'blocked'
      readonly manifest: UpdateManifestResponse
      readonly reason: string
    }
  | {
      readonly kind: 'staged'
      readonly manifest: UpdateManifestResponse
      readonly releaseDir: string
      readonly downloaded: boolean
    }

function inferArchiveKind(downloadUrl: string): DownloadedRelease['archiveKind'] {
  const normalizedPath = new URL(downloadUrl).pathname.toLowerCase()
  if (normalizedPath.endsWith('.js')) {
    return 'javascript'
  }
  if (normalizedPath.endsWith('.zip')) {
    return 'zip'
  }
  if (normalizedPath.endsWith('.tar.gz') || normalizedPath.endsWith('.tgz')) {
    return 'tgz'
  }
  if (normalizedPath.endsWith('.tar')) {
    return 'tar'
  }

  return 'javascript'
}

function buildAuthHeaders(command: UpdateFetchCommand, includeContentType: boolean): Headers {
  const headers = new Headers()
  headers.set('authorization', `Bearer ${command.agentToken}`)
  headers.set('x-agent-id', command.agentId)
  headers.set('user-agent', `container-tracker-agent/${command.agentId}`)
  if (includeContentType) {
    headers.set('content-type', 'application/json')
  }
  return headers
}

function createNoUpdateManifest(channel: string): UpdateManifestResponse {
  return {
    version: '0.0.0',
    download_url: null,
    checksum: null,
    channel,
    published_at: null,
    update_available: false,
    desired_version: null,
    current_version: 'unknown',
    update_ready_version: null,
    restart_required: false,
    restart_requested_at: null,
  }
}

export async function fetchUpdateManifest(
  command: UpdateFetchCommand,
  fetchImpl: FetchLike = fetch,
): Promise<UpdateManifestResponse> {
  const response = await fetchImpl(`${command.backendUrl}/api/agent/update-manifest`, {
    method: 'GET',
    headers: buildAuthHeaders(command, false),
  })

  if (!response.ok) {
    const details = await response.text().catch(() => '')
    throw new Error(`update manifest request failed (${response.status}): ${details}`)
  }

  if (response.status === 204) {
    return createNoUpdateManifest('stable')
  }

  const payload: unknown = await response.json().catch(() => ({}))
  const parsed = updateManifestResponseSchema.safeParse(payload)
  if (!parsed.success) {
    throw new Error(`invalid update manifest payload: ${parsed.error.message}`)
  }

  return parsed.data
}

function computeSha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex')
}

function writeFileAtomic(filePath: string, content: Buffer | string): void {
  const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(tempPath, content)
  fs.renameSync(tempPath, filePath)
}

function extractArchive(command: {
  readonly archiveKind: 'zip' | 'tar' | 'tgz'
  readonly archivePath: string
  readonly destinationDir: string
}): void {
  fs.mkdirSync(command.destinationDir, { recursive: true })

  const run = (program: string, args: readonly string[]): void => {
    const result = spawnSync(program, [...args], {
      stdio: 'ignore',
      shell: false,
    })
    if (result.status !== 0) {
      throw new Error(`${program} exited with code ${result.status ?? 'unknown'}`)
    }
  }

  if (command.archiveKind === 'zip') {
    try {
      run('unzip', ['-oq', command.archivePath, '-d', command.destinationDir])
      return
    } catch {
      run('tar', ['-xf', command.archivePath, '-C', command.destinationDir])
      return
    }
  }

  if (command.archiveKind === 'tgz') {
    run('tar', ['-xzf', command.archivePath, '-C', command.destinationDir])
    return
  }

  run('tar', ['-xf', command.archivePath, '-C', command.destinationDir])
}

function findReleaseDirFromExtractedRoot(extractedRoot: string): string | null {
  const rootEntrypoint = releaseManager.resolveReleaseEntrypoint(extractedRoot)
  if (rootEntrypoint) {
    return extractedRoot
  }

  const entries = fs.readdirSync(extractedRoot, { withFileTypes: true })
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue
    }

    const candidateDir = path.join(extractedRoot, entry.name)
    const candidateEntrypoint = releaseManager.resolveReleaseEntrypoint(candidateDir)
    if (candidateEntrypoint) {
      return candidateDir
    }
  }

  return null
}

function prepareReleaseDirectory(command: {
  readonly layout: AgentPathLayout
  readonly version: string
  readonly archiveKind: DownloadedRelease['archiveKind']
  readonly payload: Buffer
}): DownloadedRelease {
  const sanitizedVersion = releaseManager.sanitizeVersionForPath(command.version)
  const releaseDir = releaseManager.resolveReleaseDir(command.layout.releasesDir, sanitizedVersion)
  const archivePath = path.join(command.layout.downloadsDir, `${sanitizedVersion}.download`)

  if (fs.existsSync(releaseDir) && releaseManager.resolveReleaseEntrypoint(releaseDir)) {
    return {
      releaseDir,
      archivePath,
      archiveKind: command.archiveKind,
    }
  }

  if (command.archiveKind === 'javascript') {
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

  extractArchive({
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

  if (fs.existsSync(releaseDir)) {
    fs.rmSync(stagingDir, { recursive: true, force: true })
    return {
      releaseDir,
      archivePath,
      archiveKind: command.archiveKind,
    }
  }

  fs.renameSync(extractedReleaseDir, releaseDir)
  fs.rmSync(stagingDir, { recursive: true, force: true })

  return {
    releaseDir,
    archivePath,
    archiveKind: command.archiveKind,
  }
}

export async function stageReleaseFromManifest(command: {
  readonly manifest: UpdateManifestResponse
  readonly layout: AgentPathLayout
  readonly state: ReleaseState
  readonly fetchImpl?: FetchLike
}): Promise<StageReleaseResult> {
  if (!command.manifest.update_available) {
    return {
      kind: 'no_update',
      manifest: command.manifest,
    }
  }

  if (command.state.automatic_updates_blocked) {
    return {
      kind: 'blocked',
      manifest: command.manifest,
      reason: 'automatic updates are blocked due to previous crash loop',
    }
  }

  if (hasBlockedVersion(command.state, command.manifest.version)) {
    return {
      kind: 'blocked',
      manifest: command.manifest,
      reason: `version ${command.manifest.version} is blocked locally`,
    }
  }

  if (!command.manifest.download_url || !command.manifest.checksum) {
    throw new Error(
      `update manifest for ${command.manifest.version} is missing download URL or checksum`,
    )
  }

  const releaseDir = releaseManager.resolveReleaseDir(
    command.layout.releasesDir,
    command.manifest.version,
  )
  const existingEntrypoint = releaseManager.resolveReleaseEntrypoint(releaseDir)
  if (existingEntrypoint) {
    return {
      kind: 'staged',
      manifest: command.manifest,
      releaseDir,
      downloaded: false,
    }
  }

  const response = await (command.fetchImpl ?? fetch)(command.manifest.download_url)
  if (!response.ok) {
    const details = await response.text().catch(() => '')
    throw new Error(
      `release download failed for ${command.manifest.version} (${response.status}): ${details}`,
    )
  }

  const payloadBuffer = Buffer.from(await response.arrayBuffer())
  const observedChecksum = computeSha256(payloadBuffer).toLowerCase()
  const expectedChecksum = command.manifest.checksum.toLowerCase()
  if (observedChecksum !== expectedChecksum) {
    throw new Error(
      `checksum mismatch for ${command.manifest.version}: expected ${expectedChecksum}, got ${observedChecksum}`,
    )
  }

  const archiveKind = inferArchiveKind(command.manifest.download_url)
  const downloadedRelease = prepareReleaseDirectory({
    layout: command.layout,
    version: command.manifest.version,
    archiveKind,
    payload: payloadBuffer,
  })

  if (!releaseManager.resolveReleaseEntrypoint(downloadedRelease.releaseDir)) {
    throw new Error(`staged release ${command.manifest.version} has no executable entrypoint`)
  }

  return {
    kind: 'staged',
    manifest: command.manifest,
    releaseDir: downloadedRelease.releaseDir,
    downloaded: true,
  }
}
