import { createHash } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

import { createClient } from '@supabase/supabase-js'
import { z } from 'zod/v4'

// biome-ignore lint/style/noRestrictedImports: Agent runtime uses Node --experimental-strip-types with direct .ts imports.
import { fetchCmaCgmStatus } from '../../src/modules/tracking/infrastructure/carriers/fetchers/cmacgm.fetcher.ts'
// biome-ignore lint/style/noRestrictedImports: Agent runtime uses Node --experimental-strip-types with direct .ts imports.
import { createMaerskCaptureService } from '../../src/modules/tracking/infrastructure/carriers/fetchers/maersk.puppeteer.fetcher.ts'
// biome-ignore lint/style/noRestrictedImports: Agent runtime uses Node --experimental-strip-types with direct .ts imports.
import { fetchMscStatus } from '../../src/modules/tracking/infrastructure/carriers/fetchers/msc.fetcher.ts'
// biome-ignore lint/style/noRestrictedImports: Agent runtime uses Node --experimental-strip-types with direct .ts imports.
import { subscribeSyncRequestsByTenant } from '../../src/shared/supabase/sync-requests.realtime.ts'
// biome-ignore lint/style/noRestrictedImports: Agent runtime uses Node --experimental-strip-types with direct .ts imports.
import { createAgentScheduler } from './agent.scheduler.ts'
// biome-ignore lint/style/noRestrictedImports: Agent runtime uses Node --experimental-strip-types with direct .ts imports.
import { computeBackoffDelayMs } from './backoff.ts'

const DEFAULT_DATA_DIR_NAME = 'ContainerTracker'

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
})

type BootstrapConfig = z.infer<typeof bootstrapConfigSchema>

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

function resolveDefaultDataDir(): string {
  const localAppData = normalizeOptionalEnv(process.env.LOCALAPPDATA)
  if (localAppData) {
    return path.win32.join(localAppData, DEFAULT_DATA_DIR_NAME)
  }

  return path.win32.join(os.homedir(), 'AppData', 'Local', DEFAULT_DATA_DIR_NAME)
}

function resolvePathLayout(): PathLayout {
  const dataDir = normalizeOptionalEnv(process.env.AGENT_DATA_DIR) ?? resolveDefaultDataDir()
  const configPath =
    normalizeOptionalEnv(process.env.DOTENV_PATH) ?? path.win32.join(dataDir, 'config.env')
  const bootstrapPath =
    normalizeOptionalEnv(process.env.BOOTSTRAP_DOTENV_PATH) ??
    path.win32.join(dataDir, 'bootstrap.env')

  return {
    dataDir,
    configPath,
    bootstrapPath,
    consumedBootstrapPath: `${bootstrapPath}.consumed`,
  }
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
  provider: z.enum(['maersk', 'msc', 'cmacgm']),
  ref_type: z.literal('container'),
  ref: z.string().min(1),
})

type AgentTarget = z.infer<typeof AgentTargetSchema>

const TargetsResponseSchema = z.object({
  targets: z.array(AgentTargetSchema),
  leased_until: z.string().nullable(),
})

const IngestAcceptedResponseSchema = z.object({
  ok: z.literal(true),
  snapshot_id: z.string().uuid(),
})

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

async function fetchTargets(
  config: RuntimeConfig,
  limit: number,
): Promise<readonly AgentTarget[]> {
  const url = new URL('/api/agent/targets', config.BACKEND_URL)
  url.searchParams.set('tenant_id', config.TENANT_ID)
  url.searchParams.set('limit', String(limit))

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

  return parsed.data.targets
}

const maerskCaptureService = createMaerskCaptureService()

