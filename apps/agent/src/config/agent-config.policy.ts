import os from 'node:os'
import {
  type ParsedAgentConfig,
  type ValidatedAgentConfig,
  ValidatedAgentConfigSchema,
  type ValidatedBootstrapConfig,
  ValidatedBootstrapConfigSchema,
} from '@agent/core/contracts/agent-config.contract'
import { BoundaryValidationError } from '@agent/core/errors/boundary-validation.error'

const PLACEHOLDER_BACKEND_HOST = 'your-backend.example.com'
const PLACEHOLDER_SUPABASE_HOST = 'your-project.supabase.co'
const PLACEHOLDER_TOKEN_FRAGMENT = 'replace-with-'
const PLACEHOLDER_TENANT_ID = '00000000-0000-4000-8000-000000000000'

const DEFAULT_INTERVAL_SEC = 60
const DEFAULT_LIMIT = 10
const DEFAULT_MAERSK_TIMEOUT_MS = 120000
const DEFAULT_UPDATE_CHANNEL = 'stable'

type PolicyOptions = {
  readonly hostname?: string
}

function resolveUrlHost(value: string): string | null {
  try {
    return new URL(value).hostname.toLowerCase()
  } catch {
    return null
  }
}

function containsPlaceholderToken(value: string | null): boolean {
  if (value === null) return false
  return value.toLowerCase().includes(PLACEHOLDER_TOKEN_FRAGMENT)
}

function resolveHostName(options?: PolicyOptions): string {
  const customHostName = options?.hostname?.trim()
  if (customHostName && customHostName.length > 0) {
    return customHostName
  }

  return os.hostname()
}

export function ensureRuntimePlaceholdersAbsent(config: ValidatedAgentConfig): void {
  const placeholders: string[] = []

  if (resolveUrlHost(config.BACKEND_URL) === PLACEHOLDER_BACKEND_HOST) {
    placeholders.push('BACKEND_URL')
  }

  if (
    typeof config.SUPABASE_URL === 'string' &&
    resolveUrlHost(config.SUPABASE_URL) === PLACEHOLDER_SUPABASE_HOST
  ) {
    placeholders.push('SUPABASE_URL')
  }

  if (containsPlaceholderToken(config.AGENT_TOKEN)) {
    placeholders.push('AGENT_TOKEN')
  }

  if (containsPlaceholderToken(config.SUPABASE_ANON_KEY)) {
    placeholders.push('SUPABASE_ANON_KEY')
  }

  if (config.TENANT_ID === PLACEHOLDER_TENANT_ID) {
    placeholders.push('TENANT_ID')
  }

  if (placeholders.length === 0) return

  throw new BoundaryValidationError(
    'Runtime config contains placeholder values',
    placeholders.join(', '),
  )
}

export function ensureBootstrapPlaceholdersAbsent(config: ValidatedBootstrapConfig): void {
  const placeholders: string[] = []

  if (resolveUrlHost(config.BACKEND_URL) === PLACEHOLDER_BACKEND_HOST) {
    placeholders.push('BACKEND_URL')
  }

  if (containsPlaceholderToken(config.INSTALLER_TOKEN)) {
    placeholders.push('INSTALLER_TOKEN')
  }

  if (placeholders.length === 0) return

  throw new BoundaryValidationError(
    'Bootstrap config contains placeholder values',
    placeholders.join(', '),
  )
}

export function resolveEffectiveRuntimeConfig(
  parsed: ParsedAgentConfig,
  options?: PolicyOptions,
): ValidatedAgentConfig {
  const normalized = ValidatedAgentConfigSchema.safeParse({
    BACKEND_URL: parsed.BACKEND_URL,
    SUPABASE_URL: parsed.SUPABASE_URL,
    SUPABASE_ANON_KEY: parsed.SUPABASE_ANON_KEY,
    AGENT_TOKEN: parsed.AGENT_TOKEN,
    TENANT_ID: parsed.TENANT_ID,
    AGENT_ID: parsed.AGENT_ID ?? resolveHostName(options),
    INTERVAL_SEC: parsed.INTERVAL_SEC ?? DEFAULT_INTERVAL_SEC,
    LIMIT: parsed.LIMIT ?? DEFAULT_LIMIT,
    MAERSK_ENABLED: parsed.MAERSK_ENABLED,
    MAERSK_HEADLESS: parsed.MAERSK_HEADLESS,
    MAERSK_TIMEOUT_MS: parsed.MAERSK_TIMEOUT_MS ?? DEFAULT_MAERSK_TIMEOUT_MS,
    MAERSK_USER_DATA_DIR: parsed.MAERSK_USER_DATA_DIR,
    AGENT_UPDATE_MANIFEST_CHANNEL: parsed.AGENT_UPDATE_MANIFEST_CHANNEL ?? DEFAULT_UPDATE_CHANNEL,
  })

  if (!normalized.success) {
    throw new BoundaryValidationError('Invalid runtime agent config', normalized.error.message)
  }

  ensureRuntimePlaceholdersAbsent(normalized.data)
  return normalized.data
}

export function resolveEffectiveBootstrapConfig(
  parsed: ParsedAgentConfig,
  options?: PolicyOptions,
): ValidatedBootstrapConfig {
  const normalized = ValidatedBootstrapConfigSchema.safeParse({
    BACKEND_URL: parsed.BACKEND_URL,
    INSTALLER_TOKEN: parsed.INSTALLER_TOKEN,
    AGENT_ID: parsed.AGENT_ID ?? resolveHostName(options),
    INTERVAL_SEC: parsed.INTERVAL_SEC ?? DEFAULT_INTERVAL_SEC,
    LIMIT: parsed.LIMIT ?? DEFAULT_LIMIT,
    MAERSK_ENABLED: parsed.MAERSK_ENABLED,
    MAERSK_HEADLESS: parsed.MAERSK_HEADLESS,
    MAERSK_TIMEOUT_MS: parsed.MAERSK_TIMEOUT_MS ?? DEFAULT_MAERSK_TIMEOUT_MS,
    MAERSK_USER_DATA_DIR: parsed.MAERSK_USER_DATA_DIR,
    AGENT_UPDATE_MANIFEST_CHANNEL: parsed.AGENT_UPDATE_MANIFEST_CHANNEL ?? DEFAULT_UPDATE_CHANNEL,
  })

  if (!normalized.success) {
    throw new BoundaryValidationError('Invalid bootstrap agent config', normalized.error.message)
  }

  ensureBootstrapPlaceholdersAbsent(normalized.data)
  return normalized.data
}

export function validateAgentConfig(parsed: ParsedAgentConfig): ValidatedAgentConfig {
  return resolveEffectiveRuntimeConfig(parsed)
}

export function parseBootstrapConfig(parsed: ParsedAgentConfig): ValidatedBootstrapConfig {
  return resolveEffectiveBootstrapConfig(parsed)
}
