import type { AgentPathLayout } from '@agent/config/config.contract'
import { verifyReleaseChecksum } from '@agent/release/application/verify-release-checksum'
import { downloadReleaseBundle } from '@agent/release/infrastructure/bundle-downloader'
import {
  type PreparedRelease,
  prepareReleaseDirectory,
} from '@agent/release/infrastructure/bundle-extractor'

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

export async function downloadRelease(command: {
  readonly layout: AgentPathLayout
  readonly version: string
  readonly downloadUrl: string
  readonly expectedChecksum: string
  readonly fetchImpl?: FetchLike
}): Promise<PreparedRelease> {
  const downloaded = await downloadReleaseBundle({
    version: command.version,
    downloadUrl: command.downloadUrl,
    fetchImpl: command.fetchImpl,
  })

  verifyReleaseChecksum({
    version: command.version,
    payload: downloaded.payload,
    expectedChecksum: command.expectedChecksum,
  })

  return prepareReleaseDirectory({
    layout: command.layout,
    version: command.version,
    archiveKind: downloaded.archiveKind,
    payload: downloaded.payload,
  })
}
