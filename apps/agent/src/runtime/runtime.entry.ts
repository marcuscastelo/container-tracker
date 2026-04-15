import { createHash } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import {
  consumeBootstrapConfig,
  readBootstrapConfigFromEnv,
} from '@agent/config/infrastructure/bootstrap-config.repository'
import {
  readRuntimeConfigFromEnv,
  writeRuntimeConfigToEnv,
} from '@agent/config/infrastructure/env-config.repository'
import {
  acknowledgeRemoteCommand,
  applyRemoteCommand,
  type ControlRuntimeConfig,
  syncAgentControlState,
} from '@agent/control-core/agent-control-core'
import { publishAgentControlPublicSnapshot } from '@agent/control-core/public-control-files'
import {
  type ValidatedAgentConfig,
  ValidatedAgentConfigSchema,
  type ValidatedBootstrapConfig,
} from '@agent/core/contracts/agent-config.contract'
import {
  type AgentSyncJob,
  BackendSyncTargetsResponseDTOSchema,
  IngestAcceptedResponseSchema,
  IngestFailedResponseSchema,
} from '@agent/core/contracts/sync-job.contract'
import { BoundaryValidationError } from '@agent/core/errors/boundary-validation.error'
import { toHeartbeatPayload } from '@agent/observability/observability.mapper'
import { writeRuntimeHealth } from '@agent/runtime/infrastructure/runtime-health.repository'
import {
  clearSupervisorControl,
  readSupervisorControl,
  writeSupervisorControl,
} from '@agent/runtime/infrastructure/supervisor-control.repository'
import {
  toAgentSyncJob,
  toBackendSyncAck,
  toBackendSyncFailure,
  toProviderInput,
} from '@agent/sync/sync-job.mapper'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod/v4'
// biome-ignore lint/style/noRestrictedImports: Agent runtime uses Node --experimental-strip-types with direct .ts imports.
import { fetchCmaCgmStatus } from '../../../../src/modules/tracking/infrastructure/carriers/fetchers/cmacgm.fetcher.ts'
// biome-ignore lint/style/noRestrictedImports: Agent runtime uses Node --experimental-strip-types with direct .ts imports.
import { createMaerskCaptureService } from '../../../../src/modules/tracking/infrastructure/carriers/fetchers/maersk.puppeteer.fetcher.ts'
// biome-ignore lint/style/noRestrictedImports: Agent runtime uses Node --experimental-strip-types with direct .ts imports.
import { fetchMscStatus } from '../../../../src/modules/tracking/infrastructure/carriers/fetchers/msc.fetcher.ts'
// biome-ignore lint/style/noRestrictedImports: Agent runtime uses Node --experimental-strip-types with direct .ts imports.
import { fetchOneStatus } from '../../../../src/modules/tracking/infrastructure/carriers/fetchers/one.fetcher.ts'
// biome-ignore lint/style/noRestrictedImports: Agent runtime uses Node --experimental-strip-types with direct .ts imports.
import { fetchPilStatus } from '../../../../src/modules/tracking/infrastructure/carriers/fetchers/pil.fetcher.ts'
// biome-ignore lint/style/noRestrictedImports: Agent runtime uses Node --experimental-strip-types with direct .ts imports.
import type { SyncRequestsRealtimeStatusUpdate } from '../../../../src/shared/supabase/sync-requests.realtime.ts'
// biome-ignore lint/style/noRestrictedImports: Agent runtime uses Node --experimental-strip-types with direct .ts imports.
import { subscribeSyncRequestsByTenant } from '../../../../src/shared/supabase/sync-requests.realtime.ts'
// biome-ignore lint/style/noRestrictedImports: Agent runtime uses Node --experimental-strip-types with direct .ts imports.
import { type AgentRunReason, createAgentScheduler } from '../agent.scheduler.ts'
// biome-ignore lint/style/noRestrictedImports: Agent runtime uses Node --experimental-strip-types with direct .ts imports.
import { computeBackoffDelayMs } from '../backoff.ts'
// biome-ignore lint/style/noRestrictedImports: Agent runtime uses Node --experimental-strip-types with direct .ts imports.
import { createAgentLogForwarder } from '../log-forwarder.ts'
// biome-ignore lint/style/noRestrictedImports: Agent runtime uses Node --experimental-strip-types with direct .ts imports.
import { drainPendingActivityEvents } from '../pending-activity.ts'
// biome-ignore lint/style/noRestrictedImports: Agent runtime uses Node --experimental-strip-types with direct .ts imports.
import type { AgentPathLayout } from '../runtime-paths.ts'
// biome-ignore lint/style/noRestrictedImports: Agent runtime uses Node --experimental-strip-types with direct .ts imports.
// biome-ignore lint/performance/noNamespaceImport: Runtime keeps grouped imports stable to avoid formatter wrapping regressions.
import * as runtimePaths from '../runtime-paths.ts'
// biome-ignore lint/style/noRestrictedImports: Agent runtime uses Node --experimental-strip-types with direct .ts imports.
import { EXIT_FATAL, EXIT_UPDATE_RESTART } from './lifecycle-exit-codes.ts'

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

