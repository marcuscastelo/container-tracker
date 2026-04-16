import type { ChildProcess } from 'node:child_process'

export type AgentPlatformKey = 'linux-x64' | 'windows-x64'

export type ExtractBundleArchiveKind = 'zip' | 'tar' | 'tgz'

export type PlatformPathResolution = {
  readonly dataDir: string
  readonly releasesDir: string
  readonly currentPath: string
  readonly previousPath: string
  readonly logsDir: string
  readonly releaseStatePath: string
  readonly runtimeStatePath: string
  readonly configEnvPath: string
  readonly bootstrapEnvPath: string
  readonly consumedBootstrapEnvPath: string
  readonly installerTokenStatePath: string
  readonly downloadsDir: string
  readonly baseRuntimeConfigPath: string
  readonly supervisorControlPath: string
  readonly pendingActivityPath: string
  readonly controlOverridesPath: string
  readonly controlRemoteCachePath: string
  readonly infraConfigPath: string
  readonly auditLogPath: string
  readonly publicStateDir: string
  readonly publicStatePath: string
  readonly publicBackendStatePath: string
  readonly publicLogsPath: string
  readonly agentLogForwarderStatePath: string
}

export type PlatformServiceStatus = 'running' | 'stopped' | 'unknown'

export type PlatformServiceQueryResult = {
  readonly status: PlatformServiceStatus
  readonly detail: string | null
}

export type StartRuntimeCommand = {
  readonly scriptPath: string
  readonly execArgv?: readonly string[]
  readonly env: NodeJS.ProcessEnv
  readonly stdio: 'inherit' | 'pipe'
}

export type StopRuntimeCommand = {
  readonly child: ChildProcess
}

export type RestartRuntimeCommand = {
  readonly child: ChildProcess
  readonly next: StartRuntimeCommand
}

export type ExtractBundleCommand = {
  readonly archiveKind: ExtractBundleArchiveKind
  readonly archivePath: string
  readonly destinationDir: string
}

export type ResolvePathsCommand = {
  readonly env: NodeJS.ProcessEnv
  readonly cwd?: string
}

export type PlatformControlCommand = {
  readonly serviceName?: string
}

export type AgentPlatformControlAdapter = {
  readonly key: 'linux' | 'windows'
  readonly queryAgent: (command?: PlatformControlCommand) => Promise<PlatformServiceQueryResult>
  readonly startAgent: (command?: PlatformControlCommand) => Promise<void>
  readonly stopAgent: (command?: PlatformControlCommand) => Promise<void>
  readonly restartAgent: (command?: PlatformControlCommand) => Promise<void>
}

export type AgentPlatformAdapter = {
  readonly key: AgentPlatformKey
  readonly control: AgentPlatformControlAdapter
  resolvePaths: (command: ResolvePathsCommand) => PlatformPathResolution
  ensureDirectories: (command: { readonly paths: PlatformPathResolution }) => void
  startRuntime: (command: StartRuntimeCommand) => ChildProcess
  stopRuntime: (command: StopRuntimeCommand) => void
  restartRuntime: (command: RestartRuntimeCommand) => ChildProcess
  extractBundle: (command: ExtractBundleCommand) => void
  readSymlinkOrPointer: (command: { readonly pointerPath: string }) => string | null
  switchCurrentRelease: (command: {
    readonly currentPath: string
    readonly previousPath: string
    readonly targetPath: string
    readonly previousTargetPath?: string | null
  }) => void
}
