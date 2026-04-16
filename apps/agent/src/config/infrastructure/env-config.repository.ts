import { validateAgentConfig } from '@agent/config/agent-config.policy'
import {
  loadRawAgentEnvFromFile,
  parseAgentConfig,
  serializeAgentConfig,
} from '@agent/config/agent-env'
import type { ValidatedAgentConfig } from '@agent/core/contracts/agent-config.contract'
import type { PlatformPathResolution } from '@agent/platform/platform.contract'
import { writeFileAtomic } from '@agent/state/file-io'

export function readRuntimeConfigFromEnv(command: {
  readonly paths: PlatformPathResolution
}): ValidatedAgentConfig | null {
  const raw = loadRawAgentEnvFromFile(command.paths.configEnvPath)
  if (!raw) {
    return null
  }

  const parsed = parseAgentConfig(raw)
  return validateAgentConfig(parsed)
}

export function writeRuntimeConfigToEnv(command: {
  readonly paths: PlatformPathResolution
  readonly config: ValidatedAgentConfig
}): void {
  writeFileAtomic(command.paths.configEnvPath, serializeAgentConfig(command.config))
}
