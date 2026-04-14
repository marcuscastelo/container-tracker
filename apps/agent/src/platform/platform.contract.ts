import type { ChildProcess } from 'node:child_process'

export type AgentPlatformKey = 'linux-x64' | 'windows-x64'

export type ExtractBundleArchiveKind = 'zip' | 'tar' | 'tgz'

export type PlatformPathResolution = {
  readonly dataDir: string
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
  startRuntime: (command: StartRuntimeCommand) => ChildProcess
  stopRuntime: (command: StopRuntimeCommand) => void
  restartRuntime: (command: RestartRuntimeCommand) => ChildProcess
  extractBundle: (command: ExtractBundleCommand) => void
}
