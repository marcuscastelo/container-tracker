import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  dismissServerProblemBanner,
  readServerProblemBannerState,
  reportHttpFailure,
  reportHttpSuccess,
  resetServerProblemBannerForTests,
} from '~/shared/api/httpDegradationReporter'

function enableBrowserRuntime(): void {
  vi.stubGlobal('window', {})
}

describe('httpDegradationReporter', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    resetServerProblemBannerForTests()
  })

  it('shows the banner for 5xx responses', () => {
    enableBrowserRuntime()

    reportHttpFailure({ status: 503 })

    expect(readServerProblemBannerState().visible).toBe(true)
  })

  it('shows the banner for network failures', () => {
    enableBrowserRuntime()

    reportHttpFailure({ error: new Error('network down') })

    expect(readServerProblemBannerState().visible).toBe(true)
  })

  it('does not show the banner for 4xx responses', () => {
    enableBrowserRuntime()

    reportHttpFailure({ status: 409 })

    expect(readServerProblemBannerState().visible).toBe(false)
  })

  it('keeps the banner hidden after dismissal until a monitored request succeeds', () => {
    enableBrowserRuntime()

    reportHttpFailure({ status: 500 })
    dismissServerProblemBanner()
    expect(readServerProblemBannerState().visible).toBe(false)

    reportHttpFailure({ status: 502 })
    expect(readServerProblemBannerState().visible).toBe(false)

    reportHttpSuccess()
    reportHttpFailure({ status: 502 })

    expect(readServerProblemBannerState().visible).toBe(true)
  })
})
