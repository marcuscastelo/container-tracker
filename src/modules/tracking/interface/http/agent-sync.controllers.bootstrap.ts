import { z } from 'zod/v4'

import { bootstrapAgentMonitoringModule } from '~/modules/agent/infrastructure/bootstrap/agent.bootstrap'
import { containerUseCases } from '~/modules/container/infrastructure/bootstrap/container.bootstrap'
import { bootstrapTrackingModule } from '~/modules/tracking/infrastructure/bootstrap/tracking.bootstrap'
import {
  type AgentSyncControllers,
  createAgentSyncControllers,
} from '~/modules/tracking/interface/http/agent-sync.controllers'
import {
  type SyncRequestRow,
  SyncRequestRowSchema,
} from '~/modules/tracking/interface/http/agent-sync.schemas'
import { serverEnv } from '~/shared/config/server-env'
import { supabaseServer } from '~/shared/supabase/supabase.server'
import {
  unwrapSupabaseResultOrThrow,
  unwrapSupabaseSingleOrNull,
} from '~/shared/supabase/unwrapSupabaseResult'

const { trackingUseCases } = bootstrapTrackingModule()
const { agentMonitoringUseCases } = bootstrapAgentMonitoringModule()

const SyncRequestRowsSchema = z.array(SyncRequestRowSchema)

function parseSyncRequestRows(raw: unknown): readonly SyncRequestRow[] {
  return SyncRequestRowsSchema.parse(raw)
}

function parseSyncRequestRow(raw: unknown): SyncRequestRow {
  return SyncRequestRowSchema.parse(raw)
}

export function bootstrapAgentSyncControllers(): AgentSyncControllers {
  return createAgentSyncControllers({
    async leaseSyncRequests({
      tenantId,
      agentId,
      limit,
      leaseMinutes,
      includeOwnedActiveLeases,
      processableProviders,
    }) {
      const result = await supabaseServer.rpc('lease_sync_requests', {
        p_tenant_id: tenantId,
        p_agent_id: agentId,
        p_limit: limit,
        p_lease_minutes: leaseMinutes,
        p_include_owned_active_leases: includeOwnedActiveLeases,
        p_processable_providers: [...processableProviders],
      })

      const data = unwrapSupabaseResultOrThrow(result, {
        operation: 'lease_sync_requests',
        table: 'sync_requests',
      })

      return parseSyncRequestRows(data)
    },

    async findLeasedSyncRequest({ tenantId, syncRequestId, agentId }) {
      const result = await supabaseServer
        .from('sync_requests')
        .select('*')
        .eq('id', syncRequestId)
        .eq('tenant_id', tenantId)
        .eq('status', 'LEASED')
        .eq('leased_by', agentId)
        .gt('leased_until', new Date().toISOString())
        .maybeSingle()

      const data = unwrapSupabaseSingleOrNull(result, {
        operation: 'findLeasedSyncRequest',
        table: 'sync_requests',
      })

      if (!data) return null
      return parseSyncRequestRow(data)
    },

    async markSyncRequestDone({ tenantId, syncRequestId, agentId }) {
      const result = await supabaseServer
        .from('sync_requests')
        .update({
          status: 'DONE',
          leased_until: null,
          last_error: null,
        })
        .eq('id', syncRequestId)
        .eq('tenant_id', tenantId)
        .eq('status', 'LEASED')
        .eq('leased_by', agentId)
        .gt('leased_until', new Date().toISOString())
        .select('id')
        .maybeSingle()

      const data = unwrapSupabaseSingleOrNull(result, {
        operation: 'markSyncRequestDone',
        table: 'sync_requests',
      })

      return data !== null
    },

    async markSyncRequestFailed({ tenantId, syncRequestId, agentId, errorMessage }) {
      const result = await supabaseServer
        .from('sync_requests')
        .update({
          status: 'FAILED',
          leased_until: null,
          last_error: errorMessage,
        })
        .eq('id', syncRequestId)
        .eq('tenant_id', tenantId)
        .eq('status', 'LEASED')
        .eq('leased_by', agentId)
        .gt('leased_until', new Date().toISOString())
        .select('id')
        .maybeSingle()

      const data = unwrapSupabaseSingleOrNull(result, {
        operation: 'markSyncRequestFailed',
        table: 'sync_requests',
      })

      return data !== null
    },

    async findContainersByNumber({ containerNumbers }) {
      const result = await containerUseCases.findByNumbers({
        containerNumbers: [...containerNumbers],
      })

      return result.containers.map((container) => ({
        id: String(container.id),
        containerNumber: String(container.containerNumber),
        carrierCode: String(container.carrierCode),
      }))
    },

    async saveAndProcess({
      containerId,
      containerNumber,
      provider,
      payload,
      parseError,
      fetchedAt,
    }) {
      const result = await trackingUseCases.saveAndProcess(
        containerId,
        containerNumber,
        provider,
        payload,
        parseError ?? null,
        fetchedAt,
      )

      return {
        snapshotId: result.snapshot.id,
        newObservationsCount: result.pipeline.newObservations.length,
        newAlertsCount: result.pipeline.newAlerts.length,
      }
    },

    async authenticateAgentToken({ token }) {
      return agentMonitoringUseCases.authenticateAgentToken({ token })
    },

    async getTenantQueueLagSeconds({ tenantId }) {
      const result = await supabaseServer
        .from('sync_requests')
        .select('created_at')
        .eq('tenant_id', tenantId)
        .eq('status', 'PENDING')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()

      const data = unwrapSupabaseSingleOrNull(result, {
        operation: 'getTenantQueueLagSeconds',
        table: 'sync_requests',
      })

      if (!data?.created_at) return null
      const createdAt = new Date(data.created_at)
      if (Number.isNaN(createdAt.getTime())) return null

      return Math.max(0, Math.floor((Date.now() - createdAt.getTime()) / 1000))
    },

    async updateAgentRuntimeState(command) {
      await agentMonitoringUseCases.updateRuntimeState(command)
    },

    async recordAgentActivity(command) {
      await agentMonitoringUseCases.recordActivity(command)
    },
    leaseMinutes: serverEnv.AGENT_LEASE_MINUTES,
  })
}
