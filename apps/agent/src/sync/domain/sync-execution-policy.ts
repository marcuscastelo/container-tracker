import type { ProviderRunResult } from '@agent/core/contracts/provider.contract'

export function shouldIngestProviderResult(result: ProviderRunResult): boolean {
  if (result.status === 'success') {
    return true
  }

  if (result.status === 'terminal_failure' && result.raw !== null) {
    return true
  }

  return false
}

export function shouldReportFailure(result: ProviderRunResult): boolean {
  return result.status !== 'success'
}

export function resolveFailureMessage(result: ProviderRunResult): string {
  return result.errorMessage ?? 'provider execution failed'
}

export function resolveFailureSnapshotId(result: {
  readonly ingestSnapshotId?: string
}): string | null {
  return result.ingestSnapshotId ?? null
}
