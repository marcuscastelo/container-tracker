export type ResolvedActiveRelease = {
  readonly version: string
  readonly entrypointPath: string
  readonly source: 'release' | 'fallback'
}

export type RuntimeLaunchSpec = {
  readonly entrypointPath: string
  readonly expectedVersion: string
  readonly env: NodeJS.ProcessEnv
  readonly healthPath: string
  readonly supervisorControlPath: string
  readonly pendingActivityPath: string
  readonly logsDir: string
}
