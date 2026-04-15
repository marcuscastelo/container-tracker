import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { AgentPathLayout } from '@agent/config/config.contract'
import {
  ControlRuntimeConfigSchema,
  serializeRuntimeConfig,
} from '@agent/control-core/agent-control-core'
import {
  publishAgentControlPublicSnapshot,
  readAgentControlPublicBackendState,
  readAgentControlPublicLogs,
  refreshAgentControlPublicBackendState,
  refreshAgentControlPublicLogs,
  selectAgentControlPublicLogs,
} from '@agent/control-core/public-control-files'
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

  fs.mkdirSync(layout.logsDir, { recursive: true })
  fs.mkdirSync(layout.releasesDir, { recursive: true })
  fs.mkdirSync(layout.downloadsDir, { recursive: true })
  return layout
}

function createRuntimeConfig() {
  return ControlRuntimeConfigSchema.parse({
    BACKEND_URL: 'https://backend.test.local',
    SUPABASE_URL: 'https://supabase.test.local',
    SUPABASE_ANON_KEY: 'supabase-anon-secret',
    AGENT_TOKEN: 'agent-token-secret',
    TENANT_ID: '00000000-0000-4000-8000-000000000001',
    AGENT_ID: 'container-tracker-agent',
    INTERVAL_SEC: 60,
    LIMIT: 10,
    MAERSK_ENABLED: false,
    MAERSK_HEADLESS: true,
    MAERSK_TIMEOUT_MS: 120000,
    MAERSK_USER_DATA_DIR: null,
    AGENT_UPDATE_MANIFEST_CHANNEL: 'stable',
  })
}

