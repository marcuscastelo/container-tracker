import { createHash } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

import { createClient } from '@supabase/supabase-js'
import {
  acknowledgeRemoteCommand,
  applyRemoteCommand,
  type ControlRuntimeConfig,
  syncAgentControlState,
} from '@tools/agent/control-core/agent-control-core'
import { publishAgentControlPublicSnapshot } from '@tools/agent/control-core/public-control-files'
import { z } from 'zod/v4'
// biome-ignore lint/style/noRestrictedImports: Agent runtime uses Node --experimental-strip-types with direct .ts imports.
import { fetchCmaCgmStatus } from '../../src/modules/tracking/infrastructure/carriers/fetchers/cmacgm.fetcher.ts'
// biome-ignore lint/style/noRestrictedImports: Agent runtime uses Node --experimental-strip-types with direct .ts imports.
import { createMaerskCaptureService } from '../../src/modules/tracking/infrastructure/carriers/fetchers/maersk.puppeteer.fetcher.ts'
// biome-ignore lint/style/noRestrictedImports: Agent runtime uses Node --experimental-strip-types with direct .ts imports.
import { fetchMscStatus } from '../../src/modules/tracking/infrastructure/carriers/fetchers/msc.fetcher.ts'
// biome-ignore lint/style/noRestrictedImports: Agent runtime uses Node --experimental-strip-types with direct .ts imports.
import { fetchOneStatus } from '../../src/modules/tracking/infrastructure/carriers/fetchers/one.fetcher.ts'
// biome-ignore lint/style/noRestrictedImports: Agent runtime uses Node --experimental-strip-types with direct .ts imports.
import { fetchPilStatus } from '../../src/modules/tracking/infrastructure/carriers/fetchers/pil.fetcher.ts'
// biome-ignore lint/style/noRestrictedImports: Agent runtime uses Node --experimental-strip-types with direct .ts imports.
import type { SyncRequestsRealtimeStatusUpdate } from '../../src/shared/supabase/sync-requests.realtime.ts'
// biome-ignore lint/style/noRestrictedImports: Agent runtime uses Node --experimental-strip-types with direct .ts imports.
import { subscribeSyncRequestsByTenant } from '../../src/shared/supabase/sync-requests.realtime.ts'
// biome-ignore lint/style/noRestrictedImports: Agent runtime uses Node --experimental-strip-types with direct .ts imports.
import { type AgentRunReason, createAgentScheduler } from './agent.scheduler.ts'
// biome-ignore lint/style/noRestrictedImports: Agent runtime uses Node --experimental-strip-types with direct .ts imports.
import { computeBackoffDelayMs } from './backoff.ts'
// biome-ignore lint/style/noRestrictedImports: Agent runtime uses Node --experimental-strip-types with direct .ts imports.
import { createAgentLogForwarder } from './log-forwarder.ts'
// biome-ignore lint/style/noRestrictedImports: Agent runtime uses Node --experimental-strip-types with direct .ts imports.
import { drainPendingActivityEvents } from './pending-activity.ts'
// biome-ignore lint/style/noRestrictedImports: Agent runtime uses Node --experimental-strip-types with direct .ts imports.
import { resolveAgentPlatformKey } from './platform/platform.adapter.ts'
// biome-ignore lint/style/noRestrictedImports: Agent runtime uses Node --experimental-strip-types with direct .ts imports.
import { readReleaseState, writeReleaseState } from './release-state.ts'
// biome-ignore lint/style/noRestrictedImports: Agent runtime uses Node --experimental-strip-types with direct .ts imports.
import { EXIT_FATAL, EXIT_UPDATE_RESTART } from './runtime/lifecycle-exit-codes.ts'
// biome-ignore lint/style/noRestrictedImports: Agent runtime keeps Linux public-state path resolution local to runtime helpers.
import { resolveAgentPublicBackendStatePath, resolveAgentPublicStatePath } from './runtime/paths.ts'
// biome-ignore lint/style/noRestrictedImports: Agent runtime uses Node --experimental-strip-types with direct .ts imports.
import { writeRuntimeHealth } from './runtime-health.ts'
// biome-ignore lint/style/noRestrictedImports: Agent runtime uses Node --experimental-strip-types with direct .ts imports.
import type { AgentPathLayout } from './runtime-paths.ts'
// biome-ignore lint/style/noRestrictedImports: Agent runtime uses Node --experimental-strip-types with direct .ts imports.
// biome-ignore lint/performance/noNamespaceImport: Runtime keeps grouped imports stable to avoid formatter wrapping regressions.
import * as runtimePaths from './runtime-paths.ts'
// biome-ignore lint/style/noRestrictedImports: Agent runtime uses Node --experimental-strip-types with direct .ts imports.
// biome-ignore lint/performance/noNamespaceImport: Runtime keeps grouped imports stable to avoid formatter wrapping regressions.
import * as supervisorControl from './supervisor-control.ts'
// biome-ignore lint/style/noRestrictedImports: Agent runtime uses Node --experimental-strip-types with direct .ts imports.
import { resolveAutomaticUpdateChecksMode } from './update-checks.ts'
// biome-ignore lint/style/noRestrictedImports: Agent runtime uses Node --experimental-strip-types with direct .ts imports.
import { fetchUpdateManifest, stageReleaseFromManifest } from './updater.core.ts'

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

function normalizeOptionalEnv(value: string | undefined): string | undefined {
  if (typeof value !== 'string') return undefined
  const normalized = value.trim()
  if (normalized.length === 0) return undefined
  return normalized
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  if (normalized.length === 0) return null
  return normalized
}

function parseBooleanFlag(value: string | undefined, fallback: boolean): boolean {
  const normalized = normalizeOptionalEnv(value)?.toLowerCase()
  if (!normalized) return fallback

  if (normalized === '1' || normalized === 'true') return true
  if (normalized === '0' || normalized === 'false') return false
  return fallback
}

function sanitizeText(value: string, secrets: readonly string[]): string {
  let sanitized = value
  for (const secret of secrets) {
    if (secret.length === 0) continue
    sanitized = sanitized.split(secret).join('[REDACTED]')
  }
  return sanitized
}

function hasCauseProperty(value: unknown): value is { readonly cause: unknown } {
  return typeof value === 'object' && value !== null && 'cause' in value
}

function toUnknownMessage(value: unknown): string {
  if (value instanceof Error) {
    return value.message
  }

  if (typeof value === 'string') {
    return value
  }

  try {
    const json = JSON.stringify(value)
    if (typeof json === 'string' && json.length > 0) {
      return json
    }
  } catch {
    // fall back to String(value)
  }

  return String(value)
}

