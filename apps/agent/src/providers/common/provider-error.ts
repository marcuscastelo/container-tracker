import type { ProviderRunStatus } from '@agent/core/contracts/provider.contract'

export const PROVIDER_ERROR_CODES = {
  unsupported: 'PROVIDER_UNSUPPORTED',
  blocked: 'PROVIDER_BLOCKED',
  parse: 'PROVIDER_PARSE_ERROR',
  transport: 'PROVIDER_TRANSPORT_ERROR',
  execution: 'PROVIDER_EXECUTION_ERROR',
} as const

export type ProviderErrorCode = (typeof PROVIDER_ERROR_CODES)[keyof typeof PROVIDER_ERROR_CODES]

export type ProviderErrorClassification = {
  readonly status: Exclude<ProviderRunStatus, 'success'>
  readonly code: ProviderErrorCode
  readonly message: string
}

function normalizeMessage(message: string): string {
  return message.trim().toLowerCase()
}

export function isProviderBlockedMessage(message: string): boolean {
  const normalized = normalizeMessage(message)

  return (
    normalized.includes('captcha') ||
    normalized.includes('datadome') ||
    normalized.includes('firewall') ||
    normalized.includes('waf') ||
    normalized.includes('/waf') ||
    normalized.includes(' request rejected') ||
    normalized.includes('bot detected') ||
    normalized.includes('human verification') ||
    normalized.includes('access denied')
  )
}

function isRetryableMessage(message: string): boolean {
  const normalized = normalizeMessage(message)

  return (
    normalized.includes('timeout') ||
    normalized.includes('timed out') ||
    normalized.includes('network') ||
    normalized.includes('econnreset') ||
    normalized.includes('socket hang up') ||
    normalized.includes('503') ||
    normalized.includes('502') ||
    normalized.includes('429')
  )
}

export function classifyProviderException(message: string): ProviderErrorClassification {
  if (isProviderBlockedMessage(message)) {
    return {
      status: 'blocked',
      code: PROVIDER_ERROR_CODES.blocked,
      message,
    }
  }

  if (isRetryableMessage(message)) {
    return {
      status: 'retryable_failure',
      code: PROVIDER_ERROR_CODES.transport,
      message,
    }
  }

  return {
    status: 'retryable_failure',
    code: PROVIDER_ERROR_CODES.execution,
    message,
  }
}

export function classifyProviderParseError(parseError: string): ProviderErrorClassification {
  if (isProviderBlockedMessage(parseError)) {
    return {
      status: 'blocked',
      code: PROVIDER_ERROR_CODES.blocked,
      message: parseError,
    }
  }

  return {
    status: 'terminal_failure',
    code: PROVIDER_ERROR_CODES.parse,
    message: parseError,
  }
}

export function unsupportedProviderError(provider: string): ProviderErrorClassification {
  return {
    status: 'terminal_failure',
    code: PROVIDER_ERROR_CODES.unsupported,
    message: `unsupported provider: ${provider}`,
  }
}
