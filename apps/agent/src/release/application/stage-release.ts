import type { ReleaseState } from '@agent/core/contracts/release-state.contract'
import type { AgentPathLayout } from '@agent/runtime-paths'
import { hasBlockedVersion } from '@agent/release/domain/release-state'
import type { UpdateManifestResponse } from '@agent/release/infrastructure/release-manifest.client'
import { downloadRelease } from '@agent/release/application/download-release'
import {
  removeReleaseDirectoryIfPresent,
  removeReleaseDirectoryWhenEntrypointMissing,
  resolveReleaseDir,
  resolveReleaseEntrypoint,
} from '@agent/release/application/release-layout'

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

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

export async function stageRelease(command: {
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
      reason: 'automatic updates are disabled by policy',
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

  const releaseDir = resolveReleaseDir(command.layout.releasesDir, command.manifest.version)
  const existingEntrypoint = resolveReleaseEntrypoint(releaseDir)
  if (existingEntrypoint) {
    return {
      kind: 'staged',
      manifest: command.manifest,
      releaseDir,
      downloaded: false,
    }
  }

  removeReleaseDirectoryWhenEntrypointMissing(releaseDir)

  const downloadedRelease = await downloadRelease({
    layout: command.layout,
    version: command.manifest.version,
    downloadUrl: command.manifest.download_url,
    expectedChecksum: command.manifest.checksum,
    fetchImpl: command.fetchImpl,
  })

  if (!resolveReleaseEntrypoint(downloadedRelease.releaseDir)) {
    removeReleaseDirectoryIfPresent(downloadedRelease.releaseDir)
    throw new Error(`staged release ${command.manifest.version} has no executable entrypoint`)
  }

  return {
    kind: 'staged',
    manifest: command.manifest,
    releaseDir: downloadedRelease.releaseDir,
    downloaded: true,
  }
}
