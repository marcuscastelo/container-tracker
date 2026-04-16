import fs from 'node:fs'
import os from 'node:os'
import {
  type ParsedAgentConfig,
  ParsedAgentConfigSchema,
  type RawAgentEnv,
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

function normalizeOptionalEnv(value: string | undefined): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  if (normalized.length === 0) return null
  return normalized
}

function unquoteValue(value: string): string {
  if (value.length < 2) return value
  const first = value.at(0)
  const last = value.at(-1)
  if (!first || !last) return value

  if ((first === "'" && last === "'") || (first === '"' && last === '"')) {
    return value.slice(1, -1)
  }

  return value
}

function parseEnvLine(line: string): { readonly key: string; readonly value: string } | null {
  const trimmed = line.trim()
  if (trimmed.length === 0 || trimmed.startsWith('#')) return null

  const separatorIndex = trimmed.indexOf('=')
  if (separatorIndex <= 0) return null

  const key = trimmed.slice(0, separatorIndex).trim()
  const value = trimmed.slice(separatorIndex + 1).trim()
  if (key.length === 0) return null

  return {
    key,
    value: unquoteValue(value),
  }
}

function parseEnvContentToMap(raw: string): Map<string, string> {
  const fileValues = new Map<string, string>()
  for (const line of raw.split(/\r?\n/u)) {
    const parsed = parseEnvLine(line)
    if (!parsed) continue
    fileValues.set(parsed.key, parsed.value)
  }

  return fileValues
}

function getRawValue(raw: RawAgentEnv, key: string): string | null {
  return normalizeOptionalEnv(raw.env[key]) ?? normalizeOptionalEnv(raw.fileValues.get(key))
}

function parseBooleanFlag(value: string | null, fallback: boolean): boolean {
  if (value === null) return fallback

  const normalized = value.toLowerCase()
  if (normalized === '1' || normalized === 'true') return true
  if (normalized === '0' || normalized === 'false') return false
  return fallback
}

function parsePositiveInt(value: string | null): number | null {
  if (value === null) return null
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed < 1) {
    return null
  }

  return parsed
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

