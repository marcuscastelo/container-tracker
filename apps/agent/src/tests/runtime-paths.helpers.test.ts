import { resolveAgentConfigDir } from '@agent/runtime/paths'
import { afterEach, describe, expect, it } from 'vitest'

const ORIGINAL_DOTENV_PATH = process.env.DOTENV_PATH
const ORIGINAL_AGENT_DATA_DIR = process.env.AGENT_DATA_DIR

describe('runtime path helpers', () => {
  afterEach(() => {
    if (ORIGINAL_DOTENV_PATH === undefined) {
      delete process.env.DOTENV_PATH
    } else {
      process.env.DOTENV_PATH = ORIGINAL_DOTENV_PATH
    }

    if (ORIGINAL_AGENT_DATA_DIR === undefined) {
      delete process.env.AGENT_DATA_DIR
    } else {
      process.env.AGENT_DATA_DIR = ORIGINAL_AGENT_DATA_DIR
    }
  })

  it('resolves config dir from DOTENV_PATH when config lives outside data dir', () => {
    process.env.AGENT_DATA_DIR = '/var/lib/container-tracker-agent'
    process.env.DOTENV_PATH = '/etc/container-tracker-agent/config.env'

    expect(resolveAgentConfigDir()).toBe('/etc/container-tracker-agent')
  })
})
