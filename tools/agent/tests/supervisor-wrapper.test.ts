import { describe, expect, it } from 'vitest'

import { isSupervisorEntrypoint } from '@tools/agent/supervisor'

describe('supervisor entry wrapper', () => {
  it('recognizes the compiled supervisor entrypoint', () => {
    expect(isSupervisorEntrypoint('/tmp/container-tracker/tools/agent/supervisor.js')).toBe(true)
  })

  it('recognizes the TypeScript supervisor entrypoint', () => {
    expect(isSupervisorEntrypoint('/tmp/container-tracker/tools/agent/supervisor.ts')).toBe(true)
  })

  it('does not run for unrelated entrypoints', () => {
    expect(isSupervisorEntrypoint('/tmp/container-tracker/tools/agent/agent.js')).toBe(false)
  })
})
