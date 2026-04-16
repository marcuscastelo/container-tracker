import type { PlatformPathResolution } from '@agent/platform/platform.types'

type AgentPathJoiner = (path: string, ...paths: string[]) => string

export const AGENT_PATH_LAYOUT = {
  directories: {
    releases: 'releases',
    current: 'current',
    previous: 'previous',
    logs: 'logs',
    downloads: 'downloads',
    publicState: 'run',
  },
  files: {
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
  },
  consumedBootstrapSuffix: '.consumed',
} as const

type ResolveAgentPathLayoutCommand = {
  readonly dataDir: string
  readonly joinPath: AgentPathJoiner
  readonly publicStateDir?: string
  readonly bootstrapEnvPath?: string
  readonly configEnvPath?: string
}

function normalizeOptionalPath(value: string | undefined): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : undefined
}

export function resolveAgentPathLayoutPaths(
  command: ResolveAgentPathLayoutCommand,
): PlatformPathResolution {
  const publicStateDir =
    normalizeOptionalPath(command.publicStateDir) ??
    command.joinPath(command.dataDir, AGENT_PATH_LAYOUT.directories.publicState)
  const bootstrapEnvPath =
    normalizeOptionalPath(command.bootstrapEnvPath) ??
    command.joinPath(command.dataDir, AGENT_PATH_LAYOUT.files.bootstrapEnv)
  const configEnvPath =
    normalizeOptionalPath(command.configEnvPath) ??
    command.joinPath(command.dataDir, AGENT_PATH_LAYOUT.files.configEnv)

  return {
    dataDir: command.dataDir,
    releasesDir: command.joinPath(command.dataDir, AGENT_PATH_LAYOUT.directories.releases),
    currentPath: command.joinPath(command.dataDir, AGENT_PATH_LAYOUT.directories.current),
    previousPath: command.joinPath(command.dataDir, AGENT_PATH_LAYOUT.directories.previous),
    logsDir: command.joinPath(command.dataDir, AGENT_PATH_LAYOUT.directories.logs),
    releaseStatePath: command.joinPath(command.dataDir, AGENT_PATH_LAYOUT.files.releaseState),
    runtimeStatePath: command.joinPath(command.dataDir, AGENT_PATH_LAYOUT.files.runtimeState),
    configEnvPath,
    bootstrapEnvPath,
    consumedBootstrapEnvPath: `${bootstrapEnvPath}${AGENT_PATH_LAYOUT.consumedBootstrapSuffix}`,
    installerTokenStatePath: command.joinPath(
      command.dataDir,
      AGENT_PATH_LAYOUT.files.installerTokenState,
    ),
    downloadsDir: command.joinPath(command.dataDir, AGENT_PATH_LAYOUT.directories.downloads),
    baseRuntimeConfigPath: command.joinPath(
      command.dataDir,
      AGENT_PATH_LAYOUT.files.baseRuntimeConfig,
    ),
    supervisorControlPath: command.joinPath(
      command.dataDir,
      AGENT_PATH_LAYOUT.files.supervisorControl,
    ),
    pendingActivityPath: command.joinPath(command.dataDir, AGENT_PATH_LAYOUT.files.pendingActivity),
    controlOverridesPath: command.joinPath(
      command.dataDir,
      AGENT_PATH_LAYOUT.files.controlOverrides,
    ),
    controlRemoteCachePath: command.joinPath(
      command.dataDir,
      AGENT_PATH_LAYOUT.files.controlRemoteCache,
    ),
    infraConfigPath: command.joinPath(command.dataDir, AGENT_PATH_LAYOUT.files.infraConfig),
    auditLogPath: command.joinPath(command.dataDir, AGENT_PATH_LAYOUT.files.auditLog),
    publicStateDir,
    publicStatePath: command.joinPath(publicStateDir, AGENT_PATH_LAYOUT.files.publicState),
    publicBackendStatePath: command.joinPath(
      publicStateDir,
      AGENT_PATH_LAYOUT.files.publicBackendState,
    ),
    publicLogsPath: command.joinPath(publicStateDir, AGENT_PATH_LAYOUT.files.publicLogs),
    agentLogForwarderStatePath: command.joinPath(
      command.dataDir,
      AGENT_PATH_LAYOUT.files.agentLogForwarderState,
    ),
  }
}
