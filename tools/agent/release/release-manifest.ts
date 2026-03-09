import fs from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod/v4'

// biome-ignore lint/style/noRestrictedImports: Release runtime needs direct relative imports for portable release bundles.
import { type AgentPlatformKey, resolveAgentPlatformKey } from '../platform/platform.adapter.ts'

const CHECKSUM_PATTERN = /^[a-f0-9]{64}$/iu
const DEFAULT_MANIFESTS_DIR = 'agent-manifests'

const manifestAssetSchema = z.object({
  url: z.string().url(),
  checksum: z.string().regex(CHECKSUM_PATTERN),
})

const unifiedManifestSchema = z.object({
  channel: z.string().trim().min(1),
  version: z.string().trim().min(1),
  published_at: z.string().datetime({ offset: true }).nullable().optional(),
  platforms: z.record(z.string().min(1), manifestAssetSchema),
})

const legacyManifestSchema = z.object({
  channel: z.string().trim().min(1),
  version: z.string().trim().min(1),
  published_at: z.string().datetime({ offset: true }).nullable().optional(),
  download_url: z.string().url(),
  checksum: z.string().regex(CHECKSUM_PATTERN),
})

const rawManifestSchema = z.union([unifiedManifestSchema, legacyManifestSchema])

type RawManifest = z.infer<typeof rawManifestSchema>

export type ReleaseManifestAsset = z.infer<typeof manifestAssetSchema>

export type ReleaseManifest = {
  readonly channel: string
  readonly version: string
  readonly publishedAt: string | null
  readonly platforms: Readonly<Record<AgentPlatformKey, ReleaseManifestAsset>>
}

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

function normalizeChannel(channel: string): string {
  const normalized = channel.trim().toLowerCase()
  if (normalized.length === 0) {
    throw new Error('manifest channel cannot be empty')
  }
  return normalized
}

function normalizeManifest(raw: RawManifest): ReleaseManifest {
  if ('platforms' in raw) {
    const linuxAsset = raw.platforms['linux-x64']
    const windowsAsset = raw.platforms['windows-x64']
    if (!linuxAsset || !windowsAsset) {
      throw new Error(
        `manifest ${raw.channel}@${raw.version} must define linux-x64 and windows-x64 assets`,
      )
    }

    return {
      channel: raw.channel,
      version: raw.version,
      publishedAt: raw.published_at ?? null,
      platforms: {
        'linux-x64': linuxAsset,
        'windows-x64': windowsAsset,
      },
    }
  }

  return {
    channel: raw.channel,
    version: raw.version,
    publishedAt: raw.published_at ?? null,
    platforms: {
      'linux-x64': {
        url: raw.download_url,
        checksum: raw.checksum,
      },
      'windows-x64': {
        url: raw.download_url,
        checksum: raw.checksum,
      },
    },
  }
}

async function readManifestFromDisk(channel: string, manifestsDir: string): Promise<unknown> {
  const manifestPath = path.join(manifestsDir, `${normalizeChannel(channel)}.json`)
  const rawContent = await fs.readFile(manifestPath, 'utf8')
  const payload: unknown = JSON.parse(rawContent)
  return payload
}

async function readManifestFromHttp(command: {
  readonly channel: string
  readonly baseUrl: string
  readonly fetchImpl: FetchLike
}): Promise<unknown> {
  const normalizedBase = command.baseUrl.replace(/\/+$/u, '')
  const response = await command.fetchImpl(
    `${normalizedBase}/${normalizeChannel(command.channel)}.json`,
  )
  if (!response.ok) {
    const details = await response.text().catch(() => '')
    throw new Error(
      `manifest fetch failed (${response.status}) for channel "${command.channel}": ${details}`,
    )
  }

  const payload: unknown = await response.json()
  return payload
}