function toErrorMessage(error: unknown, secrets: readonly string[] = []): string {
  if (error instanceof Error) {
    const message = sanitizeText(error.message, secrets)
    if (!hasCauseProperty(error) || typeof error.cause === 'undefined') {
      return message
    }

    const causeMessage = sanitizeText(toUnknownMessage(error.cause), secrets)
    if (causeMessage.length === 0 || causeMessage === message) {
      return message
    }

    return `${message} (cause: ${causeMessage})`
  }

  return sanitizeText(String(error), secrets)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function loadEnvFile(filePath: string): {
  readonly values: Map<string, string>
  readonly raw: string
} {
  const raw = fs.readFileSync(filePath, 'utf8')
  const values = new Map<string, string>()

  for (const line of raw.split(/\r?\n/u)) {
    const parsed = parseEnvLine(line)
    if (!parsed) continue
    values.set(parsed.key, parsed.value)
  }

  return {
    values,
    raw,
  }
}

function getEnvValue(key: string, fromFile: ReadonlyMap<string, string>): string | undefined {
  return normalizeOptionalEnv(process.env[key]) ?? normalizeOptionalEnv(fromFile.get(key))
}

const runtimeConfigSchema = z.object({
  BACKEND_URL: z
    .string()
    .url()
    .transform((value) => value.replace(/\/+$/u, '')),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_ANON_KEY: z.string().min(1).optional(),
  AGENT_TOKEN: z.string().min(1),
  TENANT_ID: z.string().uuid(),
  AGENT_ID: z.string().min(1).default(os.hostname()),
  INTERVAL_SEC: z.coerce.number().int().positive().default(60),
  LIMIT: z.coerce.number().int().min(1).max(100).default(10),
  MAERSK_ENABLED: z.boolean().default(false),
  MAERSK_HEADLESS: z.boolean().default(true),
  MAERSK_TIMEOUT_MS: z.coerce.number().int().positive().default(120000),
  MAERSK_USER_DATA_DIR: z.string().min(1).optional(),
  AGENT_UPDATE_MANIFEST_CHANNEL: z
    .string()
    .trim()
    .min(1)
    .default('stable')
    .transform((value) => value.toLowerCase()),
})

type RuntimeConfig = z.infer<typeof runtimeConfigSchema>

const bootstrapConfigSchema = z.object({
  BACKEND_URL: z
    .string()
    .url()
    .transform((value) => value.replace(/\/+$/u, '')),
  INSTALLER_TOKEN: z.string().min(1),
  AGENT_ID: z.string().min(1).default(os.hostname()),
  INTERVAL_SEC: z.coerce.number().int().positive().default(60),
  LIMIT: z.coerce.number().int().min(1).max(100).default(10),
  MAERSK_ENABLED: z.boolean().default(false),
  MAERSK_HEADLESS: z.boolean().default(true),
  MAERSK_TIMEOUT_MS: z.coerce.number().int().positive().default(120000),
  MAERSK_USER_DATA_DIR: z.string().min(1).optional(),
  AGENT_UPDATE_MANIFEST_CHANNEL: z
    .string()
    .trim()
    .min(1)
    .default('stable')
    .transform((value) => value.toLowerCase()),
})

type BootstrapConfig = z.infer<typeof bootstrapConfigSchema>

function toControlRuntimeConfig(config: RuntimeConfig): ControlRuntimeConfig {
  return {
    AGENT_ID: config.AGENT_ID,
    AGENT_TOKEN: config.AGENT_TOKEN,
    AGENT_UPDATE_MANIFEST_CHANNEL: config.AGENT_UPDATE_MANIFEST_CHANNEL,
    BACKEND_URL: config.BACKEND_URL,
    INTERVAL_SEC: config.INTERVAL_SEC,
    LIMIT: config.LIMIT,
    MAERSK_ENABLED: config.MAERSK_ENABLED,
    MAERSK_HEADLESS: config.MAERSK_HEADLESS,
    MAERSK_TIMEOUT_MS: config.MAERSK_TIMEOUT_MS,
    MAERSK_USER_DATA_DIR: config.MAERSK_USER_DATA_DIR ?? null,
    SUPABASE_ANON_KEY: config.SUPABASE_ANON_KEY ?? null,
    SUPABASE_URL: config.SUPABASE_URL ?? null,
    TENANT_ID: config.TENANT_ID,
  }
}

function toRuntimeConfigFromControlConfig(config: ControlRuntimeConfig): RuntimeConfig {
  return runtimeConfigSchema.parse({
    BACKEND_URL: config.BACKEND_URL,
    SUPABASE_URL: config.SUPABASE_URL ?? undefined,
    SUPABASE_ANON_KEY: config.SUPABASE_ANON_KEY ?? undefined,
    AGENT_TOKEN: config.AGENT_TOKEN,
    TENANT_ID: config.TENANT_ID,
    AGENT_ID: config.AGENT_ID,
    INTERVAL_SEC: config.INTERVAL_SEC,
    LIMIT: config.LIMIT,
    MAERSK_ENABLED: config.MAERSK_ENABLED,
    MAERSK_HEADLESS: config.MAERSK_HEADLESS,
    MAERSK_TIMEOUT_MS: config.MAERSK_TIMEOUT_MS,
    MAERSK_USER_DATA_DIR: config.MAERSK_USER_DATA_DIR ?? undefined,
    AGENT_UPDATE_MANIFEST_CHANNEL: config.AGENT_UPDATE_MANIFEST_CHANNEL,
  })
}

async function syncControlStateAndPersistPublicState(command: {
  readonly layout: AgentPathLayout
  readonly currentConfig: ControlRuntimeConfig
  readonly forceRemoteFetch?: boolean
}) {
  const syncCommand =
    typeof command.forceRemoteFetch === 'boolean'
      ? {
          layout: command.layout,
          currentConfig: command.currentConfig,
          forceRemoteFetch: command.forceRemoteFetch,
        }
      : {
          layout: command.layout,
          currentConfig: command.currentConfig,
        }
  const result = await syncAgentControlState(syncCommand)
  persistPublicControlState({
    layout: command.layout,
    controlSync: result,
  })
  return result
}

function persistPublicControlState(command: {
  readonly layout: AgentPathLayout
  readonly controlSync?: Awaited<ReturnType<typeof syncAgentControlState>>
}): void {
  if (process.platform !== 'linux') {
    return
  }

  void publishAgentControlPublicSnapshot({
    filePath: resolveAgentPublicStatePath(),
    backendStatePath: resolveAgentPublicBackendStatePath(),
    layout: command.layout,
    forceRemoteFetch: false,
    ...(typeof command.controlSync === 'undefined' ? {} : { controlSync: command.controlSync }),
  }).catch((error) => {
    console.warn(`[agent] failed to write public control state: ${toErrorMessage(error)}`)
  })
}

const enrollResponseSchema = z.object({
  agentToken: z.string().min(1),
  tenantId: z.string().uuid(),
  intervalSec: z.number().int().positive(),
  limit: z.number().int().min(1).max(100),
  supabaseUrl: z.string().url().optional(),
  supabaseAnonKey: z.string().min(1).optional(),
  providers: z.object({
    maerskEnabled: z.boolean(),
    maerskHeadless: z.boolean(),
    maerskTimeoutMs: z.number().int().positive(),
    maerskUserDataDir: z.string().min(1).optional(),
  }),
})

type EnrollResponse = z.infer<typeof enrollResponseSchema>

const packageJsonSchema = z.object({
  version: z.string().min(1),
})

const PLACEHOLDER_BACKEND_HOST = 'your-backend.example.com'
const PLACEHOLDER_SUPABASE_HOST = 'your-project.supabase.co'
const PLACEHOLDER_TOKEN_FRAGMENT = 'replace-with-'
const PLACEHOLDER_TENANT_ID = '00000000-0000-4000-8000-000000000000'
const UPDATE_CHECK_INTERVAL_MS = 60_000

function resolveUrlHost(value: string): string | null {
  try {
    return new URL(value).hostname.toLowerCase()
  } catch {
    return null
  }
}

function containsPlaceholderToken(value: string | undefined): boolean {
  const normalized = normalizeOptionalEnv(value)?.toLowerCase()
  if (!normalized) return false
  return normalized.includes(PLACEHOLDER_TOKEN_FRAGMENT)
}

function detectRuntimePlaceholderKeys(config: RuntimeConfig): readonly string[] {
  const keys: string[] = []

  if (resolveUrlHost(config.BACKEND_URL) === PLACEHOLDER_BACKEND_HOST) {
    keys.push('BACKEND_URL')
  }

  if (
    typeof config.SUPABASE_URL === 'string' &&
    resolveUrlHost(config.SUPABASE_URL) === PLACEHOLDER_SUPABASE_HOST
  ) {
    keys.push('SUPABASE_URL')
  }

  if (containsPlaceholderToken(config.AGENT_TOKEN)) {
    keys.push('AGENT_TOKEN')
  }

  if (containsPlaceholderToken(config.SUPABASE_ANON_KEY)) {
    keys.push('SUPABASE_ANON_KEY')
  }

  if (config.TENANT_ID === PLACEHOLDER_TENANT_ID) {
    keys.push('TENANT_ID')
  }

  return keys
}

function detectBootstrapPlaceholderKeys(config: BootstrapConfig): readonly string[] {
  const keys: string[] = []

  if (resolveUrlHost(config.BACKEND_URL) === PLACEHOLDER_BACKEND_HOST) {
    keys.push('BACKEND_URL')
  }

  if (containsPlaceholderToken(config.INSTALLER_TOKEN)) {
    keys.push('INSTALLER_TOKEN')
  }

  return keys
}

type PathLayout = {
  readonly dataDir: string
  readonly configPath: string
  readonly bootstrapPath: string
  readonly consumedBootstrapPath: string
}

function parseRuntimeConfigFromFile(filePath: string): RuntimeConfig | null {
  if (!fs.existsSync(filePath)) return null

  const loaded = loadEnvFile(filePath)
  const parsed = runtimeConfigSchema.safeParse({
    BACKEND_URL: getEnvValue('BACKEND_URL', loaded.values),
    SUPABASE_URL: getEnvValue('SUPABASE_URL', loaded.values),
    SUPABASE_ANON_KEY: getEnvValue('SUPABASE_ANON_KEY', loaded.values),
    AGENT_TOKEN: getEnvValue('AGENT_TOKEN', loaded.values),
    TENANT_ID: getEnvValue('TENANT_ID', loaded.values),
    AGENT_ID: getEnvValue('AGENT_ID', loaded.values),
    INTERVAL_SEC: getEnvValue('INTERVAL_SEC', loaded.values),
    LIMIT: getEnvValue('LIMIT', loaded.values),
    MAERSK_ENABLED: parseBooleanFlag(getEnvValue('MAERSK_ENABLED', loaded.values), false),
    MAERSK_HEADLESS: parseBooleanFlag(getEnvValue('MAERSK_HEADLESS', loaded.values), true),
    MAERSK_TIMEOUT_MS: getEnvValue('MAERSK_TIMEOUT_MS', loaded.values),
    MAERSK_USER_DATA_DIR: getEnvValue('MAERSK_USER_DATA_DIR', loaded.values),
    AGENT_UPDATE_MANIFEST_CHANNEL: getEnvValue('AGENT_UPDATE_MANIFEST_CHANNEL', loaded.values),
  })

  if (!parsed.success) {
    console.warn(
      `[agent] config.env is invalid, switching to bootstrap mode: ${parsed.error.message}`,
    )
    return null
  }

  const placeholderKeys = detectRuntimePlaceholderKeys(parsed.data)
  if (placeholderKeys.length > 0) {
    console.warn(
      `[agent] config.env contains placeholder values (${placeholderKeys.join(', ')}), switching to bootstrap mode`,
    )
    return null
  }

  return parsed.data
}

function parseBootstrapConfigFromFile(filePath: string): {
  readonly config: BootstrapConfig
  readonly raw: string
} | null {
  if (!fs.existsSync(filePath)) return null

  const loaded = loadEnvFile(filePath)
  const parsed = bootstrapConfigSchema.safeParse({
    BACKEND_URL: getEnvValue('BACKEND_URL', loaded.values),
    INSTALLER_TOKEN: getEnvValue('INSTALLER_TOKEN', loaded.values),
    AGENT_ID: getEnvValue('AGENT_ID', loaded.values),
    INTERVAL_SEC: getEnvValue('INTERVAL_SEC', loaded.values),
    LIMIT: getEnvValue('LIMIT', loaded.values),
    MAERSK_ENABLED: parseBooleanFlag(getEnvValue('MAERSK_ENABLED', loaded.values), false),
    MAERSK_HEADLESS: parseBooleanFlag(getEnvValue('MAERSK_HEADLESS', loaded.values), true),
    MAERSK_TIMEOUT_MS: getEnvValue('MAERSK_TIMEOUT_MS', loaded.values),
    MAERSK_USER_DATA_DIR: getEnvValue('MAERSK_USER_DATA_DIR', loaded.values),
    AGENT_UPDATE_MANIFEST_CHANNEL: getEnvValue('AGENT_UPDATE_MANIFEST_CHANNEL', loaded.values),
  })

  if (!parsed.success) {
    throw new Error(`invalid bootstrap.env: ${parsed.error.message}`)
  }

  const placeholderKeys = detectBootstrapPlaceholderKeys(parsed.data)
  if (placeholderKeys.length > 0) {
    throw new Error(
      `invalid bootstrap.env: placeholder values detected in ${placeholderKeys.join(', ')}`,
    )
  }

  return {
    config: parsed.data,
    raw: loaded.raw,
  }
}

function resolveMachineFingerprint(hostname: string): string {
  const providedMachineGuid = normalizeOptionalEnv(process.env.AGENT_MACHINE_GUID)
  const machineGuid = providedMachineGuid ?? hostname
  return createHash('sha256').update(`${machineGuid}|${hostname}`, 'utf8').digest('hex')
}

function resolveAgentVersion(): string {
  const activeReleaseVersion = normalizeOptionalEnv(process.env.AGENT_ACTIVE_RELEASE_VERSION)
  if (activeReleaseVersion) {
    return activeReleaseVersion
  }

  const scriptDir = path.dirname(fileURLToPath(import.meta.url))
  const candidatePaths = [
    path.resolve(scriptDir, '../../package.json'),
    path.resolve(scriptDir, '../../../package.json'),
  ]

  for (const candidatePath of candidatePaths) {
    if (!fs.existsSync(candidatePath)) continue

    try {
      const raw = fs.readFileSync(candidatePath, 'utf8')
      const parsed = packageJsonSchema.safeParse(JSON.parse(raw))
      if (parsed.success) return parsed.data.version
    } catch {
      // ignore and try next candidate
    }
  }

  return 'unknown'
}

async function enrollRuntime(command: {
  readonly bootstrapConfig: BootstrapConfig
  readonly machineFingerprint: string
  readonly hostname: string
  readonly osName: string
  readonly agentVersion: string
}): Promise<EnrollResponse> {
  const response = await fetch(`${command.bootstrapConfig.BACKEND_URL}/api/agent/enroll`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${command.bootstrapConfig.INSTALLER_TOKEN}`,
      'content-type': 'application/json',
      'x-agent-id': command.bootstrapConfig.AGENT_ID,
      'user-agent': `container-tracker-agent/${command.bootstrapConfig.AGENT_ID}`,
    },
    body: JSON.stringify({
      machineFingerprint: command.machineFingerprint,
      hostname: command.hostname,
      os: command.osName,
      agentVersion: command.agentVersion,
    }),
  })

  if (!response.ok) {
    const details = await response.text().catch(() => '')
    throw new Error(`enroll request failed (${response.status}): ${details}`)
  }

  const payload: unknown = await response.json().catch(() => ({}))
  const parsed = enrollResponseSchema.safeParse(payload)
  if (!parsed.success) {
    throw new Error(`invalid enroll response: ${parsed.error.message}`)
  }

  return parsed.data
}

function toRuntimeConfig(command: {
  readonly bootstrapConfig: BootstrapConfig
  readonly enrollResponse: EnrollResponse
}): RuntimeConfig {
  return runtimeConfigSchema.parse({
    BACKEND_URL: command.bootstrapConfig.BACKEND_URL,
    SUPABASE_URL: command.enrollResponse.supabaseUrl,
    SUPABASE_ANON_KEY: command.enrollResponse.supabaseAnonKey,
    AGENT_TOKEN: command.enrollResponse.agentToken,
    TENANT_ID: command.enrollResponse.tenantId,
    AGENT_ID: command.bootstrapConfig.AGENT_ID,
    INTERVAL_SEC: command.enrollResponse.intervalSec,
    LIMIT: command.enrollResponse.limit,
    MAERSK_ENABLED: command.enrollResponse.providers.maerskEnabled,
    MAERSK_HEADLESS: command.enrollResponse.providers.maerskHeadless,
    MAERSK_TIMEOUT_MS: command.enrollResponse.providers.maerskTimeoutMs,
    MAERSK_USER_DATA_DIR: command.enrollResponse.providers.maerskUserDataDir,
    AGENT_UPDATE_MANIFEST_CHANNEL: command.bootstrapConfig.AGENT_UPDATE_MANIFEST_CHANNEL,
  })
}

function serializeRuntimeConfig(config: RuntimeConfig): string {
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

function serializeConsumedBootstrap(bootstrapConfig: BootstrapConfig): string {
  return [
    '# Bootstrap consumed by runtime enrollment',
    `BACKEND_URL=${bootstrapConfig.BACKEND_URL}`,
    'INSTALLER_TOKEN=[REDACTED]',
    `AGENT_ID=${bootstrapConfig.AGENT_ID}`,
    `INTERVAL_SEC=${bootstrapConfig.INTERVAL_SEC}`,
    `LIMIT=${bootstrapConfig.LIMIT}`,
    `MAERSK_ENABLED=${bootstrapConfig.MAERSK_ENABLED ? 'true' : 'false'}`,
    `MAERSK_HEADLESS=${bootstrapConfig.MAERSK_HEADLESS ? 'true' : 'false'}`,
    `MAERSK_TIMEOUT_MS=${bootstrapConfig.MAERSK_TIMEOUT_MS}`,
    `MAERSK_USER_DATA_DIR=${bootstrapConfig.MAERSK_USER_DATA_DIR ?? ''}`,
    `AGENT_UPDATE_MANIFEST_CHANNEL=${bootstrapConfig.AGENT_UPDATE_MANIFEST_CHANNEL}`,
    '',
  ].join('\n')
}

function writeFileAtomic(filePath: string, content: string): void {
  const parentDir = path.dirname(filePath)
  fs.mkdirSync(parentDir, { recursive: true })

  const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`
  fs.writeFileSync(tempPath, content, 'utf8')
  fs.renameSync(tempPath, filePath)
}

function persistConfigFile(configPath: string, config: RuntimeConfig): void {
  writeFileAtomic(configPath, serializeRuntimeConfig(config))
}

function consumeBootstrapFile(command: {
  readonly bootstrapPath: string
  readonly consumedBootstrapPath: string
  readonly bootstrapConfig: BootstrapConfig
  readonly bootstrapRaw: string
}): void {
  const consumedContent = sanitizeText(command.bootstrapRaw, [
    command.bootstrapConfig.INSTALLER_TOKEN,
  ])
  const safeContent =
    consumedContent === command.bootstrapRaw
      ? serializeConsumedBootstrap(command.bootstrapConfig)
      : consumedContent

  writeFileAtomic(command.consumedBootstrapPath, safeContent)
  fs.rmSync(command.bootstrapPath, { force: true })
}

async function resolveRuntimeConfigWithBootstrap(paths: PathLayout): Promise<RuntimeConfig> {
  let enrollAttempt = 0

  for (;;) {
    const existingConfig = parseRuntimeConfigFromFile(paths.configPath)
    if (existingConfig) {
      return existingConfig
    }

    let bootstrapLoaded: { readonly config: BootstrapConfig; readonly raw: string } | null = null
    try {
      bootstrapLoaded = parseBootstrapConfigFromFile(paths.bootstrapPath)
      if (!bootstrapLoaded) {
        throw new Error(`bootstrap.env not found at ${paths.bootstrapPath}`)
      }
    } catch (error) {
      const delayMs = computeBackoffDelayMs(enrollAttempt)
      console.error(
        `[agent] bootstrap configuration unavailable: ${toErrorMessage(error)} (retry in ${Math.round(delayMs / 1000)}s)`,
      )
      enrollAttempt += 1
      await sleep(delayMs)
      continue
    }

    const secrets = [bootstrapLoaded.config.INSTALLER_TOKEN]
    const hostname = os.hostname()
    const machineFingerprint = resolveMachineFingerprint(hostname)
    const agentVersion = resolveAgentVersion()

    try {
      const enrollResponse = await enrollRuntime({
        bootstrapConfig: bootstrapLoaded.config,
        machineFingerprint,
        hostname,
        osName: `${os.platform()} ${os.release()}`,
        agentVersion,
      })

      const runtimeConfig = toRuntimeConfig({
        bootstrapConfig: bootstrapLoaded.config,
        enrollResponse,
      })

      persistConfigFile(paths.configPath, runtimeConfig)
      consumeBootstrapFile({
        bootstrapPath: paths.bootstrapPath,
        consumedBootstrapPath: paths.consumedBootstrapPath,
        bootstrapConfig: bootstrapLoaded.config,
        bootstrapRaw: bootstrapLoaded.raw,
      })
      return runtimeConfig
    } catch (error) {
      const delayMs = computeBackoffDelayMs(enrollAttempt)
      console.error(
        `[agent] enrollment failed (attempt=${enrollAttempt + 1}): ${toErrorMessage(error, secrets)} (retry in ${Math.round(delayMs / 1000)}s)`,
      )
      enrollAttempt += 1
      await sleep(delayMs)
    }
  }
}

const AgentTargetSchema = z.object({
  sync_request_id: z.string().uuid(),
  provider: z.enum(['maersk', 'msc', 'cmacgm', 'pil', 'one']),
  ref_type: z.literal('container'),
  ref: z.string().min(1),
})

type AgentTarget = z.infer<typeof AgentTargetSchema>

const TargetsResponseSchema = z.object({
  targets: z.array(AgentTargetSchema),
  leased_until: z.string().nullable(),
  queue_lag_seconds: z.number().int().min(0).nullable(),
})

const IngestAcceptedResponseSchema = z.object({
  ok: z.literal(true),
  snapshot_id: z.string().uuid(),
  new_observations_count: z.number().int().min(0).optional(),
  new_alerts_count: z.number().int().min(0).optional(),
})

const IngestFailedResponseSchema = z.object({
  error: z.string().min(1),
  snapshot_id: z.string().uuid().optional(),
})

const HeartbeatAckResponseSchema = z.object({
  ok: z.literal(true),
  updatedAt: z.string().datetime({ offset: true }),
})

type TargetsResponse = z.infer<typeof TargetsResponseSchema>

type AgentRealtimeState = 'SUBSCRIBED' | 'CHANNEL_ERROR' | 'CONNECTING' | 'DISCONNECTED' | 'UNKNOWN'
type AgentProcessingState = 'idle' | 'leasing' | 'processing' | 'backing_off' | 'unknown'
type AgentLeaseHealth = 'healthy' | 'stale' | 'conflict' | 'unknown'
type AgentActivitySeverity = 'info' | 'warning' | 'danger' | 'success'
type AgentBootStatus = 'starting' | 'healthy' | 'degraded' | 'unknown'
type AgentUpdateState =
  | 'idle'
  | 'checking'
  | 'downloading'
  | 'ready'
  | 'draining'
  | 'applying'
  | 'rollback'
  | 'blocked'
  | 'error'
  | 'unknown'
type AgentActivityType =
  | 'ENROLLED'
  | 'HEARTBEAT'
  | 'LEASED_TARGET'
  | 'SNAPSHOT_INGESTED'
  | 'REQUEST_FAILED'
  | 'REALTIME_SUBSCRIBED'
  | 'REALTIME_CHANNEL_ERROR'
  | 'LEASE_CONFLICT'
  | 'UPDATE_CHECKED'
  | 'UPDATE_AVAILABLE'
  | 'UPDATE_DOWNLOAD_STARTED'
  | 'UPDATE_DOWNLOAD_COMPLETED'
  | 'UPDATE_READY'
  | 'UPDATE_APPLY_STARTED'
  | 'UPDATE_APPLY_FAILED'
  | 'RESTART_FOR_UPDATE'
  | 'ROLLBACK_EXECUTED'
  | 'LOCAL_UPDATE_PAUSED'
  | 'LOCAL_UPDATE_RESUMED'
  | 'CHANNEL_CHANGED'
  | 'CONFIG_UPDATED'
  | 'RELEASE_ACTIVATED'
  | 'LOCAL_RESET'
  | 'REMOTE_RESET'
  | 'REMOTE_FORCE_UPDATE'

type AgentRuntimeActivity = {
  readonly type: AgentActivityType
  readonly message: string
  readonly severity: AgentActivitySeverity
  readonly metadata?: Record<string, unknown>
  readonly occurredAt?: string
}

type AgentRealtimeSignalMetadata = {
  readonly channelState: SyncRequestsRealtimeStatusUpdate['state']
  readonly scope: SyncRequestsRealtimeStatusUpdate['scope']
  readonly key: string
  readonly errorMessage: string | null
}

type AgentRealtimeSignal = {
  readonly state: AgentRealtimeState
  readonly message: string | null
  readonly metadata: AgentRealtimeSignalMetadata | null
}

type AgentRuntimeState = {
  realtimeState: AgentRealtimeState
  processingState: AgentProcessingState
  leaseHealth: AgentLeaseHealth
  activeJobs: number
  queueLagSeconds: number | null
  lastError: string | null
  bootStatus: AgentBootStatus
  updateState: AgentUpdateState
  desiredVersion: string | null
  updateReadyVersion: string | null
  restartRequestedAt: string | null
  updaterLastCheckedAt: string | null
}

function buildHeaders(config: RuntimeConfig, contentType: boolean): Headers {
  const headers = new Headers()
  headers.set('x-agent-id', config.AGENT_ID)
  headers.set('user-agent', `container-tracker-agent/${config.AGENT_ID}`)

  if (contentType) {
    headers.set('content-type', 'application/json')
  }

  headers.set('authorization', `Bearer ${config.AGENT_TOKEN}`)
  return headers
}

function resolveAgentCapabilities(config: RuntimeConfig): readonly string[] {
  if (config.MAERSK_ENABLED) return ['msc', 'cmacgm', 'pil', 'one', 'maersk']
  return ['msc', 'cmacgm', 'pil', 'one']
}

async function sendHeartbeat(command: {
  readonly config: RuntimeConfig
  readonly agentVersion: string
  readonly state: AgentRuntimeState
  readonly activity: readonly AgentRuntimeActivity[]
  readonly occurredAt: string
}): Promise<string> {
  const response = await fetch(`${command.config.BACKEND_URL}/api/agent/heartbeat`, {
    method: 'POST',
    headers: buildHeaders(command.config, true),
    body: JSON.stringify({
      tenant_id: command.config.TENANT_ID,
      hostname: os.hostname(),
      agent_version: command.agentVersion,
      current_version: command.agentVersion,
      desired_version: command.state.desiredVersion,
      update_channel: command.config.AGENT_UPDATE_MANIFEST_CHANNEL,
      update_ready_version: command.state.updateReadyVersion,
      restart_requested_at: command.state.restartRequestedAt,
      realtime_state: command.state.realtimeState,
      processing_state: command.state.processingState,
      lease_health: command.state.leaseHealth,
      boot_status: command.state.bootStatus,
      update_state: command.state.updateState,
      updater_last_checked_at: command.state.updaterLastCheckedAt,
      active_jobs: command.state.activeJobs,
      capabilities: resolveAgentCapabilities(command.config),
      logs_supported: true,
      interval_sec: command.config.INTERVAL_SEC,
      queue_lag_seconds: command.state.queueLagSeconds,
      last_error: command.state.lastError,
      occurred_at: command.occurredAt,
      activity: command.activity.map((event) => ({
        type: event.type,
        message: event.message,
        severity: event.severity,
        metadata: event.metadata ?? {},
        occurred_at: event.occurredAt,
      })),
    }),
  })

  if (!response.ok) {
    const details = await response.text().catch(() => '')
    throw new Error(`heartbeat failed (${response.status}): ${details}`)
  }

  const payload: unknown = await response.json().catch(() => ({}))
  const parsed = HeartbeatAckResponseSchema.safeParse(payload)
  if (!parsed.success) {
    throw new Error(`invalid heartbeat response: ${parsed.error.message}`)
  }

  return parsed.data.updatedAt
}

async function sendHeartbeatSafely(command: {
  readonly config: RuntimeConfig
  readonly agentVersion: string
  readonly state: AgentRuntimeState
  readonly activity?: readonly AgentRuntimeActivity[]
  readonly occurredAt?: string
}): Promise<{
  readonly ok: boolean
  readonly updatedAt: string | null
}> {
  try {
    const updatedAt = await sendHeartbeat({
      config: command.config,
      agentVersion: command.agentVersion,
      state: command.state,
      activity: command.activity ?? [],
      occurredAt: command.occurredAt ?? new Date().toISOString(),
    })

    return {
      ok: true,
      updatedAt,
    }
  } catch (error) {
    console.warn(`[agent] heartbeat publish failed: ${toErrorMessage(error)}`)
    return {
      ok: false,
      updatedAt: null,
    }
  }
}

function resolveSupervisorPaths(dataDir: string): {
  readonly healthPath: string
  readonly controlPath: string
  readonly pendingActivityPath: string
} {
  const healthPath =
    normalizeOptionalEnv(process.env.AGENT_SUPERVISOR_HEALTH_PATH) ??
    path.join(dataDir, 'runtime-health.json')

  const controlPath =
    normalizeOptionalEnv(process.env.AGENT_SUPERVISOR_CONTROL_PATH) ??
    path.join(dataDir, 'supervisor-control.json')

  const pendingActivityPath =
    normalizeOptionalEnv(process.env.AGENT_PENDING_ACTIVITY_PATH) ??
    path.join(dataDir, 'pending-activity-events.json')

  return {
    healthPath,
    controlPath,
    pendingActivityPath,
  }
}

function toRuntimeActivityFromPending(
  event: ReturnType<typeof drainPendingActivityEvents>[number],
): AgentRuntimeActivity {
  return {
    type: event.type,
    message: event.message,
    severity: event.severity,
    metadata: event.metadata,
    occurredAt: event.occurred_at,
  }
}

async function sendHeartbeatAndPersistHealth(command: {
  readonly config: RuntimeConfig
  readonly agentVersion: string
  readonly state: AgentRuntimeState
  readonly activity?: readonly AgentRuntimeActivity[]
  readonly occurredAt?: string
  readonly healthPath: string
}): Promise<void> {
  const occurredAt = command.occurredAt ?? new Date().toISOString()
  const heartbeat = await sendHeartbeatSafely({
    config: command.config,
    agentVersion: command.agentVersion,
    state: command.state,
    activity: command.activity ?? [],
    occurredAt,
  })

  if (heartbeat.ok && heartbeat.updatedAt) {
    command.state.bootStatus = 'healthy'
  } else if (command.state.bootStatus === 'starting') {
    command.state.bootStatus = 'degraded'
  }

  writeRuntimeHealth(command.healthPath, {
    agent_version: command.agentVersion,
    boot_status: command.state.bootStatus,
    update_state: command.state.updateState,
    last_heartbeat_at: occurredAt,
    last_heartbeat_ok_at: heartbeat.updatedAt,
    active_jobs: command.state.activeJobs,
    processing_state: command.state.processingState,
    updated_at: new Date().toISOString(),
    pid: process.pid,
  })
}

async function fetchTargets(
  config: RuntimeConfig,
  limit: number,
  recoverOwnedLeases = false,
): Promise<TargetsResponse> {
  const url = new URL('/api/agent/targets', config.BACKEND_URL)
  url.searchParams.set('tenant_id', config.TENANT_ID)
  url.searchParams.set('limit', String(limit))
  if (recoverOwnedLeases) {
    url.searchParams.set('recover_owned_leases', 'true')
  }

  const response = await fetch(url, {
    method: 'GET',
    headers: buildHeaders(config, false),
  })

  if (!response.ok) {
    const details = await response.text().catch(() => '')
    throw new Error(`targets request failed (${response.status}): ${details}`)
  }

  const payload: unknown = await response.json().catch(() => ({}))
  const parsed = TargetsResponseSchema.safeParse(payload)
  if (!parsed.success) {
    throw new Error(`invalid targets response: ${parsed.error.message}`)
  }

  return parsed.data
}

const maerskCaptureService = createMaerskCaptureService()

type ScrapeResult = {
  readonly raw: unknown
  readonly observedAt: string
  readonly parseError?: string | null
}

async function performScrapeTarget(
  config: RuntimeConfig,
  target: AgentTarget,
): Promise<ScrapeResult> {
  if (target.provider === 'msc') {
    const result = await fetchMscStatus(target.ref)
    return {
      raw: result.payload,
      observedAt: result.fetchedAt,
      parseError: result.parseError ?? null,
    }
  }

  if (target.provider === 'cmacgm') {
    const result = await fetchCmaCgmStatus(target.ref)
    return {
      raw: result.payload,
      observedAt: result.fetchedAt,
      parseError: result.parseError ?? null,
    }
  }

  if (target.provider === 'pil') {
    const result = await fetchPilStatus(target.ref)
    return {
      raw: result.payload,
      observedAt: result.fetchedAt,
      parseError: result.parseError ?? null,
    }
  }

  if (target.provider === 'one') {
    const result = await fetchOneStatus(target.ref)
    return {
      raw: result.payload,
      observedAt: result.fetchedAt,
      parseError: result.parseError ?? null,
    }
  }

  if (!config.MAERSK_ENABLED) {
    throw new Error('maersk target received but MAERSK_ENABLED is disabled')
  }

  const result = await maerskCaptureService.capture({
    container: target.ref,
    headless: config.MAERSK_HEADLESS,
    hold: false,
    timeoutMs: config.MAERSK_TIMEOUT_MS,
    userDataDir: config.MAERSK_USER_DATA_DIR ?? null,
  })

  if (result.kind === 'error') {
    throw new Error(`maersk capture failed: ${JSON.stringify(result.body)}`)
  }

  return { raw: result.payload, observedAt: new Date().toISOString(), parseError: null }
}

async function scrapeTarget(config: RuntimeConfig, target: AgentTarget): Promise<ScrapeResult> {
  try {
    return await performScrapeTarget(config, target)
  } catch (error) {
    const errorMessage = toErrorMessage(error)
    return {
      raw: {
        _error: true,
        message: errorMessage,
      },
      observedAt: new Date().toISOString(),
      parseError: `Fetch failed: ${errorMessage}`,
    }
  }
}

async function ingestSnapshot(
  config: RuntimeConfig,
  target: AgentTarget,
  scrape: ScrapeResult,
  agentVersion: string,
): Promise<
  | { readonly kind: 'accepted'; readonly snapshotId: string }
  | { readonly kind: 'failed'; readonly errorMessage: string; readonly snapshotId?: string }
  | { readonly kind: 'lease_conflict' }
> {
  const response = await fetch(`${config.BACKEND_URL}/api/tracking/snapshots/ingest`, {
    method: 'POST',
    headers: buildHeaders(config, true),
    body: JSON.stringify({
      tenant_id: config.TENANT_ID,
      provider: target.provider,
      ref: {
        type: 'container',
        value: target.ref,
      },
      observed_at: scrape.observedAt,
      raw: scrape.raw,
      parse_error: scrape.parseError ?? null,
      meta: {
        agent_version: agentVersion,
        host: config.AGENT_ID,
      },
      sync_request_id: target.sync_request_id,
    }),
  })

  if (response.status === 409) {
    const body = await response.json().catch(() => ({}))
    console.warn(`[agent] lease conflict for ${target.sync_request_id}:`, body)
    return { kind: 'lease_conflict' }
  }

  if (response.status === 422) {
    const payload: unknown = await response.json().catch(() => ({}))
    const parsed = IngestFailedResponseSchema.safeParse(payload)
    if (!parsed.success) {
      throw new Error(`invalid ingest failure response: ${parsed.error.message}`)
    }

    if (parsed.data.snapshot_id) {
      console.warn(
        `[agent] backend marked ${target.ref} as failed after persisting snapshot ${parsed.data.snapshot_id}: ${parsed.data.error}`,
      )
    } else {
      console.warn(`[agent] backend marked ${target.ref} as failed: ${parsed.data.error}`)
    }

    return {
      kind: 'failed',
      errorMessage: parsed.data.error,
      ...(parsed.data.snapshot_id === undefined ? {} : { snapshotId: parsed.data.snapshot_id }),
    }
  }

  if (!response.ok) {
    const details = await response.text().catch(() => '')
    throw new Error(`ingest failed (${response.status}): ${details}`)
  }

  const payload: unknown = await response.json().catch(() => ({}))
  const parsed = IngestAcceptedResponseSchema.safeParse(payload)
  if (!parsed.success) {
    throw new Error(`invalid ingest response: ${parsed.error.message}`)
  }

  const newObservationsCount = parsed.data.new_observations_count
  const newAlertsCount = parsed.data.new_alerts_count
  const summary =
    newObservationsCount === undefined
      ? ''
      : ` (${newObservationsCount} new observation${newObservationsCount === 1 ? '' : 's'}${newAlertsCount === undefined ? '' : `, ${newAlertsCount} new alert${newAlertsCount === 1 ? '' : 's'}`})`

  console.log(`[agent] ingested ${target.ref} -> snapshot ${parsed.data.snapshot_id}${summary}`)
  return { kind: 'accepted', snapshotId: parsed.data.snapshot_id }
}

type ProcessTargetResult =
  | {
      readonly kind: 'success'
      readonly durationMs: number
      readonly snapshotId: string
    }
  | {
      readonly kind: 'lease_conflict'
      readonly durationMs: number
      readonly errorMessage: string
    }
  | {
      readonly kind: 'failed'
      readonly durationMs: number
      readonly errorMessage: string
      readonly snapshotId?: string
    }

async function processTarget(
  config: RuntimeConfig,
  target: AgentTarget,
  agentVersion: string,
): Promise<ProcessTargetResult> {
  const startedAtMs = Date.now()

  try {
    const scrape = await scrapeTarget(config, target)
    const ingestResult = await ingestSnapshot(config, target, scrape, agentVersion)

    if (ingestResult.kind === 'lease_conflict') {
      return {
        kind: 'lease_conflict',
        durationMs: Math.max(0, Date.now() - startedAtMs),
        errorMessage: `Lease conflict for ${target.sync_request_id}`,
      }
    }

    if (ingestResult.kind === 'failed') {
      return {
        kind: 'failed',
        durationMs: Math.max(0, Date.now() - startedAtMs),
        errorMessage: ingestResult.errorMessage,
        ...(ingestResult.snapshotId === undefined ? {} : { snapshotId: ingestResult.snapshotId }),
      }
    }

    return {
      kind: 'success',
      durationMs: Math.max(0, Date.now() - startedAtMs),
      snapshotId: ingestResult.snapshotId,
    }
  } catch (error) {
    const message = toErrorMessage(error)
    console.error(`[agent] target ${target.sync_request_id} failed: ${message}`)
    console.warn(
      `[agent] target ${target.sync_request_id} will be available again after lease expiration`,
    )

    return {
      kind: 'failed',
      durationMs: Math.max(0, Date.now() - startedAtMs),
      errorMessage: message,
    }
  }
}

async function runOnce(
  config: RuntimeConfig,
  agentVersion: string,
  state: AgentRuntimeState,
  reason: AgentRunReason,
): Promise<readonly AgentRuntimeActivity[]> {
  const leaseBatchSize = 1
  let processed = 0
  const activities: AgentRuntimeActivity[] = []
  state.processingState = 'leasing'
  state.activeJobs = 0

  while (processed < config.LIMIT) {
    const remaining = config.LIMIT - processed
    let targetsResponse = await fetchTargets(config, Math.min(leaseBatchSize, remaining))
    let targets = targetsResponse.targets

    if (targets.length === 0 && reason === 'startup' && processed === 0) {
      targetsResponse = await fetchTargets(config, Math.min(leaseBatchSize, remaining), true)
      targets = targetsResponse.targets
      if (targets.length > 0) {
        console.log('[agent] recovered owned lease(s) on startup')
      }
    }

    state.queueLagSeconds = targetsResponse.queue_lag_seconds

    if (targets.length === 0) {
      if (processed === 0) {
        console.log('[agent] no targets available')
      }
      state.processingState = 'idle'
      state.activeJobs = 0
      break
    }

    for (const target of targets) {
      state.processingState = 'processing'
      state.activeJobs = 1
      const result = await processTarget(config, target, agentVersion)
      state.activeJobs = 0
      processed += 1

      if (result.kind === 'success') {
        state.lastError = null
        state.leaseHealth = 'healthy'
        continue
      }

      if (result.kind === 'lease_conflict') {
        state.leaseHealth = 'conflict'
        state.lastError = result.errorMessage
        activities.push({
          type: 'LEASE_CONFLICT',
          message: result.errorMessage,
          severity: 'warning',
          metadata: {
            syncRequestId: target.sync_request_id,
            provider: target.provider,
            ref: target.ref,
            durationMs: result.durationMs,
          },
        })
        continue
      }

      state.processingState = 'backing_off'
      state.lastError = result.errorMessage
      activities.push({
        type: 'REQUEST_FAILED',
        message: result.errorMessage,
        severity: 'danger',
        metadata: {
          syncRequestId: target.sync_request_id,
          provider: target.provider,
          ref: target.ref,
          durationMs: result.durationMs,
          snapshotId: result.snapshotId,
        },
      })
    }
  }

  if (processed > 0) {
    console.log(`[agent] cycle processed ${processed} target(s)`)
  }

  if (state.processingState !== 'backing_off') {
    state.processingState = 'idle'
  }

  return activities
}

function shouldWakeForRealtimeEvent(event: {
  readonly eventType: 'INSERT' | 'UPDATE' | 'DELETE'
  readonly row: { readonly status: string } | null
}): boolean {
  if (event.eventType === 'DELETE') {
    return false
  }

  return event.row?.status === 'PENDING'
}

function buildRealtimeSignalFingerprint(signal: AgentRealtimeSignal): string {
  const metadataFingerprint = signal.metadata
    ? `${signal.metadata.channelState}|${signal.metadata.scope}|${signal.metadata.key}|${signal.metadata.errorMessage ?? 'none'}`
    : 'none'

  return `${signal.state}|${signal.message ?? 'none'}|${metadataFingerprint}`
}

function buildRealtimeDegradedMessage(status: SyncRequestsRealtimeStatusUpdate): string {
  const errorMessage = normalizeOptionalText(status.errorMessage)
  const detail =
    errorMessage ??
    (status.state === 'TIMED_OUT'
      ? 'subscription timed out without an explicit error from Supabase Realtime'
      : 'Supabase Realtime did not provide an explicit error message')

  return `Realtime ${status.state.toLowerCase()} for ${status.scope} (${status.key}): ${detail}`
}

function toRealtimeSignal(status: SyncRequestsRealtimeStatusUpdate): AgentRealtimeSignal {
  const metadata: AgentRealtimeSignalMetadata = {
    channelState: status.state,
    scope: status.scope,
    key: status.key,
    errorMessage: normalizeOptionalText(status.errorMessage),
  }

  if (status.state === 'SUBSCRIBED') {
    return {
      state: 'SUBSCRIBED',
      message: 'Realtime subscribed for tenant sync requests',
      metadata,
    }
  }

  if (status.state === 'CLOSED') {
    return {
      state: 'DISCONNECTED',
      message: `Realtime channel closed for ${status.scope} (${status.key})`,
      metadata,
    }
  }

  return {
    state: 'CHANNEL_ERROR',
    message: buildRealtimeDegradedMessage(status),
    metadata,
  }
}

function subscribeToRealtimeIfConfigured(command: {
  readonly config: RuntimeConfig
  readonly onWake: () => void
  readonly onRealtimeStateChange: (signal: AgentRealtimeSignal) => void
}): { readonly unsubscribe: () => void } | null {
  if (!command.config.SUPABASE_URL || !command.config.SUPABASE_ANON_KEY) {
    console.warn('[agent] realtime disabled: SUPABASE_URL/SUPABASE_ANON_KEY not configured')
    command.onRealtimeStateChange({
      state: 'DISCONNECTED',
      message: 'Realtime disabled: SUPABASE_URL/SUPABASE_ANON_KEY not configured',
      metadata: null,
    })
    return null
  }

  try {
    command.onRealtimeStateChange({
      state: 'CONNECTING',
      message: 'Connecting to Supabase Realtime',
      metadata: null,
    })
    let lastLoggedSignalFingerprint: string | null = null

    const supabaseRealtime = createClient(
      command.config.SUPABASE_URL,
      command.config.SUPABASE_ANON_KEY,
      {
        db: {
          schema: 'public',
        },
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      },
    )

    return subscribeSyncRequestsByTenant({
      client: supabaseRealtime,
      tenantId: command.config.TENANT_ID,
      onEvent(event) {
        if (!shouldWakeForRealtimeEvent(event)) {
          return
        }
        command.onWake()
      },
      onStatus(status) {
        const signal = toRealtimeSignal(status)
        const signalFingerprint = buildRealtimeSignalFingerprint(signal)
        const shouldLogSignal = lastLoggedSignalFingerprint !== signalFingerprint
        lastLoggedSignalFingerprint = signalFingerprint

        if (signal.state === 'SUBSCRIBED') {
          if (shouldLogSignal) {
            console.log('[agent] realtime subscribed for tenant sync requests')
          }
          command.onRealtimeStateChange(signal)
          return
        }

        if (signal.state === 'CHANNEL_ERROR') {
          if (shouldLogSignal) {
            console.warn('[agent] realtime channel degraded; interval sweep remains active', {
              ...status,
              diagnostic: signal.message,
            })
          }
          command.onRealtimeStateChange(signal)
          return
        }

        if (signal.state === 'DISCONNECTED') {
          command.onRealtimeStateChange(signal)
        }
      },
    })
  } catch (error) {
    const message = `Realtime setup failed; continuing with interval sweep only: ${toErrorMessage(error)}`
    console.warn(`[agent] ${message}`)
    command.onRealtimeStateChange({
      state: 'CHANNEL_ERROR',
      message,
      metadata: null,
    })
    return null
  }
}

async function runUpdateCheck(command: {
  readonly config: RuntimeConfig
  readonly agentVersion: string
  readonly state: AgentRuntimeState
  readonly releaseStatePath: string
  readonly agentLayout: AgentPathLayout
  readonly supervisorControlPath: string
  readonly effectiveBlockedVersions: readonly string[]
}): Promise<{
  readonly activities: readonly AgentRuntimeActivity[]
  readonly shouldDrain: boolean
}> {
  const nowIso = new Date().toISOString()
  const activities: AgentRuntimeActivity[] = []
  command.state.updaterLastCheckedAt = nowIso
  command.state.updateState = 'checking'

  try {
    const manifest = await fetchUpdateManifest({
      backendUrl: command.config.BACKEND_URL,
      agentToken: command.config.AGENT_TOKEN,
      agentId: command.config.AGENT_ID,
      platform: resolveAgentPlatformKey(),
      updateChannelOverride: command.config.AGENT_UPDATE_MANIFEST_CHANNEL,
    })

    command.state.desiredVersion = manifest.desired_version
    command.state.restartRequestedAt = manifest.restart_requested_at
    command.state.updateReadyVersion = manifest.update_ready_version

    activities.push({
      type: 'UPDATE_CHECKED',
      message: `Checked update manifest (desired=${manifest.desired_version ?? 'none'})`,
      severity: 'info',
      metadata: {
        version: manifest.version,
        updateAvailable: manifest.update_available,
      },
      occurredAt: nowIso,
    })

    let shouldDrain = false
    if (manifest.restart_required) {
      command.state.updateState = 'draining'
      shouldDrain = true
      supervisorControl.writeSupervisorControl(command.supervisorControlPath, {
        drain_requested: true,
        reason: 'restart',
        requested_at: nowIso,
      })
    }

    const releaseState = readReleaseState(command.releaseStatePath, command.agentVersion)
    const effectiveReleaseState = {
      ...releaseState,
      blocked_versions: [
        ...new Set([...releaseState.blocked_versions, ...command.effectiveBlockedVersions]),
      ],
    }
    const stagedRelease = await stageReleaseFromManifest({
      manifest,
      layout: command.agentLayout,
      state: effectiveReleaseState,
    })

    if (stagedRelease.kind === 'no_update') {
      if (command.state.updateState !== 'draining') {
        command.state.updateState = 'idle'
      }
      return { activities, shouldDrain }
    }

    if (stagedRelease.kind === 'blocked') {
      command.state.updateState = 'blocked'
      command.state.lastError = stagedRelease.reason
      writeReleaseState(command.releaseStatePath, {
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
        occurredAt: nowIso,
      })
      return { activities, shouldDrain }
    }

    activities.push({
      type: 'UPDATE_AVAILABLE',
      message: `Update available: ${stagedRelease.manifest.version}`,
      severity: 'info',
      metadata: {
        version: stagedRelease.manifest.version,
        channel: stagedRelease.manifest.channel,
      },
      occurredAt: nowIso,
    })

    if (stagedRelease.downloaded) {
      activities.push({
        type: 'UPDATE_DOWNLOAD_STARTED',
        message: `Downloading release ${stagedRelease.manifest.version}`,
        severity: 'info',
        metadata: {
          version: stagedRelease.manifest.version,
          url: stagedRelease.manifest.download_url,
        },
        occurredAt: nowIso,
      })
      activities.push({
        type: 'UPDATE_DOWNLOAD_COMPLETED',
        message: `Downloaded release ${stagedRelease.manifest.version}`,
        severity: 'success',
        metadata: {
          version: stagedRelease.manifest.version,
          checksum: stagedRelease.manifest.checksum,
        },
        occurredAt: nowIso,
      })
    }

    writeReleaseState(command.releaseStatePath, {
      ...releaseState,
      target_version: stagedRelease.manifest.version,
      activation_state: 'pending',
      last_update_attempt: nowIso,
      last_error: null,
      automatic_updates_blocked: false,
    })

    command.state.updateState = 'ready'
    command.state.updateReadyVersion = stagedRelease.manifest.version
    command.state.lastError = null
    shouldDrain = true

    supervisorControl.writeSupervisorControl(command.supervisorControlPath, {
      drain_requested: true,
      reason: 'update',
      requested_at: nowIso,
    })

    activities.push({
      type: 'UPDATE_READY',
      message: `Release ${stagedRelease.manifest.version} staged and pending activation`,
      severity: 'success',
      metadata: {
        version: stagedRelease.manifest.version,
        releaseDir: stagedRelease.releaseDir,
      },
      occurredAt: nowIso,
    })

    return {
      activities,
      shouldDrain,
    }
  } catch (error) {
    const errorMessage = `Updater check failed: ${toErrorMessage(error)}`
    command.state.updateState = 'error'
    command.state.lastError = errorMessage
    return {
      activities: [
        ...activities,
        {
          type: 'UPDATE_APPLY_FAILED',
          message: errorMessage,
          severity: 'danger',
          metadata: {},
          occurredAt: nowIso,
        },
      ],
      shouldDrain: false,
    }
  }
}

async function main(): Promise<void> {
  const agentLayout = runtimePaths.resolveAgentPathLayout()
  runtimePaths.ensureAgentPathLayout(agentLayout)
  let runtimeConfig = await resolveRuntimeConfigWithBootstrap(agentLayout)
  let controlSync = await syncControlStateAndPersistPublicState({
    layout: agentLayout,
    currentConfig: toControlRuntimeConfig(runtimeConfig),
  })
  runtimeConfig = toRuntimeConfigFromControlConfig(controlSync.effectiveConfig)
  let updateChecksMode = resolveAutomaticUpdateChecksMode({
    env: process.env,
    configuredChannel: runtimeConfig.AGENT_UPDATE_MANIFEST_CHANNEL,
  })
  let updateManifestChecksDisabled = updateChecksMode.disabled
  const agentVersion = resolveAgentVersion()
  const supervisorPaths = resolveSupervisorPaths(agentLayout.dataDir)

  console.log(
    `[agent] started (tenant=${runtimeConfig.TENANT_ID}, agent=${runtimeConfig.AGENT_ID}, interval=${runtimeConfig.INTERVAL_SEC}s)`,
  )
  if (updateManifestChecksDisabled) {
    if (updateChecksMode.reason === 'EXPLICIT_DISABLE_FLAG') {
      console.log(
        `[agent:update] manifest checks disabled by AGENT_DISABLE_AUTOMATIC_UPDATE_CHECKS; configured channel=${updateChecksMode.configuredChannel ?? 'unknown'}; using current runtime only`,
      )
    } else {
      console.log(
        '[agent:update] manifest checks disabled (AGENT_UPDATE_MANIFEST_CHANNEL=disabled); using current runtime only',
      )
    }
  }

  const runtimeState: AgentRuntimeState = {
    realtimeState:
      runtimeConfig.SUPABASE_URL && runtimeConfig.SUPABASE_ANON_KEY ? 'CONNECTING' : 'DISCONNECTED',
    processingState: 'idle',
    leaseHealth: 'unknown',
    activeJobs: 0,
    queueLagSeconds: null,
    lastError: null,
    bootStatus: 'starting',
    updateState: 'idle',
    desiredVersion: controlSync.remotePolicy.desiredVersion,
    updateReadyVersion: controlSync.releaseState.target_version,
    restartRequestedAt: controlSync.remotePolicy.restartRequestedAt,
    updaterLastCheckedAt: null,
  }

  const logForwarder = createAgentLogForwarder({
    backendUrl: runtimeConfig.BACKEND_URL,
    agentToken: runtimeConfig.AGENT_TOKEN,
    agentId: runtimeConfig.AGENT_ID,
    logsDir: agentLayout.logsDir,
    statePath: path.join(agentLayout.dataDir, 'agent-log-forwarder-state.json'),
  })
  logForwarder.start()

  const pendingActivities = drainPendingActivityEvents(supervisorPaths.pendingActivityPath).map(
    toRuntimeActivityFromPending,
  )
  await sendHeartbeatAndPersistHealth({
    config: runtimeConfig,
    agentVersion,
    state: runtimeState,
    activity: pendingActivities,
    healthPath: supervisorPaths.healthPath,
  })
  controlSync = await syncControlStateAndPersistPublicState({
    layout: agentLayout,
    currentConfig: toControlRuntimeConfig(runtimeConfig),
    forceRemoteFetch: false,
  })
  runtimeConfig = toRuntimeConfigFromControlConfig(controlSync.effectiveConfig)

  let lastRealtimeSignalFingerprint: string | null = null
  let lastUpdateCheckAtMs = 0
  let requestRestartAfterHeartbeat = false
  let scheduler: ReturnType<typeof createAgentScheduler> | null = null
  let realtimeSubscription: { readonly unsubscribe: () => void } | null = null

  scheduler = createAgentScheduler({
    intervalMs: runtimeConfig.INTERVAL_SEC * 1000,
    runCycle: async (reason) => {
      const cycleActivities: AgentRuntimeActivity[] = []

      controlSync = await syncControlStateAndPersistPublicState({
        layout: agentLayout,
        currentConfig: toControlRuntimeConfig(runtimeConfig),
      })
      runtimeConfig = toRuntimeConfigFromControlConfig(controlSync.effectiveConfig)
      updateChecksMode = resolveAutomaticUpdateChecksMode({
        env: process.env,
        configuredChannel: runtimeConfig.AGENT_UPDATE_MANIFEST_CHANNEL,
      })
      updateManifestChecksDisabled = updateChecksMode.disabled

      const pendingRemoteCommand = controlSync.remoteCommands[0]
      if (pendingRemoteCommand) {
        const remoteCommandResult = await applyRemoteCommand({
          layout: agentLayout,
          currentConfig: toControlRuntimeConfig(runtimeConfig),
          remoteCommand: pendingRemoteCommand,
        })
        controlSync = remoteCommandResult.result
        runtimeConfig = toRuntimeConfigFromControlConfig(controlSync.effectiveConfig)

        try {
          await acknowledgeRemoteCommand({
            config: toControlRuntimeConfig(runtimeConfig),
            remoteCommandId: pendingRemoteCommand.id,
            status: 'APPLIED',
          })
        } catch (error) {
          console.warn(`[agent] failed to acknowledge remote command: ${toErrorMessage(error)}`)
        }

        if (remoteCommandResult.requiresRestart) {
          runtimeState.updateState = 'draining'
          runtimeState.restartRequestedAt = pendingRemoteCommand.requestedAt
          supervisorControl.writeSupervisorControl(supervisorPaths.controlPath, {
            drain_requested: true,
            reason: 'restart',
            requested_at: pendingRemoteCommand.requestedAt,
          })
        }
      }

      const controlState = supervisorControl.readSupervisorControl(supervisorPaths.controlPath)
      if (controlState?.drain_requested) {
        runtimeState.updateState = 'draining'
        runtimeState.restartRequestedAt = controlState.requested_at
      }

      if (runtimeState.updateState !== 'draining') {
        const runActivities = await runOnce(runtimeConfig, agentVersion, runtimeState, reason)
        cycleActivities.push(...runActivities)
      } else {
        runtimeState.processingState = 'idle'
        runtimeState.activeJobs = 0
      }

      const nowMs = Date.now()
      const shouldRunUpdateCheck =
        !updateManifestChecksDisabled &&
        !controlSync.snapshot.updates.paused.value &&
        runtimeState.updateState !== 'draining' &&
        nowMs - lastUpdateCheckAtMs >= UPDATE_CHECK_INTERVAL_MS

      if (shouldRunUpdateCheck) {
        const updateResult = await runUpdateCheck({
          config: runtimeConfig,
          agentVersion,
          state: runtimeState,
          releaseStatePath: agentLayout.releaseStatePath,
          agentLayout,
          supervisorControlPath: supervisorPaths.controlPath,
          effectiveBlockedVersions: controlSync.snapshot.updates.blockedVersions.effective,
        })
        lastUpdateCheckAtMs = nowMs
        cycleActivities.push(...updateResult.activities)
        if (updateResult.shouldDrain) {
          runtimeState.updateState = 'draining'
        }
      }

      if (runtimeState.updateState === 'draining' && runtimeState.activeJobs === 0) {
        requestRestartAfterHeartbeat = true
        cycleActivities.push({
          type: 'RESTART_FOR_UPDATE',
          message: 'Runtime drained and ready to restart for update',
          severity: 'warning',
          metadata: {
            targetVersion: runtimeState.updateReadyVersion,
            desiredVersion: runtimeState.desiredVersion,
          },
          occurredAt: new Date().toISOString(),
        })
      }

      await sendHeartbeatAndPersistHealth({
        config: runtimeConfig,
        agentVersion,
        state: runtimeState,
        activity: cycleActivities,
        healthPath: supervisorPaths.healthPath,
      })
      controlSync = await syncControlStateAndPersistPublicState({
        layout: agentLayout,
        currentConfig: toControlRuntimeConfig(runtimeConfig),
        forceRemoteFetch: false,
      })
      runtimeConfig = toRuntimeConfigFromControlConfig(controlSync.effectiveConfig)

      if (requestRestartAfterHeartbeat && runtimeState.activeJobs === 0) {
        supervisorControl.writeSupervisorControl(supervisorPaths.controlPath, {
          drain_requested: false,
          reason: null,
          requested_at: null,
        })
        scheduler?.stop()
        realtimeSubscription?.unsubscribe()
        void logForwarder.stop().finally(() => {
          process.exit(EXIT_UPDATE_RESTART)
        })
      }
    },
    onRunError({ reason, error }) {
      const errorMessage = toErrorMessage(error)
      runtimeState.processingState = 'backing_off'
      runtimeState.bootStatus = 'degraded'
      runtimeState.lastError = errorMessage
      console.error(`[agent] cycle failed (reason=${reason}): ${errorMessage}`)
      void sendHeartbeatAndPersistHealth({
        config: runtimeConfig,
        agentVersion,
        state: runtimeState,
        activity: [
          {
            type: 'REQUEST_FAILED',
            message: `Agent cycle failed (${reason}): ${errorMessage}`,
            severity: 'danger',
            metadata: {
              reason,
            },
          },
        ],
        healthPath: supervisorPaths.healthPath,
      })
    },
  })

  realtimeSubscription = subscribeToRealtimeIfConfigured({
    config: runtimeConfig,
    onWake() {
      scheduler?.triggerRun('realtime')
    },
    onRealtimeStateChange(signal) {
      const fingerprint = buildRealtimeSignalFingerprint(signal)
      if (lastRealtimeSignalFingerprint === fingerprint) return
      lastRealtimeSignalFingerprint = fingerprint
      runtimeState.realtimeState = signal.state

      if (signal.state === 'SUBSCRIBED') {
        runtimeState.lastError = null
        void sendHeartbeatAndPersistHealth({
          config: runtimeConfig,
          agentVersion,
          state: runtimeState,
          activity: [
            {
              type: 'REALTIME_SUBSCRIBED',
              message: signal.message ?? 'Realtime subscribed for tenant sync requests',
              severity: 'success',
              metadata: signal.metadata ?? {},
            },
          ],
          healthPath: supervisorPaths.healthPath,
        })
        return
      }

      if (signal.state === 'CHANNEL_ERROR') {
        runtimeState.lastError = signal.message ?? 'Realtime channel degraded'
        void sendHeartbeatAndPersistHealth({
          config: runtimeConfig,
          agentVersion,
          state: runtimeState,
          activity: [
            {
              type: 'REALTIME_CHANNEL_ERROR',
              message: signal.message ?? 'Realtime channel error; interval sweep is active',
              severity: 'warning',
              metadata: signal.metadata ?? {},
            },
          ],
          healthPath: supervisorPaths.healthPath,
        })
      }
    },
  })

  scheduler.start()

  const shutdown = (signal: 'SIGINT' | 'SIGTERM') => {
    console.log(`[agent] received ${signal}, shutting down`)
    runtimeState.realtimeState = 'DISCONNECTED'
    runtimeState.processingState = 'idle'
    runtimeState.updateState = 'idle'
    runtimeState.bootStatus = 'degraded'
    void sendHeartbeatAndPersistHealth({
      config: runtimeConfig,
      agentVersion,
      state: runtimeState,
      activity: [],
      healthPath: supervisorPaths.healthPath,
    })
    realtimeSubscription?.unsubscribe()
    scheduler?.stop()
    void logForwarder.stop().catch((error) => {
      console.warn(`[agent] log forwarder stop failed: ${toErrorMessage(error)}`)
    })
    supervisorControl.clearSupervisorControl(supervisorPaths.controlPath)
  }

  process.once('SIGINT', () => shutdown('SIGINT'))
  process.once('SIGTERM', () => shutdown('SIGTERM'))
}

void main().catch((error) => {
  console.error(`[agent] fatal startup error: ${toErrorMessage(error)}`)
  process.exitCode = EXIT_FATAL
})
