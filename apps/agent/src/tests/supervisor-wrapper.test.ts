import fs from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('supervisor entry wrapper', () => {
  it('delegates directly to the canonical supervisor main launcher', () => {
    const content = fs.readFileSync(new URL('../supervisor.ts', import.meta.url), 'utf8')

    expect(content).toContain("import { launchAgentMain } from '@agent/app/agent.main'")
    expect(content).toContain('launchAgentMain()')
    expect(content).not.toContain('isSupervisorEntrypoint')
    expect(content).not.toContain('path.basename')
  })
})