async function scrapeTarget(
  config: RuntimeConfig,
  target: AgentTarget,
): Promise<{ raw: unknown; observedAt: string }> {
  if (target.provider === 'msc') {
    const result = await fetchMscStatus(target.ref)
    return { raw: result.payload, observedAt: result.fetchedAt }
  }

  if (target.provider === 'cmacgm') {
    const result = await fetchCmaCgmStatus(target.ref)
    return { raw: result.payload, observedAt: result.fetchedAt }
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

  return { raw: result.payload, observedAt: new Date().toISOString() }
}

async function ingestSnapshot(
  config: RuntimeConfig,
  target: AgentTarget,
  scrape: { readonly raw: unknown; readonly observedAt: string },
  agentVersion: string,
): Promise<void> {
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
    return
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

  console.log(`[agent] ingested ${target.ref} -> snapshot ${parsed.data.snapshot_id}`)
}

async function processTarget(
  config: RuntimeConfig,
  target: AgentTarget,
  agentVersion: string,
): Promise<void> {
  try {
    const scrape = await scrapeTarget(config, target)
    await ingestSnapshot(config, target, scrape, agentVersion)
  } catch (error) {
    console.error(`[agent] target ${target.sync_request_id} failed: ${toErrorMessage(error)}`)
    console.warn(
      `[agent] target ${target.sync_request_id} will be available again after lease expiration`,
    )
  }
}

async function runOnce(config: RuntimeConfig, agentVersion: string): Promise<void> {
  const leaseBatchSize = 1
  let processed = 0

  while (processed < config.LIMIT) {
    const remaining = config.LIMIT - processed
    const targets = await fetchTargets(config, Math.min(leaseBatchSize, remaining))
    if (targets.length === 0) {
      if (processed === 0) {
        console.log('[agent] no targets available')
      }
      break
    }

    for (const target of targets) {
      await processTarget(config, target, agentVersion)
      processed += 1
    }
  }

  if (processed > 0) {
    console.log(`[agent] cycle processed ${processed} target(s)`)
  }
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

function subscribeToRealtimeIfConfigured(command: {
  readonly config: RuntimeConfig
  readonly onWake: () => void
}): { readonly unsubscribe: () => void } | null {
  if (!command.config.SUPABASE_URL || !command.config.SUPABASE_ANON_KEY) {
    console.warn('[agent] realtime disabled: SUPABASE_URL/SUPABASE_ANON_KEY not configured')
    return null
  }

  try {
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
        if (status.state === 'SUBSCRIBED') {
          console.log('[agent] realtime subscribed for tenant sync requests')
          return
        }

        if (status.state === 'CHANNEL_ERROR' || status.state === 'TIMED_OUT') {
          console.warn('[agent] realtime channel degraded; interval sweep remains active', status)
        }
      },
    })
  } catch (error) {
    console.warn(
      `[agent] realtime setup failed; continuing with interval sweep only: ${toErrorMessage(error)}`,
    )
    return null
  }
}

async function main(): Promise<void> {
  const paths = resolvePathLayout()
  const runtimeConfig = await resolveRuntimeConfigWithBootstrap(paths)
  const agentVersion = resolveAgentVersion()

  console.log(
    `[agent] started (tenant=${runtimeConfig.TENANT_ID}, agent=${runtimeConfig.AGENT_ID}, interval=${runtimeConfig.INTERVAL_SEC}s)`,
  )

  const scheduler = createAgentScheduler({
    intervalMs: runtimeConfig.INTERVAL_SEC * 1000,
    runCycle: async (_reason) => {
      await runOnce(runtimeConfig, agentVersion)
    },
    onRunError({ reason, error }) {
      console.error(`[agent] cycle failed (reason=${reason}): ${toErrorMessage(error)}`)
    },
  })

  const realtimeSubscription = subscribeToRealtimeIfConfigured({
    config: runtimeConfig,
    onWake() {
      scheduler.triggerRun('realtime')
    },
  })

  scheduler.start()

  const shutdown = (signal: 'SIGINT' | 'SIGTERM') => {
    console.log(`[agent] received ${signal}, shutting down`)
    realtimeSubscription?.unsubscribe()
    scheduler.stop()
  }

  process.once('SIGINT', () => shutdown('SIGINT'))
  process.once('SIGTERM', () => shutdown('SIGTERM'))
}

void main().catch((error) => {
  console.error(`[agent] fatal startup error: ${toErrorMessage(error)}`)
  process.exitCode = 1
})
