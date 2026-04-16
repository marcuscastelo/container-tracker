import type { AgentPathLayout } from '@agent/config/config.contract'
import { markReleaseForActivation } from '@agent/release/application/activate-release'
import { stageRelease } from '@agent/release/application/stage-release'
import { fetchReleaseManifest } from '@agent/release/infrastructure/release-manifest.client'
import {
  readReleaseState,
  writeReleaseState,
} from '@agent/release/infrastructure/release-state.file-repository'

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

export type ReleaseActivityEvent = {
  readonly type:
    | 'UPDATE_CHECKED'
    | 'UPDATE_AVAILABLE'
    | 'UPDATE_DOWNLOAD_STARTED'
    | 'UPDATE_DOWNLOAD_COMPLETED'
    | 'UPDATE_READY'
    | 'UPDATE_APPLY_FAILED'
  readonly message: string
  readonly severity: 'info' | 'warning' | 'danger' | 'success'
  readonly metadata: Record<string, unknown>
  readonly occurred_at: string
}

export type ReleaseCheckResult = {
  readonly shouldDrain: boolean
  readonly drainReason: 'update' | 'restart' | null
  readonly activities: readonly ReleaseActivityEvent[]
  readonly manifestVersion: string
  readonly updateAvailable: boolean
}

export async function runReleaseCheckCycle(command: {
  readonly layout: AgentPathLayout
  readonly fallbackVersion: string
  readonly backendUrl: string
  readonly agentToken: string
  readonly agentId: string
  readonly updateChannel: string
  readonly effectiveBlockedVersions?: readonly string[]
  readonly nowIso?: string
  readonly fetchImpl?: FetchLike
}): Promise<ReleaseCheckResult> {
  const nowIso = command.nowIso ?? new Date().toISOString()
  const activities: ReleaseActivityEvent[] = []
  let shouldDrain = false
  let drainReason: 'update' | 'restart' | null = null

  const releaseState = readReleaseState(command.layout.releaseStatePath, command.fallbackVersion)
  const manifest = await fetchReleaseManifest(
    {
      backendUrl: command.backendUrl,
      agentToken: command.agentToken,
      agentId: command.agentId,
      updateChannelOverride: command.updateChannel,
    },
    command.fetchImpl,
  )

  activities.push({
    type: 'UPDATE_CHECKED',
    message: `Checked update manifest (desired=${manifest.desired_version ?? 'none'})`,
    severity: 'info',
    metadata: {
      version: manifest.version,
      updateAvailable: manifest.update_available,
    },
    occurred_at: nowIso,
  })

  if (manifest.restart_required) {
    shouldDrain = true
    drainReason = 'restart'
  }

  const effectiveReleaseState = {
    ...releaseState,
    blocked_versions: [
      ...new Set([...releaseState.blocked_versions, ...(command.effectiveBlockedVersions ?? [])]),
    ],
  }

  const stagedRelease = await stageRelease({
    manifest,
    layout: command.layout,
    state: effectiveReleaseState,
    fetchImpl: command.fetchImpl,
  })

  if (stagedRelease.kind === 'no_update') {
    return {
      shouldDrain,
      drainReason,
      activities,
      manifestVersion: manifest.version,
      updateAvailable: manifest.update_available,
    }
  }

  if (stagedRelease.kind === 'blocked') {
    writeReleaseState(command.layout.releaseStatePath, {
      ...releaseState,
      activation_state: 'idle',
      automatic_updates_blocked: releaseState.automatic_updates_blocked,
      last_update_attempt: nowIso,
      last_error: stagedRelease.reason,
    })

    activities.push({
      type: 'UPDATE_APPLY_FAILED',
      message: stagedRelease.reason,
      severity: 'danger',
      metadata: {
        version: stagedRelease.manifest.version,
      },
      occurred_at: nowIso,
    })

    return {
      shouldDrain,
      drainReason,
      activities,
      manifestVersion: manifest.version,
      updateAvailable: manifest.update_available,
    }
  }

  activities.push({
    type: 'UPDATE_AVAILABLE',
    message: `Update available: ${stagedRelease.manifest.version}`,
    severity: 'info',
    metadata: {
      version: stagedRelease.manifest.version,
      channel: stagedRelease.manifest.channel,
    },
    occurred_at: nowIso,
  })

  if (stagedRelease.downloaded) {
    activities.push({
      type: 'UPDATE_DOWNLOAD_STARTED',
      message: `Downloading release ${stagedRelease.manifest.version}`,
      severity: 'info',
      metadata: {
        version: stagedRelease.manifest.version,
        url: stagedRelease.manifest.selected_asset?.url ?? null,
      },
      occurred_at: nowIso,
    })
    activities.push({
      type: 'UPDATE_DOWNLOAD_COMPLETED',
      message: `Downloaded release ${stagedRelease.manifest.version}`,
      severity: 'success',
      metadata: {
        version: stagedRelease.manifest.version,
        checksum: stagedRelease.manifest.selected_asset?.checksum ?? null,
      },
      occurred_at: nowIso,
    })
  }

  const nextState = markReleaseForActivation({
    layout: command.layout,
    state: releaseState,
    targetVersion: stagedRelease.manifest.version,
    nowIso,
  })
  writeReleaseState(command.layout.releaseStatePath, nextState)

  shouldDrain = true
  drainReason = 'update'

  activities.push({
    type: 'UPDATE_READY',
    message: `Release ${stagedRelease.manifest.version} staged and pending activation`,
    severity: 'success',
    metadata: {
      version: stagedRelease.manifest.version,
      releaseDir: stagedRelease.releaseDir,
    },
    occurred_at: nowIso,
  })

  return {
    shouldDrain,
    drainReason,
    activities,
    manifestVersion: manifest.version,
    updateAvailable: manifest.update_available,
  }
}
