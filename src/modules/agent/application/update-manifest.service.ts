import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod/v4'
import type {
  AgentMonitoringRecord,
  AgentMonitoringRepository,
} from '~/modules/agent/application/agent-monitoring.repository'
// biome-ignore lint/style/noRestrictedImports: Release manager is executed from Node runtime with direct .ts imports.
import bundledCanaryManifest from '../../../../agent-manifests/canary.json'
// biome-ignore lint/style/noRestrictedImports: Release manager is executed from Node runtime with direct .ts imports.
import bundledDevManifest from '../../../../agent-manifests/dev.json'
// biome-ignore lint/style/noRestrictedImports: Release manager is executed from Node runtime with direct .ts imports.
import bundledStableManifest from '../../../../agent-manifests/stable.json'

const DEFAULT_CHANNEL = 'stable'
const DEFAULT_PLATFORM = 'linux-x64'
const DEFAULT_CACHE_TTL_MS = 60_000
const CHECKSUM_PATTERN = /^[a-f0-9]{64}$/iu
const PLACEHOLDER_VERSION = '0.0.0'

const manifestPlatformAssetSchema = z.object({
  url: z.string().url(),
  checksum: z.string().regex(CHECKSUM_PATTERN),
})

const agentManifestUnifiedFileSchema = z.object({
  channel: z.string().trim().min(1),
  version: z.string().trim().min(1),
  platforms: z.record(z.string().min(1), manifestPlatformAssetSchema),
  published_at: z.string().datetime({ offset: true }).nullable().optional(),
})

const agentManifestLegacyFileSchema = z.object({
  channel: z.string().trim().min(1),
  version: z.string().trim().min(1),
  download_url: z.string().url(),
  checksum: z.string().regex(CHECKSUM_PATTERN),
  published_at: z.string().datetime({ offset: true }).nullable().optional(),
})

const agentManifestFileSchema = z.union([
  agentManifestUnifiedFileSchema,
  agentManifestLegacyFileSchema,
])

const agentPlatformSchema = z.enum(['linux-x64', 'windows-x64'])
const DEFAULT_MANIFESTS_DIR = 'agent-manifests'

type AgentManifestFile = z.infer<typeof agentManifestFileSchema>
type AgentPlatform = z.infer<typeof agentPlatformSchema>

type CachedManifest = {
  readonly expiresAtMs: number
  readonly manifest: AgentManifestFile | null
}

type AgentUpdateManifestResolved = {
  readonly version: string
  readonly downloadUrl: string
  readonly checksum: string
  readonly channel: string
  readonly publishedAt: string | null
  readonly updateAvailable: boolean
  readonly desiredVersion: string | null
  readonly currentVersion: string
  readonly updateReadyVersion: string | null
  readonly restartRequired: boolean
  readonly restartRequestedAt: string | null
}

export type ResolveAgentUpdateManifestResult =
  | {
      readonly kind: 'agent_not_found'
    }
  | {
      readonly kind: 'manifest_unavailable'
      readonly channel: string
      readonly reason: 'manifest_missing' | 'platform_asset_missing'
    }
  | {
      readonly kind: 'resolved'
      readonly manifest: AgentUpdateManifestResolved
    }

export type AgentUpdateManifestService = ReturnType<typeof createAgentUpdateManifestService>

const BUNDLED_MANIFEST_BY_CHANNEL: Readonly<Record<string, unknown>> = {
  stable: bundledStableManifest,
  canary: bundledCanaryManifest,
  dev: bundledDevManifest,
}

function parseIsoDate(value: string | null): Date | null {
  if (value === null) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}

function normalizeOptionalNonBlank(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  if (normalized.length === 0) return null
  return normalized
}

function normalizeChannel(value: string | null | undefined): string {
  return normalizeOptionalNonBlank(value)?.toLowerCase() ?? DEFAULT_CHANNEL
}

function normalizePlatform(value: string | null | undefined): AgentPlatform {
  const normalized = normalizeOptionalNonBlank(value)?.toLowerCase() ?? DEFAULT_PLATFORM
  const parsed = agentPlatformSchema.safeParse(normalized)
  if (!parsed.success) {
    return DEFAULT_PLATFORM
  }
  return parsed.data
}

