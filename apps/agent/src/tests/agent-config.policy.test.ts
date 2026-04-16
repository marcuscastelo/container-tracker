import {
  parseBootstrapConfig,
  resolveEffectiveRuntimeConfig,
  validateAgentConfig,
} from '@agent/config/agent-config.policy'
import {
  type ParsedAgentConfig,
  ParsedAgentConfigSchema,
} from '@agent/core/contracts/agent-config.contract'
import { BoundaryValidationError } from '@agent/core/errors/boundary-validation.error'
import { describe, expect, it } from 'vitest'

function makeParsedConfig(overrides?: Readonly<Record<string, unknown>>): ParsedAgentConfig {
  return ParsedAgentConfigSchema.parse({
    BACKEND_URL: 'https://api.example.com',
    SUPABASE_URL: 'https://project.supabase.co',
    SUPABASE_ANON_KEY: 'anon-key',
    AGENT_TOKEN: 'agent-token',
    INSTALLER_TOKEN: 'installer-token',
    TENANT_ID: '11111111-1111-4111-8111-111111111111',
    AGENT_ID: null,
    INTERVAL_SEC: null,
    LIMIT: null,
    MAERSK_ENABLED: false,
    MAERSK_HEADLESS: true,
    MAERSK_TIMEOUT_MS: null,
    MAERSK_USER_DATA_DIR: null,
    AGENT_UPDATE_MANIFEST_CHANNEL: null,
    ...(overrides ?? {}),
  })
}

describe('agent-config.policy', () => {
  it('resolves effective runtime defaults and validates config', () => {
    const parsed = makeParsedConfig()
    const validated = resolveEffectiveRuntimeConfig(parsed, { hostname: 'agent-host' })

    expect(validated.AGENT_ID).toBe('agent-host')
    expect(validated.INTERVAL_SEC).toBe(60)
    expect(validated.LIMIT).toBe(10)
    expect(validated.MAERSK_TIMEOUT_MS).toBe(120000)
    expect(validated.AGENT_UPDATE_MANIFEST_CHANNEL).toBe('stable')
  })

  it('fails runtime validation when required values are missing', () => {
    const parsed = makeParsedConfig({
      AGENT_TOKEN: null,
    })

    expect(() => validateAgentConfig(parsed)).toThrow(BoundaryValidationError)
  })

  it('rejects runtime placeholder values', () => {
    const parsed = makeParsedConfig({
      BACKEND_URL: 'https://your-backend.example.com',
      SUPABASE_URL: 'https://your-project.supabase.co',
      SUPABASE_ANON_KEY: 'replace-with-anon-key',
      AGENT_TOKEN: 'replace-with-agent-token',
      TENANT_ID: '00000000-0000-4000-8000-000000000000',
    })

    expect(() => validateAgentConfig(parsed)).toThrow(BoundaryValidationError)
  })

  it('rejects bootstrap placeholder values', () => {
    const parsed = makeParsedConfig({
      BACKEND_URL: 'https://your-backend.example.com',
      INSTALLER_TOKEN: 'replace-with-installer-token',
    })

    expect(() => parseBootstrapConfig(parsed)).toThrow(BoundaryValidationError)
  })
})
