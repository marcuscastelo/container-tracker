import {
  parseAgentConfig,
  parseBootstrapConfig,
  resolveEffectiveBootstrapConfig,
  resolveEffectiveRuntimeConfig,
  serializeAgentConfig,
  validateAgentConfig,
} from '@agent/config/agent-config.mapper'
import { BoundaryValidationError } from '@agent/core/errors/boundary-validation.error'
import { describe, expect, it } from 'vitest'

function makeRaw(overrides?: Readonly<Record<string, string>>): {
  readonly env: NodeJS.ProcessEnv
  readonly fileValues: ReadonlyMap<string, string>
  readonly raw: string
  readonly sourcePath: string
} {
  const values = new Map<string, string>(Object.entries(overrides ?? {}))
  return {
    env: {},
    fileValues: values,
    raw: '',
    sourcePath: '/tmp/config.env',
  }
}

describe('agent config mapper', () => {
  it('parses and validates runtime config from raw env values', () => {
    const parsed = parseAgentConfig(
      makeRaw({
        BACKEND_URL: 'https://api.example.com',
        AGENT_TOKEN: 'token-123',
        TENANT_ID: '11111111-1111-4111-8111-111111111111',
        AGENT_ID: 'agent-a',
        INTERVAL_SEC: '30',
        LIMIT: '5',
        MAERSK_ENABLED: 'true',
        MAERSK_HEADLESS: 'false',
        MAERSK_TIMEOUT_MS: '60000',
        AGENT_UPDATE_MANIFEST_CHANNEL: 'Stable',
      }),
    )

    const validated = validateAgentConfig(parsed)
    expect(validated.BACKEND_URL).toBe('https://api.example.com')
    expect(validated.INTERVAL_SEC).toBe(30)
    expect(validated.MAERSK_ENABLED).toBe(true)
    expect(validated.MAERSK_HEADLESS).toBe(false)
    expect(validated.AGENT_UPDATE_MANIFEST_CHANNEL).toBe('stable')
  })

  it('fails runtime validation when placeholder values are present', () => {
    const parsed = parseAgentConfig(
      makeRaw({
        BACKEND_URL: 'https://your-backend.example.com',
        AGENT_TOKEN: 'replace-with-token',
        TENANT_ID: '00000000-0000-4000-8000-000000000000',
      }),
    )

    expect(() => validateAgentConfig(parsed)).toThrow(BoundaryValidationError)
  })

  it('parses bootstrap config and rejects placeholder installer token', () => {
    const parsed = parseAgentConfig(
      makeRaw({
        BACKEND_URL: 'https://your-backend.example.com',
        INSTALLER_TOKEN: 'replace-with-installer-token',
      }),
    )

    expect(() => parseBootstrapConfig(parsed)).toThrow(BoundaryValidationError)
  })

  it('serializes runtime config using canonical env format', () => {
    const parsed = parseAgentConfig(
      makeRaw({
        BACKEND_URL: 'https://api.example.com',
        AGENT_TOKEN: 'token-123',
        TENANT_ID: '11111111-1111-4111-8111-111111111111',
      }),
    )

    const serialized = serializeAgentConfig(validateAgentConfig(parsed))
    expect(serialized).toContain('BACKEND_URL=https://api.example.com')
    expect(serialized).toContain('AGENT_TOKEN=token-123')
  })

  it('forwards optional hostname context to runtime resolution', () => {
    const parsed = parseAgentConfig(
      makeRaw({
        BACKEND_URL: 'https://api.example.com',
        AGENT_TOKEN: 'token-123',
        TENANT_ID: '11111111-1111-4111-8111-111111111111',
      }),
    )

    const validated = resolveEffectiveRuntimeConfig(parsed, { hostname: 'edge-agent-01' })
    expect(validated.AGENT_ID).toBe('edge-agent-01')
  })

  it('forwards optional hostname context to bootstrap resolution', () => {
    const parsed = parseAgentConfig(
      makeRaw({
        BACKEND_URL: 'https://api.example.com',
        INSTALLER_TOKEN: 'installer-token-123',
      }),
    )

    const validated = resolveEffectiveBootstrapConfig(parsed, { hostname: 'bootstrap-node-01' })
    expect(validated.AGENT_ID).toBe('bootstrap-node-01')
  })
})