function isRestartRequired(record: AgentMonitoringRecord): boolean {
  if (!record.restartRequestedAt) return false

  const requestedAtMs = parseIsoDate(record.restartRequestedAt)?.getTime() ?? null
  if (requestedAtMs === null) {
    return false
  }

  const lastSeenMs = parseIsoDate(record.lastSeenAt)?.getTime() ?? null
  if (lastSeenMs === null) {
    return true
  }

  return lastSeenMs <= requestedAtMs
}

function resolveEffectiveDesiredVersion(record: AgentMonitoringRecord): string | null {
  const desiredVersion = normalizeOptionalNonBlank(record.desiredVersion)
  if (desiredVersion === null) {
    return null
  }

  return desiredVersion === record.currentVersion ? null : desiredVersion
}

function resolveManifestUpdateAvailability(command: {
  readonly manifestVersion: string
  readonly currentVersion: string
  readonly desiredVersion: string | null
}): boolean {
  if (command.manifestVersion === PLACEHOLDER_VERSION) {
    return false
  }

  if (command.desiredVersion !== null) {
    return (
      command.manifestVersion === command.desiredVersion &&
      command.manifestVersion !== command.currentVersion
    )
  }

  return command.manifestVersion !== command.currentVersion
}

function resolveManifestAsset(command: {
  readonly manifest: AgentManifestFile
  readonly platform: AgentPlatform
}): {
  readonly downloadUrl: string
  readonly checksum: string
} | null {
  if ('platforms' in command.manifest) {
    const requestedAsset = command.manifest.platforms[command.platform]
    if (requestedAsset) {
      return {
        downloadUrl: requestedAsset.url,
        checksum: requestedAsset.checksum,
      }
    }

    const fallbackAsset = command.manifest.platforms[DEFAULT_PLATFORM]
    if (fallbackAsset) {
      return {
        downloadUrl: fallbackAsset.url,
        checksum: fallbackAsset.checksum,
      }
    }

    return null
  }

  return {
    downloadUrl: command.manifest.download_url,
    checksum: command.manifest.checksum,
  }
}

function resolveManifestsDir(dirFromEnv: string | undefined): string {
  const normalized = normalizeOptionalNonBlank(dirFromEnv)
  if (!normalized) {
    return path.resolve(process.cwd(), DEFAULT_MANIFESTS_DIR)
  }

  if (path.isAbsolute(normalized)) {
    return normalized
  }

  return path.resolve(process.cwd(), normalized)
}

function appendUniquePath(paths: string[], candidate: string): void {
  if (paths.includes(candidate)) {
    return
  }

  paths.push(candidate)
}

function resolveManifestsDirCandidates(dirFromEnv: string | undefined): readonly string[] {
  const configuredDir = normalizeOptionalNonBlank(dirFromEnv) ?? DEFAULT_MANIFESTS_DIR

  if (path.isAbsolute(configuredDir)) {
    return [configuredDir]
  }

  const candidates: string[] = [resolveManifestsDir(configuredDir)]
  const moduleDir = path.dirname(fileURLToPath(import.meta.url))

  let current = moduleDir
  for (;;) {
    appendUniquePath(candidates, path.resolve(current, configuredDir))
    const parent = path.dirname(current)
    if (parent === current) {
      break
    }
    current = parent
  }

  return candidates
}

function readBundledManifest(channel: string): AgentManifestFile | null {
  const rawManifest = BUNDLED_MANIFEST_BY_CHANNEL[channel]
  if (rawManifest === undefined) {
    return null
  }

  const parsedManifest = agentManifestFileSchema.safeParse(rawManifest)
  if (!parsedManifest.success) {
    return null
  }

  return parsedManifest.data
}

