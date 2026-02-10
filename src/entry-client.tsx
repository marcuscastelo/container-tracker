// @refresh reload
import '~/shared/localization/i18n'
import { mount, StartClient } from '@solidjs/start/client'
import { env } from '~/shared/config/env'

// Load env on the client bundle as well so the app has consistent config
void env

// TODO: Remove global error handlers once we have better visibility into client-side issues and confidence they won't fail silently. See
// Issue URL: https://github.com/marcuscastelo/container-tracker/issues/31
// Install global error handlers early so any silent failures are visible in the console
if (typeof window !== 'undefined') {
  window.addEventListener('error', (ev) => {
    try {
      // ev.error may be undefined for some browser errors
      // eslint-disable-next-line no-console
      console.error('global error captured in entry-client', ev.error ?? ev.message ?? ev)
    } catch (e) {
      // fallback noop
      // eslint-disable-next-line no-console
      console.error('failed to log global error', e)
    }
  })
  window.addEventListener('unhandledrejection', (ev) => {
    try {
      // eslint-disable-next-line no-console
      console.error('unhandledrejection captured in entry-client', ev.reason)
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('failed to log unhandledrejection', e)
    }
  })
}

// TODO: Remove delegated click handler once we have better visibility into client-side issues and confidence that Solid's onClick handlers are working consistently. See
// Issue URL: https://github.com/marcuscastelo/container-tracker/issues/30
// Diagnostic logging to ensure client bundle is running and to capture clicks
try {
  console.debug('entry-client: running')
  if (typeof document !== 'undefined') {
    document.addEventListener(
      'click',
      (e) => {
        try {
          const t = e.target instanceof HTMLElement ? e.target : null
          console.debug('entry-client: global click on', t && (t.id || t.tagName || t.className))
          // Delegated handler for refresh buttons (works even if Solid onClick isn't attached)
          const candidate = t?.closest?.('button.refresh-button') ?? null
          const btn = candidate instanceof HTMLElement ? candidate : null
          if (btn) {
            // mark as handled so component handler can skip duplicate
            try {
              btn.dataset.delegateHandled = '1'
            } catch (err) {
              console.error('entry-client: failed to set delegateHandled', err)
            }
            const container = btn.getAttribute('data-container') || ''
            const carrier = btn.getAttribute('data-carrier') || 'unknown'
            console.debug('entry-client: delegated refresh click for', container)
            try {
              alert(`delegated handler: refreshing ${container}...`)
            } catch (err) {
              console.error('entry-client: failed to show delegated alert', err)
            }
            // TODO: Validate container and provider on the client side as well to avoid unnecessary requests
            // Issue URL: https://github.com/marcuscastelo/container-tracker/issues/18
            fetch('/api/refresh', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ container, carrier }),
            })
              .then(async (res) => {
                let j = null
                try {
                  j = await res.json()
                } catch (e) {
                  console.error('entry-client: failed to parse refresh response JSON', e)
                }
                if (!res.ok) {
                  try {
                    alert(`Refresh failed: ${res.status} ${res.statusText}\n${j?.error ?? ''}`)
                  } catch (err) {
                    console.error('entry-client: failed to show refresh failure alert', err)
                  }
                } else {
                  try {
                    alert(`Refresh OK — updated: ${j?.updatedPath ?? 'unknown'}`)
                  } catch (err) {
                    console.error('entry-client: failed to show refresh success alert', err)
                  }
                }
              })
              .catch((err) => {
                console.error('delegated refresh error', err)
                try {
                  alert(`Refresh error: ${String(err)}`)
                } catch (e) {
                  console.error('entry-client: failed to show refresh error alert', e)
                }
              })
          }
        } catch (err) {
          console.error('entry-client: global click handler failed', err)
        }
      },
      { capture: true },
    )
  }
} catch (err) {
  console.error('entry-client: initialization failed', err)
}

// biome-ignore lint/style/noNonNullAssertion: SolidJS entry point
// biome-ignore lint/style/noNonNullAssertion: SolidJS entry point
try {
  const root = document.getElementById('app')
  if (!root) {
    console.error('entry-client: #app root element not found — mount aborted')
  } else {
    mount(() => <StartClient />, root)
  }
} catch (err) {
  console.error('entry-client: mount failed', err)
}
