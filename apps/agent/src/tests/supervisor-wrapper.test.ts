import { isSupervisorEntrypoint } from '@agent/supervisor'
import { describe, expect, it } from 'vitest'

describe('supervisor entry wrapper', () => {
  it('recognizes the compiled supervisor entrypoint', () => {
    expect(isSupervisorEntrypoint('/tmp/container-tracker/apps/agent/src/supervisor.js')).toBe(true)
  })

  it('recognizes the TypeScript supervisor entrypoint', () => {
    expect(isSupervisorEntrypoint('/tmp/container-tracker/apps/agent/src/supervisor.ts')).toBe(true)
  })

  it('does not run for unrelated entrypoints', () => {
    expect(isSupervisorEntrypoint('/tmp/container-tracker/apps/agent/src/agent.js')).toBe(false)
  })
})
