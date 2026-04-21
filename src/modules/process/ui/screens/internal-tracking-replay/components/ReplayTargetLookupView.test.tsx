import { createComponent } from 'solid-js'
import { renderToString } from 'solid-js/web'
import { describe, expect, it } from 'vitest'
import { ReplayTargetLookupView } from '~/modules/process/ui/screens/internal-tracking-replay/components/ReplayTargetLookupView'

describe('ReplayTargetLookupView', () => {
  it('renders explicit labels for the access token and container lookup inputs', () => {
    const html = renderToString(() =>
      createComponent(ReplayTargetLookupView, {
        authToken: 'secret-token',
        containerNumber: 'TGBU7416510',
        busy: false,
        onAuthTokenInput: () => undefined,
        onContainerNumberInput: () => undefined,
        onLookup: async () => undefined,
      }),
    )

    expect(html).toContain('Replay Access Token')
    expect(html).toContain('for="tracking-replay-access-token"')
    expect(html).toContain('id="tracking-replay-access-token"')
    expect(html).toContain('Container Number')
    expect(html).toContain('for="tracking-replay-container-number"')
    expect(html).toContain('id="tracking-replay-container-number"')
  })
})
