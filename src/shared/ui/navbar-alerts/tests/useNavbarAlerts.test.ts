import { describe, expect, it } from 'vitest'
import {
  hasResolvedNavbarAlertsResource,
  toNavbarAlertsState,
} from '~/shared/ui/navbar-alerts/useNavbarAlerts'

function buildErroredNavbarAlertsResource(): Parameters<typeof toNavbarAlertsState>[0] {
  return {
    error: new Error('navbar failed'),
    loading: false,
    state: 'errored',
    get latest(): never {
      throw new Error('navbar alerts resource latest should not be read')
    },
  }
}

describe('useNavbarAlerts helpers', () => {
  it('builds a safe error state without reading the throwing resource accessor', () => {
    const resource = buildErroredNavbarAlertsResource()

    expect(toNavbarAlertsState(resource)).toEqual({
      totalAlerts: 0,
      processes: [],
      loading: false,
      error: 'navbar failed',
    })
    expect(hasResolvedNavbarAlertsResource(resource)).toBe(true)
  })
})
