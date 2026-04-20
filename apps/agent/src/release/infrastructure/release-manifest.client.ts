import {
  type ReleaseManifestAsset,
  UpdateManifestResponseDTOSchema,
} from '@agent/core/contracts/release-manifest.contract'
import { type AgentPlatformKey, resolveAgentPlatformKey } from '@agent/platform/platform.adapter'

export type UpdateManifestResponse = {
  readonly version: string
  readonly channel: string
  readonly published_at: string | null
  readonly platforms: Readonly<Record<string, ReleaseManifestAsset>>
  readonly update_available: boolean
  readonly desired_version: string | null
  readonly current_version: string
  readonly update_ready_version: string | null
  readonly restart_required: boolean
  readonly restart_requested_at: string | null
  readonly selected_platform: AgentPlatformKey
  readonly selected_asset: ReleaseManifestAsset | null
}

export type ReleaseManifestFetchCommand = {
  readonly backendUrl: string
  readonly agentToken: string
  readonly agentId: string
  readonly platform?: AgentPlatformKey
  readonly updateChannelOverride?: string
}

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

function buildAuthHeaders(
  command: ReleaseManifestFetchCommand,
  includeContentType: boolean,
): Headers {
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

function createNoUpdateManifest(command: {
  readonly channel: string
  readonly platform: AgentPlatformKey
}): UpdateManifestResponse {
  return {
    version: '0.0.0',
    channel: command.channel,
    published_at: null,
    platforms: {},
    update_available: false,
    desired_version: null,
    current_version: 'unknown',
    update_ready_version: null,
    restart_required: false,
    restart_requested_at: null,
    selected_platform: command.platform,
    selected_asset: null,
  }
}

function selectManifestAsset(command: {
  readonly manifest: {
    readonly channel: string
    readonly version: string
    readonly platforms: Readonly<Record<string, ReleaseManifestAsset>>
    readonly update_available: boolean
  }
  readonly platform: AgentPlatformKey
}): ReleaseManifestAsset | null {
  const platformAsset = command.manifest.platforms[command.platform]
  if (!command.manifest.update_available) {
    return platformAsset ?? null
  }

  if (!platformAsset) {
    throw new Error(
      `manifest ${command.manifest.channel}@${command.manifest.version} does not provide asset for ${command.platform}`,
    )
  }

  return platformAsset
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
    return createNoUpdateManifest({
      channel: 'stable',
      platform,
    })
  }

  if (!response.ok) {
    const details = await response.text().catch(() => '')
    console.error(
      `[agent:update] manifest request failed status=${response.status} platform=${platform}`,
    )
    throw new Error(`update manifest request failed (${response.status}): ${details}`)
  }

  const payload: unknown = await response.json().catch(() => ({}))
  const parsed = UpdateManifestResponseDTOSchema.safeParse(payload)
  if (!parsed.success) {
    throw new Error(`invalid update manifest payload: ${parsed.error.message}`)
  }

  console.log(
    `[agent:update] manifest status=${response.status} channel=${parsed.data.channel} version=${parsed.data.version} update_available=${parsed.data.update_available} desired=${parsed.data.desired_version ?? 'none'} current=${parsed.data.current_version} update_ready=${parsed.data.update_ready_version ?? 'none'}`,
  )

  return {
    version: parsed.data.version,
    channel: parsed.data.channel,
    published_at: parsed.data.published_at ?? null,
    platforms: parsed.data.platforms,
    update_available: parsed.data.update_available,
    desired_version: parsed.data.desired_version,
    current_version: parsed.data.current_version,
    update_ready_version: parsed.data.update_ready_version,
    restart_required: parsed.data.restart_required,
    restart_requested_at: parsed.data.restart_requested_at,
    selected_platform: platform,
    selected_asset: selectManifestAsset({
      manifest: parsed.data,
      platform,
    }),
  }
}
