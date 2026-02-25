import os from 'node:os'
import process from 'node:process'
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

const envSchema = z.object({
  BACKEND_URL: z
    .string()
    .url()
    .transform((value) => value.replace(/\/+$/, '')),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  AGENT_TOKEN: z.string().min(1).optional(),
  TENANT_ID: z.string().uuid(),
  AGENT_ID: z.string().min(1).default(os.hostname()),
  INTERVAL_SEC: z.coerce.number().int().positive().default(60),
  LIMIT: z.coerce.number().int().min(1).max(100).default(10),
  MAERSK_HEADLESS: z
    .string()
    .optional()
    .transform((value) => value !== '0' && value !== 'false'),
  MAERSK_TIMEOUT_MS: z.coerce.number().int().positive().default(120000),
  MAERSK_USER_DATA_DIR: z.string().min(1).optional(),
})

const env = envSchema.parse({
  BACKEND_URL: process.env.BACKEND_URL,
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
  AGENT_TOKEN: process.env.AGENT_TOKEN,
  TENANT_ID: process.env.TENANT_ID,
  AGENT_ID: process.env.AGENT_ID,
  INTERVAL_SEC: process.env.INTERVAL_SEC,
  LIMIT: process.env.LIMIT,
  MAERSK_HEADLESS: process.env.MAERSK_HEADLESS,
  MAERSK_TIMEOUT_MS: process.env.MAERSK_TIMEOUT_MS,
  MAERSK_USER_DATA_DIR: process.env.MAERSK_USER_DATA_DIR,
})

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

function buildHeaders(contentType: boolean): Headers {
  const headers = new Headers()
  headers.set('x-agent-id', env.AGENT_ID)
  headers.set('user-agent', `container-tracker-agent/${env.AGENT_ID}`)

  if (contentType) {
    headers.set('content-type', 'application/json')
  }

  if (env.AGENT_TOKEN) {
    headers.set('authorization', `Bearer ${env.AGENT_TOKEN}`)
  }

  return headers
}

async function fetchTargets(): Promise<readonly AgentTarget[]> {
  const url = new URL('/api/agent/targets', env.BACKEND_URL)
  url.searchParams.set('tenant_id', env.TENANT_ID)
  url.searchParams.set('limit', String(env.LIMIT))

  const response = await fetch(url, {
    method: 'GET',
    headers: buildHeaders(false),
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
const supabaseRealtime = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
  db: {
    schema: 'public',
  },
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
})

async function scrapeTarget(target: AgentTarget): Promise<{ raw: unknown; observedAt: string }> {
  if (target.provider === 'msc') {
    const result = await fetchMscStatus(target.ref)
    return { raw: result.payload, observedAt: result.fetchedAt }
  }

  if (target.provider === 'cmacgm') {
    const result = await fetchCmaCgmStatus(target.ref)
    return { raw: result.payload, observedAt: result.fetchedAt }
  }

  const result = await maerskCaptureService.capture({
    container: target.ref,
    headless: env.MAERSK_HEADLESS,
    hold: false,
    timeoutMs: env.MAERSK_TIMEOUT_MS,
    userDataDir: env.MAERSK_USER_DATA_DIR ?? null,
  })

  if (result.kind === 'error') {
    throw new Error(`maersk capture failed: ${JSON.stringify(result.body)}`)
  }

  return { raw: result.payload, observedAt: new Date().toISOString() }
}

async function ingestSnapshot(target: AgentTarget, scrape: { raw: unknown; observedAt: string }) {
  const response = await fetch(`${env.BACKEND_URL}/api/tracking/snapshots/ingest`, {
    method: 'POST',
    headers: buildHeaders(true),
    body: JSON.stringify({
      tenant_id: env.TENANT_ID,
      provider: target.provider,
      ref: {
        type: 'container',
        value: target.ref,
      },
      observed_at: scrape.observedAt,
      raw: scrape.raw,
      meta: {
        agent_version: 'mvp-0.1',
        host: env.AGENT_ID,
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

async function runOnce(): Promise<void> {
  const targets = await fetchTargets()
  if (targets.length === 0) {
    console.log('[agent] no targets available')
    return
  }

  console.log(`[agent] received ${targets.length} target(s)`)
  for (const target of targets) {
    try {
      const scrape = await scrapeTarget(target)
      await ingestSnapshot(target, scrape)
    } catch (error) {
      console.error(`[agent] target ${target.sync_request_id} failed:`, error)
      console.warn(
        `[agent] target ${target.sync_request_id} will be available again after lease expiration`,
      )
    }
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

async function main(): Promise<void> {
  console.log(
    `[agent] started (tenant=${env.TENANT_ID}, agent=${env.AGENT_ID}, interval=${env.INTERVAL_SEC}s)`,
  )

  const scheduler = createAgentScheduler({
    intervalMs: env.INTERVAL_SEC * 1000,
    runCycle: async (_reason) => {
      await runOnce()
    },
    onRunError({ reason, error }) {
      console.error(`[agent] cycle failed (reason=${reason}):`, error)
    },
  })

  const realtimeSubscription = subscribeSyncRequestsByTenant({
    client: supabaseRealtime,
    tenantId: env.TENANT_ID,
    onEvent(event) {
      if (!shouldWakeForRealtimeEvent(event)) {
        return
      }

      scheduler.triggerRun('realtime')
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

  scheduler.start()

  const shutdown = (signal: 'SIGINT' | 'SIGTERM') => {
    console.log(`[agent] received ${signal}, shutting down`)
    realtimeSubscription.unsubscribe()
    scheduler.stop()
  }

  process.once('SIGINT', () => shutdown('SIGINT'))
  process.once('SIGTERM', () => shutdown('SIGTERM'))
}

void main()
