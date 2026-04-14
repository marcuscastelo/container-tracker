const EXPLICIT_DISABLE_VALUES = new Set(['1', 'true'])

export type AutomaticUpdateChecksMode = {
  readonly disabled: boolean
  readonly reason: 'EXPLICIT_DISABLE_FLAG' | 'CHANNEL_DISABLED' | null
  readonly configuredChannel: string | null
}

function normalizeOptionalEnv(value: string | null | undefined): string | undefined {
  if (typeof value !== 'string') return undefined
  const normalized = value.trim()
  if (normalized.length === 0) return undefined
  return normalized
}

function isExplicitDisableFlagEnabled(value: string | undefined): boolean {
  const normalized = normalizeOptionalEnv(value)?.toLowerCase()
  if (!normalized) return false
  return EXPLICIT_DISABLE_VALUES.has(normalized)
}

export function resolveAutomaticUpdateChecksMode(command: {
  readonly env: NodeJS.ProcessEnv
  readonly configuredChannel?: string | null
}): AutomaticUpdateChecksMode {
  const configuredChannel =
    normalizeOptionalEnv(
      command.configuredChannel ?? command.env.AGENT_UPDATE_MANIFEST_CHANNEL,
    )?.toLowerCase() ?? null

  if (isExplicitDisableFlagEnabled(command.env.AGENT_DISABLE_AUTOMATIC_UPDATE_CHECKS)) {
    return {
      disabled: true,
      reason: 'EXPLICIT_DISABLE_FLAG',
      configuredChannel,
    }
  }

  if (configuredChannel === 'disabled') {
    return {
      disabled: true,
      reason: 'CHANNEL_DISABLED',
      configuredChannel,
    }
  }

  return {
    disabled: false,
    reason: null,
    configuredChannel,
  }
}
