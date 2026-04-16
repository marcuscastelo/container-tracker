import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  loadRawAgentEnvFromFile,
  parseAgentConfig,
  readAgentEnvFileValues,
  serializeAgentConfig,
  serializeBootstrapConfig,
} from '@agent/config/agent-env'
import {
  ValidatedAgentConfigSchema,
  ValidatedBootstrapConfigSchema,
} from '@agent/core/contracts/agent-config.contract'
import { describe, expect, it } from 'vitest'

function createTempEnvFile(content: string): {
  readonly dirPath: string
  readonly filePath: string
} {
  const dirPath = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-env-test-'))
  const filePath = path.join(dirPath, 'config.env')
  fs.writeFileSync(filePath, content, 'utf8')
  return { dirPath, filePath }
}

describe('agent-env', () => {
  it('loads env file values from disk', () => {
    const temp = createTempEnvFile(
      ['# comment', 'BACKEND_URL="https://file.example.com"', 'AGENT_TOKEN=file-token', ''].join(
        '\n',
      ),
    )

    try {
      const raw = loadRawAgentEnvFromFile(temp.filePath)
      expect(raw).not.toBeNull()
      if (!raw) {
        throw new Error('expected raw env file to be loaded')
      }

      expect(raw.sourcePath).toBe(temp.filePath)
      const values = readAgentEnvFileValues(temp.filePath)
      expect(values?.get('BACKEND_URL')).toBe('https://file.example.com')
      expect(values?.get('AGENT_TOKEN')).toBe('file-token')
    } finally {
      fs.rmSync(temp.dirPath, { recursive: true, force: true })
    }
  })

  it('parses valid and invalid env inputs with deterministic precedence', () => {
    const parsed = parseAgentConfig({
      env: {
        BACKEND_URL: 'https://env.example.com',
      },
      fileValues: new Map<string, string>([
        ['BACKEND_URL', 'https://file.example.com'],
        ['AGENT_TOKEN', 'file-token'],
        ['TENANT_ID', '11111111-1111-4111-8111-111111111111'],
        ['INTERVAL_SEC', 'not-a-number'],
        ['MAERSK_ENABLED', '1'],
        ['MAERSK_HEADLESS', 'invalid-boolean'],
      ]),
      raw: '',
      sourcePath: '/tmp/config.env',
    })

    expect(parsed.BACKEND_URL).toBe('https://env.example.com')
    expect(parsed.AGENT_TOKEN).toBe('file-token')
    expect(parsed.INTERVAL_SEC).toBeNull()
    expect(parsed.MAERSK_ENABLED).toBe(true)
    expect(parsed.MAERSK_HEADLESS).toBe(true)
  })

  it('serializes runtime and bootstrap config in canonical env format', () => {
    const runtimeConfig = ValidatedAgentConfigSchema.parse({
      BACKEND_URL: 'https://api.example.com',
      SUPABASE_URL: null,
      SUPABASE_ANON_KEY: null,
      AGENT_TOKEN: 'runtime-token',
      TENANT_ID: '11111111-1111-4111-8111-111111111111',
      AGENT_ID: 'agent-a',
      INTERVAL_SEC: 30,
      LIMIT: 5,
      MAERSK_ENABLED: true,
      MAERSK_HEADLESS: false,
      MAERSK_TIMEOUT_MS: 60000,
      MAERSK_USER_DATA_DIR: null,
      AGENT_UPDATE_MANIFEST_CHANNEL: 'stable',
    })

    const bootstrapConfig = ValidatedBootstrapConfigSchema.parse({
      BACKEND_URL: 'https://api.example.com',
      INSTALLER_TOKEN: 'bootstrap-token',
      AGENT_ID: 'agent-a',
      INTERVAL_SEC: 30,
      LIMIT: 5,
      MAERSK_ENABLED: true,
      MAERSK_HEADLESS: false,
      MAERSK_TIMEOUT_MS: 60000,
      MAERSK_USER_DATA_DIR: null,
      AGENT_UPDATE_MANIFEST_CHANNEL: 'stable',
    })

    const runtimeSerialized = serializeAgentConfig(runtimeConfig)
    expect(runtimeSerialized).toContain('BACKEND_URL=https://api.example.com')
    expect(runtimeSerialized).toContain('AGENT_TOKEN=runtime-token')

    const bootstrapSerialized = serializeBootstrapConfig({
      config: bootstrapConfig,
      redactInstallerToken: true,
    })
    expect(bootstrapSerialized).toContain('INSTALLER_TOKEN=[REDACTED]')
  })
})
