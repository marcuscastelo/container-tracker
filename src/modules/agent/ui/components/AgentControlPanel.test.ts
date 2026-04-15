import { describe, expect, it } from 'vitest'
import {
  parseBlockedVersionsDraft,
  resolveRemoteControlStateView,
} from '~/modules/agent/ui/components/AgentControlPanel'

describe('AgentControlPanel helpers', () => {
  it('normalizes blocked versions draft into a unique list', () => {
    const parsed = parseBlockedVersionsDraft('1.0.0\n\n 1.0.0 \n2.0.0\n')

    expect(parsed).toEqual(['1.0.0', '2.0.0'])
  })

  it('marks null control state as empty (not error) when there is no fetch error', () => {
    const view = resolveRemoteControlStateView({
      hasError: false,
      controlState: null,
    })

    expect(view).toBe('empty')
  })

  it('marks any fetch error as error regardless of control-state payload', () => {
    const view = resolveRemoteControlStateView({
      hasError: true,
      controlState: null,
    })

    expect(view).toBe('error')
  })
})