type RuntimeConfig = ValidatedAgentConfig
type BootstrapConfig = ValidatedBootstrapConfig

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
  return ValidatedAgentConfigSchema.parse({
    BACKEND_URL: config.BACKEND_URL,
    SUPABASE_URL: config.SUPABASE_URL,
    SUPABASE_ANON_KEY: config.SUPABASE_ANON_KEY,
    AGENT_TOKEN: config.AGENT_TOKEN,
    TENANT_ID: config.TENANT_ID,
    AGENT_ID: config.AGENT_ID,
    INTERVAL_SEC: config.INTERVAL_SEC,
    LIMIT: config.LIMIT,
    MAERSK_ENABLED: config.MAERSK_ENABLED,
    MAERSK_HEADLESS: config.MAERSK_HEADLESS,
    MAERSK_TIMEOUT_MS: config.MAERSK_TIMEOUT_MS,
    MAERSK_USER_DATA_DIR: config.MAERSK_USER_DATA_DIR,
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
  void publishAgentControlPublicSnapshot({
    filePath: command.layout.publicStatePath,
    backendStatePath: command.layout.publicBackendStatePath,
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

type PathLayout = AgentPathLayout

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
  return ValidatedAgentConfigSchema.parse({
    BACKEND_URL: command.bootstrapConfig.BACKEND_URL,
    SUPABASE_URL: command.enrollResponse.supabaseUrl ?? null,
    SUPABASE_ANON_KEY: command.enrollResponse.supabaseAnonKey ?? null,
    AGENT_TOKEN: command.enrollResponse.agentToken,
    TENANT_ID: command.enrollResponse.tenantId,
    AGENT_ID: command.bootstrapConfig.AGENT_ID,
    INTERVAL_SEC: command.enrollResponse.intervalSec,
    LIMIT: command.enrollResponse.limit,
    MAERSK_ENABLED: command.enrollResponse.providers.maerskEnabled,
    MAERSK_HEADLESS: command.enrollResponse.providers.maerskHeadless,
    MAERSK_TIMEOUT_MS: command.enrollResponse.providers.maerskTimeoutMs,
    MAERSK_USER_DATA_DIR: command.enrollResponse.providers.maerskUserDataDir ?? null,
    AGENT_UPDATE_MANIFEST_CHANNEL: command.bootstrapConfig.AGENT_UPDATE_MANIFEST_CHANNEL,
  })
}

async function resolveRuntimeConfigWithBootstrap(paths: PathLayout): Promise<RuntimeConfig> {
  let enrollAttempt = 0

  for (;;) {
    try {
      const existingConfig = readRuntimeConfigFromEnv({
        paths,
      })
      if (existingConfig) {
        return existingConfig
      }
    } catch (error) {
      if (error instanceof BoundaryValidationError) {
        console.warn(`[agent] config.env is invalid, switching to bootstrap mode: ${error.details}`)
      } else {
        console.warn(
          `[agent] config.env is invalid, switching to bootstrap mode: ${toErrorMessage(error)}`,
        )
      }
    }

    let bootstrapLoaded: { readonly config: BootstrapConfig; readonly raw: string } | null = null
    try {
      bootstrapLoaded = readBootstrapConfigFromEnv({
        paths,
      })
      if (!bootstrapLoaded) {
        throw new Error(`bootstrap.env not found at ${paths.bootstrapEnvPath}`)
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

      writeRuntimeConfigToEnv({
        paths,
        config: runtimeConfig,
      })
      consumeBootstrapConfig({
        paths,
        config: bootstrapLoaded.config,
        rawContent: bootstrapLoaded.raw,
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

const HeartbeatAckResponseSchema = z.object({
  ok: z.literal(true).optional(),
  updatedAt: z.string().datetime({ offset: true }).optional(),
  updated_at: z.string().datetime({ offset: true }).optional(),
})

type AgentTarget = AgentSyncJob

type TargetsResponse = {
  readonly targets: readonly AgentTarget[]
  readonly leasedUntil: string | null
  readonly queueLagSeconds: number | null
}

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

function resolveAgentCapabilities(
  config: RuntimeConfig,
): Array<'maersk' | 'msc' | 'cmacgm' | 'pil' | 'one'> {
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
  const payload = toHeartbeatPayload({
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
      occurred_at: event.occurredAt ?? null,
    })),
  })

  const response = await fetch(`${command.config.BACKEND_URL}/api/agent/heartbeat`, {
    method: 'POST',
    headers: buildHeaders(command.config, true),
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const details = await response.text().catch(() => '')
    throw new Error(`heartbeat failed (${response.status}): ${details}`)
  }

  const responsePayload: unknown = await response.json().catch(() => ({}))
  const parsed = HeartbeatAckResponseSchema.safeParse(responsePayload)
  if (!parsed.success) {
    throw new Error(`invalid heartbeat response: ${parsed.error.message}`)
  }

  const updatedAt = parsed.data.updatedAt ?? parsed.data.updated_at ?? new Date().toISOString()
  return updatedAt
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
  const parsed = BackendSyncTargetsResponseDTOSchema.safeParse(payload)
  if (!parsed.success) {
    throw new Error(`invalid targets response: ${parsed.error.message}`)
  }

  return {
    targets: parsed.data.targets.map((target) => toAgentSyncJob(target)),
    leasedUntil: parsed.data.leased_until,
    queueLagSeconds: parsed.data.queue_lag_seconds,
  }
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
  const providerInput = toProviderInput(target)

  if (providerInput.provider === 'msc') {
    const result = await fetchMscStatus(providerInput.ref)
    return {
      raw: result.payload,
      observedAt: result.fetchedAt,
      parseError: result.parseError ?? null,
    }
  }

  if (providerInput.provider === 'cmacgm') {
    const result = await fetchCmaCgmStatus(providerInput.ref)
    return {
      raw: result.payload,
      observedAt: result.fetchedAt,
      parseError: result.parseError ?? null,
    }
  }

  if (providerInput.provider === 'pil') {
    const result = await fetchPilStatus(providerInput.ref)
    return {
      raw: result.payload,
      observedAt: result.fetchedAt,
      parseError: result.parseError ?? null,
    }
  }

  if (providerInput.provider === 'one') {
    const result = await fetchOneStatus(providerInput.ref)
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
    container: providerInput.ref,
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
  | {
      readonly kind: 'accepted'
      readonly snapshotId: string
      readonly newObservationsCount: number | null
      readonly newAlertsCount: number | null
    }
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
      sync_request_id: target.syncRequestId,
    }),
  })

  if (response.status === 409) {
    const body = await response.json().catch(() => ({}))
    console.warn(`[agent] lease conflict for ${target.syncRequestId}:`, body)
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
  return {
    kind: 'accepted',
    snapshotId: parsed.data.snapshot_id,
    newObservationsCount: parsed.data.new_observations_count ?? null,
    newAlertsCount: parsed.data.new_alerts_count ?? null,
  }
}

type ProcessTargetResult =
  | {
      readonly kind: 'success'
      readonly durationMs: number
      readonly snapshotId: string
      readonly backendAck: ReturnType<typeof toBackendSyncAck>
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
      readonly backendFailure: ReturnType<typeof toBackendSyncFailure>
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
        errorMessage: `Lease conflict for ${target.syncRequestId}`,
      }
    }

    if (ingestResult.kind === 'failed') {
      const backendFailure = toBackendSyncFailure({
        job: target,
        errorMessage: ingestResult.errorMessage,
        occurredAt: new Date().toISOString(),
        snapshotId: ingestResult.snapshotId ?? null,
      })
      return {
        kind: 'failed',
        durationMs: Math.max(0, Date.now() - startedAtMs),
        errorMessage: ingestResult.errorMessage,
        backendFailure,
        ...(ingestResult.snapshotId === undefined ? {} : { snapshotId: ingestResult.snapshotId }),
      }
    }

    const backendAck = toBackendSyncAck({
      job: target,
      snapshotId: ingestResult.snapshotId,
      occurredAt: new Date().toISOString(),
      newObservationsCount: ingestResult.newObservationsCount,
      newAlertsCount: ingestResult.newAlertsCount,
    })

    return {
      kind: 'success',
      durationMs: Math.max(0, Date.now() - startedAtMs),
      snapshotId: ingestResult.snapshotId,
      backendAck,
    }
  } catch (error) {
    const message = toErrorMessage(error)
    console.error(`[agent] target ${target.syncRequestId} failed: ${message}`)
    console.warn(
      `[agent] target ${target.syncRequestId} will be available again after lease expiration`,
    )

    const backendFailure = toBackendSyncFailure({
      job: target,
      errorMessage: message,
      occurredAt: new Date().toISOString(),
      snapshotId: null,
    })

    return {
      kind: 'failed',
      durationMs: Math.max(0, Date.now() - startedAtMs),
      errorMessage: message,
      backendFailure,
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

    state.queueLagSeconds = targetsResponse.queueLagSeconds

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
            syncRequestId: target.syncRequestId,
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
        message: result.backendFailure.error,
        severity: 'danger',
        metadata: {
          ...result.backendFailure,
          durationMs: result.durationMs,
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

async function main(): Promise<void> {
  const agentLayout = runtimePaths.resolveAgentPathLayout()
  runtimePaths.ensureAgentPathLayout(agentLayout)
  let runtimeConfig = await resolveRuntimeConfigWithBootstrap(agentLayout)
  let controlSync = await syncControlStateAndPersistPublicState({
    layout: agentLayout,
    currentConfig: toControlRuntimeConfig(runtimeConfig),
  })
  runtimeConfig = toRuntimeConfigFromControlConfig(controlSync.effectiveConfig)
  const agentVersion = resolveAgentVersion()

  console.log(
    `[agent] started (tenant=${runtimeConfig.TENANT_ID}, agent=${runtimeConfig.AGENT_ID}, interval=${runtimeConfig.INTERVAL_SEC}s)`,
  )

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
    statePath: agentLayout.agentLogForwarderStatePath,
  })
  logForwarder.start()

  const pendingActivities = drainPendingActivityEvents(agentLayout.pendingActivityPath).map(
    toRuntimeActivityFromPending,
  )
  await sendHeartbeatAndPersistHealth({
    config: runtimeConfig,
    agentVersion,
    state: runtimeState,
    activity: pendingActivities,
    healthPath: agentLayout.runtimeStatePath,
  })
  controlSync = await syncControlStateAndPersistPublicState({
    layout: agentLayout,
    currentConfig: toControlRuntimeConfig(runtimeConfig),
    forceRemoteFetch: false,
  })
  runtimeConfig = toRuntimeConfigFromControlConfig(controlSync.effectiveConfig)

  let lastRealtimeSignalFingerprint: string | null = null
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
      runtimeState.desiredVersion = controlSync.remotePolicy.desiredVersion
      runtimeState.updateReadyVersion = controlSync.releaseState.target_version

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
          writeSupervisorControl(agentLayout.supervisorControlPath, {
            drain_requested: true,
            reason: 'restart',
            requested_at: pendingRemoteCommand.requestedAt,
          })
        }
      }

      const controlState = readSupervisorControl(agentLayout.supervisorControlPath)
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
        healthPath: agentLayout.runtimeStatePath,
      })
      controlSync = await syncControlStateAndPersistPublicState({
        layout: agentLayout,
        currentConfig: toControlRuntimeConfig(runtimeConfig),
        forceRemoteFetch: false,
      })
      runtimeConfig = toRuntimeConfigFromControlConfig(controlSync.effectiveConfig)

      if (requestRestartAfterHeartbeat && runtimeState.activeJobs === 0) {
        writeSupervisorControl(agentLayout.supervisorControlPath, {
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
        healthPath: agentLayout.runtimeStatePath,
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
          healthPath: agentLayout.runtimeStatePath,
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
          healthPath: agentLayout.runtimeStatePath,
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
      healthPath: agentLayout.runtimeStatePath,
    })
    realtimeSubscription?.unsubscribe()
    scheduler?.stop()
    void logForwarder.stop().catch((error) => {
      console.warn(`[agent] log forwarder stop failed: ${toErrorMessage(error)}`)
    })
    clearSupervisorControl(agentLayout.supervisorControlPath)
  }

  process.once('SIGINT', () => shutdown('SIGINT'))
  process.once('SIGTERM', () => shutdown('SIGTERM'))
}

void main().catch((error) => {
  console.error(`[agent] fatal startup error: ${toErrorMessage(error)}`)
  process.exitCode = EXIT_FATAL
})
