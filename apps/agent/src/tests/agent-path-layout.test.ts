import path from 'node:path'

import { AGENT_PATH_LAYOUT, resolveAgentPathLayoutPaths } from '@agent/platform/agent-path-layout'
import { describe, expect, it } from 'vitest'

describe('agent path layout', () => {
  it('defines canonical directory and file names', () => {
    expect(AGENT_PATH_LAYOUT.directories).toEqual({
      releases: 'releases',
      current: 'current',
      previous: 'previous',
      logs: 'logs',
      downloads: 'downloads',
      publicState: 'run',
    })

    expect(AGENT_PATH_LAYOUT.files).toEqual({
      releaseState: 'release-state.json',
      runtimeState: 'runtime-state.json',
      configEnv: 'config.env',
      bootstrapEnv: 'bootstrap.env',
      installerTokenState: 'installer-token-state.json',
      baseRuntimeConfig: 'control-base.runtime.json',
      supervisorControl: 'supervisor-control.json',
      pendingActivity: 'pending-activity-events.json',
      controlOverrides: 'control-overrides.local.json',
      controlRemoteCache: 'control-remote-cache.json',
      infraConfig: 'infra-config.json',
      auditLog: 'agent-control-audit.ndjson',
      publicState: 'control-ui-state.json',
      publicBackendState: 'control-ui-backend-state.json',
      publicLogs: 'control-ui-logs.json',
      agentLogForwarderState: 'agent-log-forwarder-state.json',
    })
  })

  it('resolves canonical posix layout defaults', () => {
    const paths = resolveAgentPathLayoutPaths({
      dataDir: '/tmp/container-tracker-agent',
      joinPath: path.posix.join,
    })

    expect(paths).toMatchObject({
      dataDir: '/tmp/container-tracker-agent',
      releasesDir: '/tmp/container-tracker-agent/releases',
      currentPath: '/tmp/container-tracker-agent/current',
      previousPath: '/tmp/container-tracker-agent/previous',
      logsDir: '/tmp/container-tracker-agent/logs',
      downloadsDir: '/tmp/container-tracker-agent/downloads',
      publicStateDir: '/tmp/container-tracker-agent/run',
      releaseStatePath: '/tmp/container-tracker-agent/release-state.json',
      runtimeStatePath: '/tmp/container-tracker-agent/runtime-state.json',
      configEnvPath: '/tmp/container-tracker-agent/config.env',
      bootstrapEnvPath: '/tmp/container-tracker-agent/bootstrap.env',
      consumedBootstrapEnvPath: '/tmp/container-tracker-agent/bootstrap.env.consumed',
      installerTokenStatePath: '/tmp/container-tracker-agent/installer-token-state.json',
    })
  })

  it('resolves canonical win32 layout with explicit overrides', () => {
    const paths = resolveAgentPathLayoutPaths({
      dataDir: 'C:\\Agent\\Data',
      publicStateDir: 'D:\\Agent\\State',
      bootstrapEnvPath: 'D:\\Agent\\bootstrap.env',
      configEnvPath: 'D:\\Agent\\config.env',
      joinPath: path.win32.join,
    })

    expect(paths).toMatchObject({
      dataDir: 'C:\\Agent\\Data',
      releasesDir: 'C:\\Agent\\Data\\releases',
      currentPath: 'C:\\Agent\\Data\\current',
      previousPath: 'C:\\Agent\\Data\\previous',
      logsDir: 'C:\\Agent\\Data\\logs',
      downloadsDir: 'C:\\Agent\\Data\\downloads',
      publicStateDir: 'D:\\Agent\\State',
      releaseStatePath: 'C:\\Agent\\Data\\release-state.json',
      runtimeStatePath: 'C:\\Agent\\Data\\runtime-state.json',
      configEnvPath: 'D:\\Agent\\config.env',
      bootstrapEnvPath: 'D:\\Agent\\bootstrap.env',
      consumedBootstrapEnvPath: 'D:\\Agent\\bootstrap.env.consumed',
      installerTokenStatePath: 'C:\\Agent\\Data\\installer-token-state.json',
      publicStatePath: 'D:\\Agent\\State\\control-ui-state.json',
      publicBackendStatePath: 'D:\\Agent\\State\\control-ui-backend-state.json',
      publicLogsPath: 'D:\\Agent\\State\\control-ui-logs.json',
    })
  })
})
