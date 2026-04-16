import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { AgentPathLayout } from '@agent/config/config.contract'
import {
  ControlRuntimeConfigSchema,
  syncAgentControlState,
} from '@agent/control-core/agent-control-core'
import {
  buildAgentControlPaths,
  buildAgentReleaseInventory,
  readAgentControlPublicState,
  writeAgentControlPublicState,
} from '@agent/control-core/public-control-state'
import { createInitialReleaseState } from '@agent/release/domain/release-state'
import { writeReleaseState } from '@agent/release/infrastructure/release-state.file-repository'
import { writeRuntimeState } from '@agent/runtime/infrastructure/runtime-state.repository'
import { describe, expect, it } from 'vitest'

function createLayout(baseDir: string): AgentPathLayout {
  const layout: AgentPathLayout = {
    dataDir: baseDir,
    configEnvPath: path.join(baseDir, 'config.env'),
    baseRuntimeConfigPath: path.join(baseDir, 'control-base.runtime.json'),
    bootstrapEnvPath: path.join(baseDir, 'bootstrap.env'),
    consumedBootstrapEnvPath: path.join(baseDir, 'bootstrap.env.consumed'),
    releasesDir: path.join(baseDir, 'releases'),
    downloadsDir: path.join(baseDir, 'downloads'),
    logsDir: path.join(baseDir, 'logs'),
    currentPath: path.join(baseDir, 'current'),
    previousPath: path.join(baseDir, 'previous'),
    releaseStatePath: path.join(baseDir, 'release-state.json'),
    runtimeStatePath: path.join(baseDir, 'runtime-state.json'),
    supervisorControlPath: path.join(baseDir, 'supervisor-control.json'),
    pendingActivityPath: path.join(baseDir, 'pending-activity-events.json'),
    controlOverridesPath: path.join(baseDir, 'control-overrides.local.json'),
    controlRemoteCachePath: path.join(baseDir, 'control-remote-cache.json'),
    infraConfigPath: path.join(baseDir, 'infra-config.json'),
    auditLogPath: path.join(baseDir, 'agent-control-audit.ndjson'),
  }

  fs.mkdirSync(layout.releasesDir, { recursive: true })
  fs.mkdirSync(layout.downloadsDir, { recursive: true })
  fs.mkdirSync(layout.logsDir, { recursive: true })
  return layout
}

describe('agent control public state', () => {
  it('writes a sanitized public control state without leaking runtime secrets', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-public-state-'))
    const layout = createLayout(tempDir)
    const publicStatePath = path.join(tempDir, 'run', 'control-ui-state.json')
    const secretAgentToken = 'agent-token-secret'
    const secretSupabaseAnonKey = 'supabase-anon-secret'

    const currentConfig = ControlRuntimeConfigSchema.parse({
      BACKEND_URL: 'https://backend.test.local',
      SUPABASE_URL: 'https://supabase.test.local',
      SUPABASE_ANON_KEY: secretSupabaseAnonKey,
      AGENT_TOKEN: secretAgentToken,
      TENANT_ID: '00000000-0000-4000-8000-000000000001',
      AGENT_ID: '11111111-1111-4111-8111-111111111111',
      INTERVAL_SEC: 60,
      LIMIT: 10,
      MAERSK_ENABLED: false,
      MAERSK_HEADLESS: true,
      MAERSK_TIMEOUT_MS: 120000,
      MAERSK_USER_DATA_DIR: null,
      AGENT_UPDATE_MANIFEST_CHANNEL: 'stable',
    })

    writeRuntimeState(layout.runtimeStatePath, {
      agent_version: '1.0.0',
      boot_status: 'healthy',
      update_state: 'idle',
      last_heartbeat_at: '2026-04-05T12:00:00.000Z',
      last_heartbeat_ok_at: '2026-04-05T12:00:00.000Z',
      active_jobs: 1,
      processing_state: 'idle',
      updated_at: '2026-04-05T12:00:00.000Z',
      pid: 31337,
    })

    const releaseDir = path.join(layout.releasesDir, '1.0.0')
    fs.mkdirSync(releaseDir, { recursive: true })
    fs.writeFileSync(path.join(releaseDir, 'agent.js'), "console.log('ok')\n", 'utf8')
    writeReleaseState(layout.releaseStatePath, createInitialReleaseState('1.0.0'))

    const controlSync = await syncAgentControlState({
      layout,
      currentConfig,
      forceRemoteFetch: false,
    })

    writeAgentControlPublicState({
      filePath: publicStatePath,
      snapshot: controlSync.snapshot,
      releaseInventory: buildAgentReleaseInventory({
        layout,
        releaseState: controlSync.releaseState,
      }),
      paths: buildAgentControlPaths(layout),
    })

    const raw = fs.readFileSync(publicStatePath, 'utf8')
    const parsed = readAgentControlPublicState(publicStatePath)

    expect(parsed).not.toBeNull()
    expect(parsed?.snapshot.runtime.status).toBe('RUNNING')
    expect(parsed?.releaseInventory.releases).toHaveLength(1)
    expect(parsed?.paths.dataDir).toBe(layout.dataDir)
    expect(raw).not.toContain(secretAgentToken)
    expect(raw).not.toContain(secretSupabaseAnonKey)
  })
})
