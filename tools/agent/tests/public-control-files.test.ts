import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import {
  ControlRuntimeConfigSchema,
  serializeRuntimeConfig,
} from '@tools/agent/control-core/agent-control-core'
import {
  readAgentControlPublicBackendState,
  readAgentControlPublicLogs,
  refreshAgentControlPublicBackendState,
  refreshAgentControlPublicLogs,
  selectAgentControlPublicLogs,
} from '@tools/agent/control-core/public-control-files'
import type { AgentPathLayout } from '@tools/agent/runtime-paths'
import { describe, expect, it } from 'vitest'

function createLayout(baseDir: string): AgentPathLayout {
  const layout: AgentPathLayout = {
    dataDir: baseDir,
    configPath: path.join(baseDir, 'config.env'),
    baseRuntimeConfigPath: path.join(baseDir, 'control-base.runtime.json'),
    bootstrapPath: path.join(baseDir, 'bootstrap.env'),
    consumedBootstrapPath: path.join(baseDir, 'bootstrap.env.consumed'),
    releasesDir: path.join(baseDir, 'releases'),
    downloadsDir: path.join(baseDir, 'downloads'),
    logsDir: path.join(baseDir, 'logs'),
    currentLinkPath: path.join(baseDir, 'current'),
    previousLinkPath: path.join(baseDir, 'previous'),
    releaseStatePath: path.join(baseDir, 'release-state.json'),
    runtimeHealthPath: path.join(baseDir, 'runtime-health.json'),
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

    fs.writeFileSync(layout.configPath, serializeRuntimeConfig(createRuntimeConfig()), 'utf8')
    fs.writeFileSync(
      layout.bootstrapPath,
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
    fs.writeFileSync(path.join(layout.logsDir, 'updater.log'), 'update-1\n', 'utf8')

    refreshAgentControlPublicLogs({
      filePath: publicLogsPath,
      layout,
      tail: 2000,
    })

    const logs = readAgentControlPublicLogs(publicLogsPath)
    expect(logs).not.toBeNull()
    expect(logs?.lines.length).toBe(7)

    const filtered = selectAgentControlPublicLogs(logs ?? { lines: [] }, {
      channel: 'stdout',
      tail: 2,
    })

    expect(filtered.lines).toHaveLength(2)
    expect(filtered.lines.map((line) => line.message)).toEqual(['out-2', 'out-3'])
    expect(filtered.lines.every((line) => line.channel === 'stdout')).toBe(true)
  })
})
