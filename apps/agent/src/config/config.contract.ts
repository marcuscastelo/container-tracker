export type AgentPathLayout = {
  readonly dataDir: string
  readonly configPath: string
  readonly baseRuntimeConfigPath: string
  readonly bootstrapPath: string
  readonly consumedBootstrapPath: string
  readonly releasesDir: string
  readonly downloadsDir: string
  readonly logsDir: string
  readonly currentLinkPath: string
  readonly previousLinkPath: string
  readonly releaseStatePath: string
  readonly runtimeHealthPath: string
  readonly supervisorControlPath: string
  readonly pendingActivityPath: string
  readonly controlOverridesPath: string
  readonly controlRemoteCachePath: string
  readonly infraConfigPath: string
  readonly auditLogPath: string
}