describe('agent control public artifacts', () => {
  it('publishes backend state without exposing private data dir access to the UI process', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-public-backend-state-'))
    const layout = createLayout(tempDir)
    const publicBackendStatePath = path.join(tempDir, 'run', 'control-ui-backend-state.json')

    fs.writeFileSync(layout.configEnvPath, serializeRuntimeConfig(createRuntimeConfig()), 'utf8')
    fs.writeFileSync(
      layout.bootstrapEnvPath,
      ['BACKEND_URL=https://bootstrap.test.local', 'INSTALLER_TOKEN=bootstrap-token'].join('\n'),
      'utf8',
    )

    refreshAgentControlPublicBackendState({
      filePath: publicBackendStatePath,
      layout,
    })

    const backendState = readAgentControlPublicBackendState(publicBackendStatePath)

    expect(backendState).not.toBeNull()
    expect(backendState?.status).toBe('ENROLLED')
    expect(backendState?.backendUrl).toBe('https://backend.test.local')
    expect(backendState?.source).toBe('RUNTIME_CONFIG')
    expect(backendState?.installerTokenAvailable).toBe(true)
  })

  it('publishes the canonical public snapshot from local runtime files', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-public-snapshot-'))
    const layout = createLayout(tempDir)
    const publicStatePath = path.join(tempDir, 'run', 'control-ui-state.json')
    const publicBackendStatePath = path.join(tempDir, 'run', 'control-ui-backend-state.json')
    const runtimeConfig = createRuntimeConfig()

    fs.writeFileSync(layout.configEnvPath, serializeRuntimeConfig(runtimeConfig), 'utf8')
    fs.writeFileSync(
      layout.bootstrapEnvPath,
      ['BACKEND_URL=https://bootstrap.test.local', 'INSTALLER_TOKEN=bootstrap-token'].join('\n'),
      'utf8',
    )
    fs.mkdirSync(path.join(layout.releasesDir, '0.3.0-alpha.1'), { recursive: true })
    fs.writeFileSync(
      path.join(layout.releasesDir, '0.3.0-alpha.1', 'agent.js'),
      "console.log('ok')\n",
      'utf8',
    )
    fs.writeFileSync(
      layout.releaseStatePath,
      `${JSON.stringify(
        {
          current_version: '0.3.0-alpha.1',
          previous_version: null,
          target_version: null,
          last_known_good_version: '0.3.0-alpha.1',
          blocked_versions: [],
          activation_state: 'idle',
          automatic_updates_blocked: false,
          last_update_attempt: null,
          last_error: null,
        },
        null,
        2,
      )}\n`,
      'utf8',
    )
    fs.writeFileSync(
      layout.runtimeStatePath,
      `${JSON.stringify(
        {
          agent_version: '0.3.0-alpha.1',
          boot_status: 'healthy',
          update_state: 'idle',
          last_heartbeat_at: '2026-04-06T18:24:00.326Z',
          last_heartbeat_ok_at: '2026-04-06T18:24:00.326Z',
          active_jobs: 0,
          processing_state: 'idle',
          updated_at: '2026-04-06T18:24:00.326Z',
          pid: 12345,
        },
        null,
        2,
      )}\n`,
      'utf8',
    )

    const publicState = await publishAgentControlPublicSnapshot({
      filePath: publicStatePath,
      backendStatePath: publicBackendStatePath,
      layout,
      forceRemoteFetch: false,
    })

    expect(publicState).not.toBeNull()
    expect(publicState?.snapshot.runtime.status).toBe('RUNNING')
    expect(publicState?.snapshot.release.current).toBe('0.3.0-alpha.1')
    expect(publicState?.backendState?.status).toBe('ENROLLED')
    expect(readAgentControlPublicBackendState(publicBackendStatePath)?.publicStateAvailable).toBe(
      true,
    )
  })

  it('removes a stale public snapshot when runtime config is unavailable', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-public-snapshot-stale-'))
    const layout = createLayout(tempDir)
    const publicStatePath = path.join(tempDir, 'run', 'control-ui-state.json')
    const publicBackendStatePath = path.join(tempDir, 'run', 'control-ui-backend-state.json')

    fs.mkdirSync(path.dirname(publicStatePath), { recursive: true })
    fs.writeFileSync(publicStatePath, '{"stale":true}\n', 'utf8')
    fs.writeFileSync(
      layout.bootstrapEnvPath,
      ['BACKEND_URL=https://bootstrap.test.local', 'INSTALLER_TOKEN=bootstrap-token'].join('\n'),
      'utf8',
    )

    const publicState = await publishAgentControlPublicSnapshot({
      filePath: publicStatePath,
      backendStatePath: publicBackendStatePath,
      layout,
      forceRemoteFetch: false,
    })

    expect(publicState).toBeNull()
    expect(fs.existsSync(publicStatePath)).toBe(false)
    expect(readAgentControlPublicBackendState(publicBackendStatePath)?.publicStateAvailable).toBe(
      false,
    )
  })

  it('publishes logs and lets the installed UI filter them without touching private log files', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-public-logs-'))
    const layout = createLayout(tempDir)
    const publicLogsPath = path.join(tempDir, 'run', 'control-ui-logs.json')

    fs.writeFileSync(
      path.join(layout.logsDir, 'agent.out.log'),
      ['out-1', 'out-2', 'out-3'].join('\n'),
      'utf8',
    )
    fs.writeFileSync(
      path.join(layout.logsDir, 'agent.err.log'),
      ['err-1', 'err-2'].join('\n'),
      'utf8',
    )
    fs.writeFileSync(path.join(layout.logsDir, 'supervisor.log'), 'super-1\n', 'utf8')

    refreshAgentControlPublicLogs({
      filePath: publicLogsPath,
      layout,
      tail: 2000,
    })

    const logs = readAgentControlPublicLogs(publicLogsPath)
    expect(logs).not.toBeNull()
    expect(logs?.lines.length).toBe(6)

    const filtered = selectAgentControlPublicLogs(logs ?? { lines: [] }, {
      channel: 'stdout',
      tail: 2,
    })

    expect(filtered.lines).toHaveLength(2)
    expect(filtered.lines.map((line) => line.message)).toEqual(['out-2', 'out-3'])
    expect(filtered.lines.every((line) => line.channel === 'stdout')).toBe(true)
  })
})
