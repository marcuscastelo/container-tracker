import fs from 'node:fs'
import {
  loadRawAgentEnvFromFile,
  parseAgentConfig,
  parseBootstrapConfig,
  serializeBootstrapConfig,
} from '@agent/config/agent-config.mapper'
import type { ValidatedBootstrapConfig } from '@agent/core/contracts/agent-config.contract'
import type { PlatformPathResolution } from '@agent/platform/platform.contract'
import { writeFileAtomic } from '@agent/state/file-io'

export function readBootstrapConfigFromEnv(command: { readonly paths: PlatformPathResolution }): {
  readonly config: ValidatedBootstrapConfig
  readonly raw: string
} | null {
  const raw = loadRawAgentEnvFromFile(command.paths.bootstrapEnvPath)
  if (!raw) {
    return null
  }

  const parsed = parseAgentConfig(raw)
  return {
    config: parseBootstrapConfig(parsed),
    raw: raw.raw,
  }
}

export function consumeBootstrapConfig(command: {
  readonly paths: PlatformPathResolution
  readonly config: ValidatedBootstrapConfig
  readonly rawContent: string
}): void {
  const consumedContent = command.rawContent.includes(command.config.INSTALLER_TOKEN)
    ? command.rawContent.replaceAll(command.config.INSTALLER_TOKEN, '[REDACTED]')
    : serializeBootstrapConfig({
        config: command.config,
        redactInstallerToken: true,
      })

  writeFileAtomic(command.paths.consumedBootstrapEnvPath, consumedContent)
  fs.rmSync(command.paths.bootstrapEnvPath, { force: true })
}
