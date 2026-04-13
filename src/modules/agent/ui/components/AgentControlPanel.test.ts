import { describe, expect, it } from 'vitest'
import { parseBlockedVersionsDraft } from '~/modules/agent/ui/components/AgentControlPanel'

describe('AgentControlPanel helpers', () => {
  it('normalizes blocked versions draft into a unique list', () => {
    const parsed = parseBlockedVersionsDraft('1.0.0\n\n 1.0.0 \n2.0.0\n')

    expect(parsed).toEqual(['1.0.0', '2.0.0'])
  })
})
