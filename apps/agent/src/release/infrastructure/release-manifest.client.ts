import { resolveAgentPlatformKey, type AgentPlatformKey } from '@agent/platform/platform.adapter'
import { z } from 'zod/v4'

const CHECKSUM_PATTERN = /^[a-f0-9]{64}$/iu

const manifestPlatformAssetSchema = z.object({
  url: z.string().url(),
  checksum: z.string().regex(CHECKSUM_PATTERN),
})

const updateManifestResponseSchema = z.object({
  version: z.string().min(1),
  download_url: z.string().url().nullable().optional(),
  checksum: z.string().regex(CHECKSUM_PATTERN).nullable().optional(),
  platforms: z.record(z.string().min(1), manifestPlatformAssetSchema).optional(),
  channel: z.string().min(1),
  published_at: z.string().datetime({ offset: true }).nullable().optional(),
  update_available: z.boolean(),
  desired_version: z.string().min(1).nullable(),
  current_version: z.string().min(1),
  update_ready_version: z.string().min(1).nullable(),
  restart_required: z.boolean(),
  restart_requested_at: z.string().datetime({ offset: true }).nullable(),
})

type ParsedUpdateManifestResponse = z.infer<typeof updateManifestResponseSchema>

export type UpdateManifestResponse = Omit<
  ParsedUpdateManifestResponse,
  'download_url' | 'checksum'
> & {
  readonly download_url: string | null
  readonly checksum: string | null
}

export type ReleaseManifestFetchCommand = {
  readonly backendUrl: string
  readonly agentToken: string
  readonly agentId: string
  readonly platform?: AgentPlatformKey
  readonly updateChannelOverride?: string
}

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

function buildAuthHeaders(command: ReleaseManifestFetchCommand, includeContentType: boolean): Headers {
  const headers = new Headers()
  headers.set('authorization', `Bearer ${command.agentToken}`)
  headers.set('x-agent-id', command.agentId)
  headers.set('x-agent-platform', command.platform ?? resolveAgentPlatformKey())
  headers.set('user-agent', `container-tracker-agent/${command.agentId}`)
  if (
    typeof command.updateChannelOverride === 'string' &&
    command.updateChannelOverride.length > 0
  ) {
    headers.set('x-agent-update-channel', command.updateChannelOverride)
  }
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

function selectManifestAsset(command: {
  readonly manifest: ParsedUpdateManifestResponse
  readonly platform: AgentPlatformKey
}): {
  readonly downloadUrl: string | null
  readonly checksum: string | null
} {
  const platformAsset = command.manifest.platforms?.[command.platform]
  if (platformAsset) {
    return {
      downloadUrl: platformAsset.url,
      checksum: platformAsset.checksum,
    }
  }

  return {
    downloadUrl: command.manifest.download_url ?? null,
    checksum: command.manifest.checksum ?? null,
  }
}

export async function fetchReleaseManifest(
  command: ReleaseManifestFetchCommand,
  fetchImpl: FetchLike = fetch,
): Promise<UpdateManifestResponse> {
  const platform = command.platform ?? resolveAgentPlatformKey()
  const manifestUrl = `${command.backendUrl}/api/agent/update-manifest`
  console.log(
    `[agent:update] checking manifest url=${manifestUrl} platform=${platform} agent=${command.agentId}`,
  )

  const response = await fetchImpl(manifestUrl, {
    method: 'GET',
    headers: buildAuthHeaders(command, false),
  })

  if (response.status === 204) {
    const status = response.headers.get('x-agent-update-status') ?? 'unknown'
    const channel = response.headers.get('x-agent-update-channel') ?? 'unknown'
    const reason = response.headers.get('x-agent-update-reason') ?? 'unknown'
    console.warn(
      `[agent:update] manifest status=204 (No Content) status=${status} channel=${channel} reason=${reason} platform=${platform}; backend reported manifest_unavailable for this agent/channel`,
    )
    return createNoUpdateManifest('stable')
  }

  if (!response.ok) {
    const details = await response.text().catch(() => '')
    console.error(
      `[agent:update] manifest request failed status=${response.status} platform=${platform}`,
    )
    throw new Error(`update manifest request failed (${response.status}): ${details}`)
  }

  const payload: unknown = await response.json().catch(() => ({}))
  const parsed = updateManifestResponseSchema.safeParse(payload)
  if (!parsed.success) {
    throw new Error(`invalid update manifest payload: ${parsed.error.message}`)
  }

  console.log(
    `[agent:update] manifest status=${response.status} channel=${parsed.data.channel} version=${parsed.data.version} update_available=${parsed.data.update_available} desired=${parsed.data.desired_version ?? 'none'} current=${parsed.data.current_version} update_ready=${parsed.data.update_ready_version ?? 'none'}`,
  )

  const asset = selectManifestAsset({
    manifest: parsed.data,
    platform,
  })

  return {
    ...parsed.data,
    download_url: asset.downloadUrl,
    checksum: asset.checksum,
  }
}
