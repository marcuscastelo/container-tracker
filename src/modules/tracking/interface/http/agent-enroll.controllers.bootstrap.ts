import { z } from 'zod/v4'

import { bootstrapAgentMonitoringModule } from '~/modules/agent/infrastructure/bootstrap/agent.bootstrap'
import {
  type AgentEnrollControllers,
  createAgentEnrollControllers,
} from '~/modules/tracking/interface/http/agent-enroll.controllers'
import { serverEnv } from '~/shared/config/server-env'
import { supabaseServer } from '~/shared/supabase/supabase.server'
import {
  unwrapSupabaseResultOrThrow,
  unwrapSupabaseSingleOrNull,
} from '~/shared/supabase/unwrapSupabaseResult'

const InstallerTokenRowSchema = z.object({
  tenant_id: z.string().uuid(),
  token_hash: z.string().min(1),
  revoked_at: z.string().nullable(),
  expires_at: z.string().nullable(),
})

const TrackingAgentRowSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  machine_fingerprint: z.string().min(1),
  hostname: z.string().min(1),
  os: z.string().min(1),
  agent_version: z.string().min(1),
  agent_token: z.string().min(1),
  interval_sec: z.number().int().positive(),
  max_concurrent: z.number().int().min(1).max(100),
  supabase_url: z.string().nullable(),
  supabase_anon_key: z.string().nullable(),
  maersk_enabled: z.boolean(),
  maersk_headless: z.boolean(),
  maersk_timeout_ms: z.number().int().positive(),
  maersk_user_data_dir: z.string().nullable(),
})

const { agentMonitoringUseCases } = bootstrapAgentMonitoringModule()

function maskAgentToken(token: string): string {
  if (token.length <= 8) return `tok_${token}`
  return `tok_${token.slice(0, 4)}...${token.slice(-4)}`
}

function toDefaultCapabilities(maerskEnabled: boolean): readonly string[] {
  if (maerskEnabled) return ['msc', 'cmacgm', 'maersk']
  return ['msc', 'cmacgm']
}

type RateLimitBucket = {
  readonly timestampsMs: number[]
}

function createInMemoryRateLimitGuard(command: {
  readonly maxRequests: number
  readonly windowSeconds: number
}): { readonly isRateLimited: (ipAddress: string) => boolean } {
  const bucketsByIp = new Map<string, RateLimitBucket>()
  const windowMs = command.windowSeconds * 1000
  const cleanupIntervalMs = Math.max(windowMs, 30000)
  let lastCleanupAtMs = 0

  function cleanupExpiredBuckets(nowMs: number): void {
    if (nowMs - lastCleanupAtMs < cleanupIntervalMs) {
      return
    }

    const cutoffMs = nowMs - windowMs
    for (const [ipAddress, bucket] of bucketsByIp) {
      const activeTimestamps = bucket.timestampsMs.filter((value) => value >= cutoffMs)
      if (activeTimestamps.length === 0) {
        bucketsByIp.delete(ipAddress)
        continue
      }

      bucketsByIp.set(ipAddress, { timestampsMs: activeTimestamps })
    }

    lastCleanupAtMs = nowMs
  }

  return {
    isRateLimited(ipAddress: string): boolean {
      const nowMs = Date.now()
      cleanupExpiredBuckets(nowMs)

      const cutoff = nowMs - windowMs
      const existingBucket = bucketsByIp.get(ipAddress)
      const timestampsMs = (existingBucket?.timestampsMs ?? []).filter((value) => value >= cutoff)

      if (timestampsMs.length >= command.maxRequests) {
        bucketsByIp.set(ipAddress, { timestampsMs })
        return true
      }

      timestampsMs.push(nowMs)
      bucketsByIp.set(ipAddress, { timestampsMs })
      return false
    },
  }
}

const enrollRateLimitGuard = createInMemoryRateLimitGuard({
  maxRequests: serverEnv.AGENT_ENROLL_RATE_LIMIT_MAX_REQUESTS,
  windowSeconds: serverEnv.AGENT_ENROLL_RATE_LIMIT_WINDOW_SEC,
})

