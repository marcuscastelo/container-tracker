import type {
  PlatformControlCommand,
  PlatformServiceQueryResult,
} from '@agent/platform/platform.contract'

export type AgentControlStrategy = {
  readonly queryAgent: (command?: PlatformControlCommand) => Promise<PlatformServiceQueryResult>
  readonly startAgent: (command?: PlatformControlCommand) => Promise<void>
  readonly stopAgent: (command?: PlatformControlCommand) => Promise<void>
  readonly restartAgent: (command?: PlatformControlCommand) => Promise<void>
}
