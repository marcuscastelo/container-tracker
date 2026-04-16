import {
  ensureBootstrapPlaceholdersAbsent as ensureBootstrapPlaceholdersAbsentPolicy,
  ensureRuntimePlaceholdersAbsent as ensureRuntimePlaceholdersAbsentPolicy,
  parseBootstrapConfig as parseBootstrapConfigPolicy,
  resolveEffectiveBootstrapConfig as resolveEffectiveBootstrapConfigPolicy,
  resolveEffectiveRuntimeConfig as resolveEffectiveRuntimeConfigPolicy,
  validateAgentConfig as validateAgentConfigPolicy,
} from '@agent/config/agent-config.policy'
import {
  loadRawAgentEnvFromFile as loadRawAgentEnvFromFileImpl,
  parseAgentConfig as parseAgentConfigImpl,
  readAgentEnvFileValues as readAgentEnvFileValuesImpl,
  serializeAgentConfig as serializeAgentConfigImpl,
  serializeBootstrapConfig as serializeBootstrapConfigImpl,
} from '@agent/config/agent-env'
import type {
  ParsedAgentConfig,
  RawAgentEnv,
  ValidatedAgentConfig,
  ValidatedBootstrapConfig,
} from '@agent/core/contracts/agent-config.contract'

export function loadRawAgentEnvFromFile(filePath: string): RawAgentEnv | null {
  return loadRawAgentEnvFromFileImpl(filePath)
}

export function readAgentEnvFileValues(filePath: string): Map<string, string> | null {
  return readAgentEnvFileValuesImpl(filePath)
}

export function parseAgentConfig(raw: RawAgentEnv): ParsedAgentConfig {
  return parseAgentConfigImpl(raw)
}

export function serializeAgentConfig(config: ValidatedAgentConfig): string {
  return serializeAgentConfigImpl(config)
}

export function serializeBootstrapConfig(command: {
  readonly config: ValidatedBootstrapConfig
  readonly redactInstallerToken: boolean
}): string {
  return serializeBootstrapConfigImpl(command)
}

export function ensureRuntimePlaceholdersAbsent(config: ValidatedAgentConfig): void {
  ensureRuntimePlaceholdersAbsentPolicy(config)
}

export function ensureBootstrapPlaceholdersAbsent(config: ValidatedBootstrapConfig): void {
  ensureBootstrapPlaceholdersAbsentPolicy(config)
}

export function resolveEffectiveRuntimeConfig(parsed: ParsedAgentConfig): ValidatedAgentConfig {
  return resolveEffectiveRuntimeConfigPolicy(parsed)
}

export function resolveEffectiveBootstrapConfig(
  parsed: ParsedAgentConfig,
): ValidatedBootstrapConfig {
  return resolveEffectiveBootstrapConfigPolicy(parsed)
}

export function validateAgentConfig(parsed: ParsedAgentConfig): ValidatedAgentConfig {
  return validateAgentConfigPolicy(parsed)
}

export function parseBootstrapConfig(parsed: ParsedAgentConfig): ValidatedBootstrapConfig {
  return parseBootstrapConfigPolicy(parsed)
}
