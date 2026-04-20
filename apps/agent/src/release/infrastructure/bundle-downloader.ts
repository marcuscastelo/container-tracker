export type ReleaseArchiveKind = 'javascript' | 'zip' | 'tar' | 'tgz'

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

export function inferReleaseArchiveKind(downloadUrl: string): ReleaseArchiveKind {
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

export async function downloadReleaseBundle(command: {
  readonly version: string
  readonly downloadUrl: string
  readonly fetchImpl?: FetchLike
}): Promise<{
  readonly payload: Buffer
  readonly archiveKind: ReleaseArchiveKind
}> {
  const response = await (command.fetchImpl ?? fetch)(command.downloadUrl)
  if (!response.ok) {
    const details = await response.text().catch(() => '')
    throw new Error(
      `release download failed for ${command.version} (${response.status}): ${details}`,
    )
  }

  return {
    payload: Buffer.from(await response.arrayBuffer()),
    archiveKind: inferReleaseArchiveKind(command.downloadUrl),
  }
}
