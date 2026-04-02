import type { ChildProcess } from 'node:child_process'

export type AgentPlatformKey = 'linux-x64' | 'windows-x64'

export type ExtractBundleArchiveKind = 'zip' | 'tar' | 'tgz'

export type PlatformPathResolution = {
  readonly dataDir: string
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

export type AgentPlatformAdapter = {
  readonly key: AgentPlatformKey
  resolvePaths: (command: ResolvePathsCommand) => PlatformPathResolution
  startRuntime: (command: StartRuntimeCommand) => ChildProcess
  stopRuntime: (command: StopRuntimeCommand) => void
  restartRuntime: (command: RestartRuntimeCommand) => ChildProcess
  extractBundle: (command: ExtractBundleCommand) => void
}
