import {
  RELEASE_CHECK_INTERVAL_MS,
  type ReleaseChecksMode,
  resolveReleaseChecksMode,
} from '@agent/release/domain/release-policy'

export { RELEASE_CHECK_INTERVAL_MS }

export function resolveSupervisorReleaseChecksMode(command: {
  readonly env: NodeJS.ProcessEnv
  readonly configuredChannel?: string | null
}): ReleaseChecksMode {
  return resolveReleaseChecksMode(command)
}
