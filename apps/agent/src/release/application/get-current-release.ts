import type { AgentPathLayout } from '@agent/config/config.contract'
import type {
  ResolvedActiveRelease,
  RuntimeLaunchSpec,
} from '@agent/core/contracts/release-runtime-handoff.contract'
import { resolveActiveRelease } from '@agent/release/application/release-layout'

export function getCurrentRelease(command: {
  readonly layout: AgentPathLayout
  readonly fallbackEntrypoint: string
  readonly expectedVersion: string
}): ResolvedActiveRelease {
  return resolveActiveRelease(command)
}

export function createRuntimeLaunchSpec(command: {
  readonly layout: AgentPathLayout
  readonly resolvedRelease: ResolvedActiveRelease
  readonly baseEnv: NodeJS.ProcessEnv
}): RuntimeLaunchSpec {
  return {
    entrypointPath: command.resolvedRelease.entrypointPath,
    expectedVersion: command.resolvedRelease.version,
    env: {
      ...command.baseEnv,
      AGENT_SUPERVISOR_HEALTH_PATH: command.layout.runtimeStatePath,
      AGENT_SUPERVISOR_CONTROL_PATH: command.layout.supervisorControlPath,
      AGENT_PENDING_ACTIVITY_PATH: command.layout.pendingActivityPath,
      AGENT_ACTIVE_RELEASE_VERSION: command.resolvedRelease.version,
    },
    healthPath: command.layout.runtimeStatePath,
    supervisorControlPath: command.layout.supervisorControlPath,
    pendingActivityPath: command.layout.pendingActivityPath,
    logsDir: command.layout.logsDir,
  }
}