function ensureRuntimePlaceholdersAbsent(config: ValidatedAgentConfig): void {
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

function ensureBootstrapPlaceholdersAbsent(config: ValidatedBootstrapConfig): void {
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

export function loadRawAgentEnvFromFile(filePath: string): RawAgentEnv | null {
  if (!fs.existsSync(filePath)) {
    return null
  }

  const raw = fs.readFileSync(filePath, 'utf8')
  const fileValues = parseEnvContentToMap(raw)

  return {
    env: process.env,
    fileValues,
    raw,
    sourcePath: filePath,
  }
}

export function readAgentEnvFileValues(filePath: string): Map<string, string> | null {
  if (!fs.existsSync(filePath)) {
    return null
  }

  return parseEnvContentToMap(fs.readFileSync(filePath, 'utf8'))
}

export function parseAgentConfig(raw: RawAgentEnv): ParsedAgentConfig {
  return ParsedAgentConfigSchema.parse({
    BACKEND_URL: getRawValue(raw, 'BACKEND_URL'),
    SUPABASE_URL: getRawValue(raw, 'SUPABASE_URL'),
    SUPABASE_ANON_KEY: getRawValue(raw, 'SUPABASE_ANON_KEY'),
    AGENT_TOKEN: getRawValue(raw, 'AGENT_TOKEN'),
    INSTALLER_TOKEN: getRawValue(raw, 'INSTALLER_TOKEN'),
    TENANT_ID: getRawValue(raw, 'TENANT_ID'),
    AGENT_ID: getRawValue(raw, 'AGENT_ID'),
    INTERVAL_SEC: parsePositiveInt(getRawValue(raw, 'INTERVAL_SEC')),
    LIMIT: parsePositiveInt(getRawValue(raw, 'LIMIT')),
    MAERSK_ENABLED: parseBooleanFlag(getRawValue(raw, 'MAERSK_ENABLED'), false),
    MAERSK_HEADLESS: parseBooleanFlag(getRawValue(raw, 'MAERSK_HEADLESS'), true),
    MAERSK_TIMEOUT_MS: parsePositiveInt(getRawValue(raw, 'MAERSK_TIMEOUT_MS')),
    MAERSK_USER_DATA_DIR: getRawValue(raw, 'MAERSK_USER_DATA_DIR'),
    AGENT_UPDATE_MANIFEST_CHANNEL: getRawValue(raw, 'AGENT_UPDATE_MANIFEST_CHANNEL'),
  })
}

export function validateAgentConfig(parsed: ParsedAgentConfig): ValidatedAgentConfig {
  const normalized = ValidatedAgentConfigSchema.safeParse({
    BACKEND_URL: parsed.BACKEND_URL,
    SUPABASE_URL: parsed.SUPABASE_URL,
    SUPABASE_ANON_KEY: parsed.SUPABASE_ANON_KEY,
    AGENT_TOKEN: parsed.AGENT_TOKEN,
    TENANT_ID: parsed.TENANT_ID,
    AGENT_ID: parsed.AGENT_ID ?? os.hostname(),
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

export function parseBootstrapConfig(parsed: ParsedAgentConfig): ValidatedBootstrapConfig {
  const normalized = ValidatedBootstrapConfigSchema.safeParse({
    BACKEND_URL: parsed.BACKEND_URL,
    INSTALLER_TOKEN: parsed.INSTALLER_TOKEN,
    AGENT_ID: parsed.AGENT_ID ?? os.hostname(),
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

export function serializeAgentConfig(config: ValidatedAgentConfig): string {
  const lines = [
    '# Generated by runtime enrollment',
    `BACKEND_URL=${config.BACKEND_URL}`,
    `TENANT_ID=${config.TENANT_ID}`,
    `AGENT_TOKEN=${config.AGENT_TOKEN}`,
    `AGENT_ID=${config.AGENT_ID}`,
    `INTERVAL_SEC=${config.INTERVAL_SEC}`,
    `LIMIT=${config.LIMIT}`,
    `MAERSK_ENABLED=${config.MAERSK_ENABLED ? 'true' : 'false'}`,
    `MAERSK_HEADLESS=${config.MAERSK_HEADLESS ? 'true' : 'false'}`,
    `MAERSK_TIMEOUT_MS=${config.MAERSK_TIMEOUT_MS}`,
    `MAERSK_USER_DATA_DIR=${config.MAERSK_USER_DATA_DIR ?? ''}`,
    `AGENT_UPDATE_MANIFEST_CHANNEL=${config.AGENT_UPDATE_MANIFEST_CHANNEL}`,
  ]

  if (config.SUPABASE_URL) {
    lines.push(`SUPABASE_URL=${config.SUPABASE_URL}`)
  }

  if (config.SUPABASE_ANON_KEY) {
    lines.push(`SUPABASE_ANON_KEY=${config.SUPABASE_ANON_KEY}`)
  }

  return `${lines.join('\n')}\n`
}

export function serializeBootstrapConfig(command: {
  readonly config: ValidatedBootstrapConfig
  readonly redactInstallerToken: boolean
}): string {
  const token = command.redactInstallerToken ? '[REDACTED]' : command.config.INSTALLER_TOKEN

  return [
    '# Bootstrap consumed by runtime enrollment',
    `BACKEND_URL=${command.config.BACKEND_URL}`,
    `INSTALLER_TOKEN=${token}`,
    `AGENT_ID=${command.config.AGENT_ID}`,
    `INTERVAL_SEC=${command.config.INTERVAL_SEC}`,
    `LIMIT=${command.config.LIMIT}`,
    `MAERSK_ENABLED=${command.config.MAERSK_ENABLED ? 'true' : 'false'}`,
    `MAERSK_HEADLESS=${command.config.MAERSK_HEADLESS ? 'true' : 'false'}`,
    `MAERSK_TIMEOUT_MS=${command.config.MAERSK_TIMEOUT_MS}`,
    `MAERSK_USER_DATA_DIR=${command.config.MAERSK_USER_DATA_DIR ?? ''}`,
    `AGENT_UPDATE_MANIFEST_CHANNEL=${command.config.AGENT_UPDATE_MANIFEST_CHANNEL}`,
    '',
  ].join('\n')
}