export function createAgentUpdateManifestService(deps: {
  readonly repository: Pick<AgentMonitoringRepository, 'getAgentDetailForTenant'>
  readonly manifestsDir?: string
  readonly cacheTtlMs?: number
  readonly now?: () => Date
}) {
  const normalizedManifestsDir = normalizeOptionalNonBlank(deps.manifestsDir)
  const useBundledManifests =
    normalizedManifestsDir === null || normalizedManifestsDir === DEFAULT_MANIFESTS_DIR
  const manifestsDirCandidates = useBundledManifests
    ? []
    : resolveManifestsDirCandidates(normalizedManifestsDir)
  const cacheTtlMs = deps.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS
  const now = deps.now ?? (() => new Date())
  const cacheByChannel = new Map<string, CachedManifest>()

  async function readManifestFromDisk(channel: string): Promise<AgentManifestFile | null> {
    for (const manifestsDir of manifestsDirCandidates) {
      const manifestPath = path.join(manifestsDir, `${channel}.json`)
      let rawManifest = ''

      try {
        rawManifest = await fs.readFile(manifestPath, 'utf8')
      } catch (error) {
        if (
          typeof error === 'object' &&
          error !== null &&
          'code' in error &&
          error.code === 'ENOENT'
        ) {
          continue
        }

        continue
      }

      try {
        const parsedJson: unknown = JSON.parse(rawManifest)
        const parsedManifest = agentManifestFileSchema.safeParse(parsedJson)
        if (!parsedManifest.success) {
          continue
        }

        return parsedManifest.data
      } catch {}
    }

    return null
  }

  async function loadManifestForChannel(channel: string): Promise<AgentManifestFile | null> {
    const nowMs = now().getTime()
    const cached = cacheByChannel.get(channel)
    if (cached && cached.expiresAtMs > nowMs) {
      return cached.manifest
    }

    const bundledManifest = useBundledManifests ? readBundledManifest(channel) : null
    const manifest = bundledManifest ?? (await readManifestFromDisk(channel))
    cacheByChannel.set(channel, {
      manifest,
      expiresAtMs: nowMs + cacheTtlMs,
    })

    return manifest
  }

  async function loadManifestWithFallback(channel: string): Promise<AgentManifestFile | null> {
    const fromRequestedChannel = await loadManifestForChannel(channel)
    if (fromRequestedChannel) {
      return fromRequestedChannel
    }

    if (channel === DEFAULT_CHANNEL) {
      return null
    }

    return loadManifestForChannel(DEFAULT_CHANNEL)
  }

  async function resolveForAgent(command: {
    readonly tenantId: string
    readonly agentId: string
    readonly platform?: string
  }): Promise<ResolveAgentUpdateManifestResult> {
    const record = await deps.repository.getAgentDetailForTenant({
      tenantId: command.tenantId,
      agentId: command.agentId,
    })

    if (!record) {
      return {
        kind: 'agent_not_found',
      }
    }

    const requestedChannel = normalizeChannel(record.updateChannel)
    const requestedPlatform = normalizePlatform(command.platform)
    const manifest = await loadManifestWithFallback(requestedChannel)
    if (!manifest) {
      return {
        kind: 'manifest_unavailable',
        channel: requestedChannel,
        reason: 'manifest_missing',
      }
    }

    const manifestAsset = resolveManifestAsset({
      manifest,
      platform: requestedPlatform,
    })
    if (!manifestAsset) {
      return {
        kind: 'manifest_unavailable',
        channel: requestedChannel,
        reason: 'platform_asset_missing',
      }
    }

    const desiredVersion = resolveEffectiveDesiredVersion(record)
    const currentVersion = normalizeOptionalNonBlank(record.currentVersion) ?? 'unknown'
    const updateAvailable = resolveManifestUpdateAvailability({
      manifestVersion: manifest.version,
      currentVersion,
      desiredVersion,
    })

    return {
      kind: 'resolved',
      manifest: {
        version: manifest.version,
        downloadUrl: manifestAsset.downloadUrl,
        checksum: manifestAsset.checksum,
        channel: manifest.channel,
        publishedAt: manifest.published_at ?? null,
        updateAvailable,
        desiredVersion,
        currentVersion,
        updateReadyVersion: normalizeOptionalNonBlank(record.updateReadyVersion),
        restartRequired: isRestartRequired(record),
        restartRequestedAt: record.restartRequestedAt,
      },
    }
  }

  return {
    resolveForAgent,
  }
}