function mapTrackingAgentRow(row: z.infer<typeof TrackingAgentRowSchema>) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    machineFingerprint: row.machine_fingerprint,
    hostname: row.hostname,
    os: row.os,
    agentVersion: row.agent_version,
    agentToken: row.agent_token,
    intervalSec: row.interval_sec,
    limit: row.max_concurrent,
    supabaseUrl: row.supabase_url,
    supabaseAnonKey: row.supabase_anon_key,
    maerskEnabled: row.maersk_enabled,
    maerskHeadless: row.maersk_headless,
    maerskTimeoutMs: row.maersk_timeout_ms,
    maerskUserDataDir: row.maersk_user_data_dir,
  }
}

export function bootstrapAgentEnrollControllers(): AgentEnrollControllers {
  return createAgentEnrollControllers({
    async findInstallerTokenByHash({ tokenHash }) {
      const result = await supabaseServer
        .from('agent_install_tokens')
        .select('tenant_id,token_hash,revoked_at,expires_at')
        .eq('token_hash', tokenHash)
        .maybeSingle()

      const data = unwrapSupabaseSingleOrNull(result, {
        operation: 'findInstallerTokenByHash',
        table: 'agent_install_tokens',
      })

      if (!data) return null
      const row = InstallerTokenRowSchema.parse(data)

      return {
        tenantId: row.tenant_id,
        tokenHash: row.token_hash,
        revokedAt: row.revoked_at,
        expiresAt: row.expires_at,
      }
    },

    async findAgentByFingerprint({ tenantId, machineFingerprint }) {
      const result = await supabaseServer
        .from('tracking_agents')
        .select(
          'id,tenant_id,machine_fingerprint,hostname,os,agent_version,agent_token,interval_sec,max_concurrent,supabase_url,supabase_anon_key,maersk_enabled,maersk_headless,maersk_timeout_ms,maersk_user_data_dir',
        )
        .eq('tenant_id', tenantId)
        .eq('machine_fingerprint', machineFingerprint)
        .is('revoked_at', null)
        .maybeSingle()

      const data = unwrapSupabaseSingleOrNull(result, {
        operation: 'findAgentByFingerprint',
        table: 'tracking_agents',
      })

      if (!data) return null
      const row = TrackingAgentRowSchema.parse(data)
      return mapTrackingAgentRow(row)
    },

    async createAgent({ tenantId, machineFingerprint, hostname, os, agentVersion, agentToken }) {
      const maerskEnabled = serverEnv.AGENT_ENROLL_DEFAULT_MAERSK_ENABLED
      const result = await supabaseServer
        .from('tracking_agents')
        .insert({
          tenant_id: tenantId,
          machine_fingerprint: machineFingerprint,
          hostname,
          os,
          agent_version: agentVersion,
          current_version: agentVersion,
          desired_version: agentVersion,
          agent_token: agentToken,
          interval_sec: serverEnv.AGENT_ENROLL_DEFAULT_INTERVAL_SEC,
          max_concurrent: serverEnv.AGENT_ENROLL_DEFAULT_LIMIT,
          supabase_url: serverEnv.AGENT_ENROLL_SUPABASE_URL ?? null,
          supabase_anon_key: serverEnv.AGENT_ENROLL_SUPABASE_ANON_KEY ?? null,
          maersk_enabled: maerskEnabled,
          maersk_headless: serverEnv.AGENT_ENROLL_DEFAULT_MAERSK_HEADLESS,
          maersk_timeout_ms: serverEnv.AGENT_ENROLL_DEFAULT_MAERSK_TIMEOUT_MS,
          maersk_user_data_dir: serverEnv.AGENT_ENROLL_DEFAULT_MAERSK_USER_DATA_DIR ?? null,
          last_enrolled_at: new Date().toISOString(),
          last_seen_at: new Date().toISOString(),
          status: 'CONNECTED',
          realtime_state: 'CONNECTING',
          processing_state: 'idle',
          lease_health: 'unknown',
          active_jobs: 0,
          capabilities: toDefaultCapabilities(maerskEnabled),
          enrollment_method: 'bootstrap-token',
          token_id_masked: maskAgentToken(agentToken),
          last_error: null,
          queue_lag_seconds: null,
          update_channel: 'stable',
          updater_state: 'idle',
          updater_last_checked_at: null,
          updater_last_error: null,
          update_ready_version: null,
          restart_requested_at: null,
          boot_status: 'starting',
        })
        .select(
          'id,tenant_id,machine_fingerprint,hostname,os,agent_version,agent_token,interval_sec,max_concurrent,supabase_url,supabase_anon_key,maersk_enabled,maersk_headless,maersk_timeout_ms,maersk_user_data_dir,status,enrolled_at,last_seen_at,realtime_state,processing_state,lease_health,active_jobs,capabilities,enrollment_method,token_id_masked,last_error,queue_lag_seconds',
        )
        .single()

      const data = unwrapSupabaseResultOrThrow(result, {
        operation: 'createAgent',
        table: 'tracking_agents',
      })

      const row = TrackingAgentRowSchema.parse(data)
      return mapTrackingAgentRow(row)
    },

    async updateAgentEnrollmentMetadata({
      agentId,
      tenantId,
      machineFingerprint,
      hostname,
      os,
      agentVersion,
    }) {
      const maerskEnabled = serverEnv.AGENT_ENROLL_DEFAULT_MAERSK_ENABLED
      const result = await supabaseServer
        .from('tracking_agents')
        .update({
          hostname,
          os,
          agent_version: agentVersion,
          current_version: agentVersion,
          desired_version: agentVersion,
          interval_sec: serverEnv.AGENT_ENROLL_DEFAULT_INTERVAL_SEC,
          max_concurrent: serverEnv.AGENT_ENROLL_DEFAULT_LIMIT,
          supabase_url: serverEnv.AGENT_ENROLL_SUPABASE_URL ?? null,
          supabase_anon_key: serverEnv.AGENT_ENROLL_SUPABASE_ANON_KEY ?? null,
          maersk_enabled: maerskEnabled,
          maersk_headless: serverEnv.AGENT_ENROLL_DEFAULT_MAERSK_HEADLESS,
          maersk_timeout_ms: serverEnv.AGENT_ENROLL_DEFAULT_MAERSK_TIMEOUT_MS,
          maersk_user_data_dir: serverEnv.AGENT_ENROLL_DEFAULT_MAERSK_USER_DATA_DIR ?? null,
          last_enrolled_at: new Date().toISOString(),
          enrolled_at: new Date().toISOString(),
          last_seen_at: new Date().toISOString(),
          status: 'CONNECTED',
          realtime_state: 'CONNECTING',
          processing_state: 'idle',
          lease_health: 'unknown',
          active_jobs: 0,
          capabilities: toDefaultCapabilities(maerskEnabled),
          enrollment_method: 'bootstrap-token',
          last_error: null,
          queue_lag_seconds: null,
          update_channel: 'stable',
          updater_state: 'idle',
          updater_last_checked_at: null,
          updater_last_error: null,
          update_ready_version: null,
          restart_requested_at: null,
          boot_status: 'starting',
        })
        .eq('id', agentId)
        .eq('tenant_id', tenantId)
        .eq('machine_fingerprint', machineFingerprint)
        .select(
          'id,tenant_id,machine_fingerprint,hostname,os,agent_version,agent_token,interval_sec,max_concurrent,supabase_url,supabase_anon_key,maersk_enabled,maersk_headless,maersk_timeout_ms,maersk_user_data_dir,status,enrolled_at,last_seen_at,realtime_state,processing_state,lease_health,active_jobs,capabilities,enrollment_method,token_id_masked,last_error,queue_lag_seconds',
        )
        .single()

      const data = unwrapSupabaseResultOrThrow(result, {
        operation: 'updateAgentEnrollmentMetadata',
        table: 'tracking_agents',
      })

      const row = TrackingAgentRowSchema.parse(data)
      return mapTrackingAgentRow(row)
    },

    async emitAuditEvent(event) {
      const result = await supabaseServer
        .from('agent_enrollment_audit_events')
        .insert({
          event_type: event.eventType,
          status_code: event.statusCode,
          tenant_id: event.tenantId,
          machine_fingerprint: event.machineFingerprint,
          hostname: event.hostname,
          ip_address: event.ipAddress,
          reason: event.reason,
        })
        .select('id')
        .single()

      unwrapSupabaseResultOrThrow(result, {
        operation: 'emitAuditEvent',
        table: 'agent_enrollment_audit_events',
      })
    },

    isRateLimited({ ipAddress }) {
      return enrollRateLimitGuard.isRateLimited(ipAddress)
    },

    async recordAgentActivity(command) {
      await agentMonitoringUseCases.recordActivity(command)
    },
  })
}