export async function fetchManifest(
  channel: string,
  options?: {
    readonly manifestsDir?: string
    readonly baseUrl?: string
    readonly fetchImpl?: FetchLike
  },
): Promise<ReleaseManifest> {
  const payload =
    options?.baseUrl && options.fetchImpl
      ? await readManifestFromHttp({
          channel,
          baseUrl: options.baseUrl,
          fetchImpl: options.fetchImpl,
        })
      : await readManifestFromDisk(
          channel,
          options?.manifestsDir
            ? path.resolve(options.manifestsDir)
            : path.resolve(process.cwd(), DEFAULT_MANIFESTS_DIR),
        )

  const parsed = rawManifestSchema.safeParse(payload)
  if (!parsed.success) {
    throw new Error(`invalid manifest payload for channel "${channel}": ${parsed.error.message}`)
  }

  return normalizeManifest(parsed.data)
}

export function selectPlatformAsset(command: {
  readonly manifest: ReleaseManifest
  readonly platform?: AgentPlatformKey
}): ReleaseManifestAsset {
  const platform = command.platform ?? resolveAgentPlatformKey()
  const asset = command.manifest.platforms[platform]
  if (!asset) {
    throw new Error(
      `manifest ${command.manifest.channel}@${command.manifest.version} does not provide ${platform}`,
    )
  }

  return asset
}

type ParsedVersion = {
  readonly core: readonly number[]
  readonly prerelease: readonly string[]
}

function parseVersionPart(value: string): number {
  if (!/^[0-9]+$/u.test(value)) {
    throw new Error(`invalid version segment "${value}"`)
  }
  return Number.parseInt(value, 10)
}

function parseVersion(version: string): ParsedVersion {
  const normalized = version.trim().replace(/^v/iu, '')
  if (normalized.length === 0) {
    throw new Error('version cannot be empty')
  }

  const [corePart, prereleasePart = ''] = normalized.split('-', 2)
  const core = corePart.split('.').map(parseVersionPart)
  if (core.length === 0) {
    throw new Error(`invalid version "${version}"`)
  }

  const prerelease = prereleasePart
    .split('.')
    .map((value) => value.trim())
    .filter((value) => value.length > 0)

  return { core, prerelease }
}

function compareIdentifiers(left: string, right: string): number {
  const leftNumeric = /^[0-9]+$/u.test(left)
  const rightNumeric = /^[0-9]+$/u.test(right)

  if (leftNumeric && rightNumeric) {
    const leftValue = Number.parseInt(left, 10)
    const rightValue = Number.parseInt(right, 10)
    if (leftValue === rightValue) {
      return 0
    }
    return leftValue > rightValue ? 1 : -1
  }

  if (leftNumeric && !rightNumeric) {
    return -1
  }

  if (!leftNumeric && rightNumeric) {
    return 1
  }

  if (left === right) {
    return 0
  }

  return left > right ? 1 : -1
}

export function compareVersions(leftVersion: string, rightVersion: string): number {
  const left = parseVersion(leftVersion)
  const right = parseVersion(rightVersion)

  const maxCoreSegments = Math.max(left.core.length, right.core.length)
  for (let index = 0; index < maxCoreSegments; index += 1) {
    const leftValue = left.core[index] ?? 0
    const rightValue = right.core[index] ?? 0
    if (leftValue === rightValue) {
      continue
    }
    return leftValue > rightValue ? 1 : -1
  }

  if (left.prerelease.length === 0 && right.prerelease.length === 0) {
    return 0
  }

  if (left.prerelease.length === 0) {
    return 1
  }

  if (right.prerelease.length === 0) {
    return -1
  }

  const maxPrereleaseSegments = Math.max(left.prerelease.length, right.prerelease.length)
  for (let index = 0; index < maxPrereleaseSegments; index += 1) {
    const leftId = left.prerelease[index]
    const rightId = right.prerelease[index]
    if (!leftId && !rightId) {
      return 0
    }
    if (!leftId) {
      return -1
    }
    if (!rightId) {
      return 1
    }

    const comparison = compareIdentifiers(leftId, rightId)
    if (comparison !== 0) {
      return comparison
    }
  }

  return 0
}
