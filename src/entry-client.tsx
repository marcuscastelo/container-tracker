// @refresh reload
import '~/shared/localization/i18n'
import { mount, StartClient } from '@solidjs/start/client'
import { env } from '~/shared/config/env'

// Load env on the client bundle as well so the app has consistent config
void env
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
            } catch (_err) {}
            const container = btn.getAttribute('data-container') || ''
            const carrier = btn.getAttribute('data-carrier') || 'unknown'
            console.debug('entry-client: delegated refresh click for', container)
            try {
              alert(`delegated handler: refreshing ${container}...`)
            } catch (_err) {}
            fetch('/api/refresh', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ container, carrier }),
            })
              .then(async (res) => {
                let j = null
                try {
                  j = await res.json()
                } catch (_e) {}
                if (!res.ok) {
                  try {
                    alert(`Refresh failed: ${res.status} ${res.statusText}\n${j?.error ?? ''}`)
                  } catch (_err) {}
                } else {
                  try {
                    alert(`Refresh OK — updated: ${j?.updatedPath ?? 'unknown'}`)
                  } catch (_err) {}
                }
              })
              .catch((err) => {
                console.error('delegated refresh error', err)
                try {
                  alert(`Refresh error: ${String(err)}`)
                } catch (_e) {}
              })
          }
        } catch (_err) {}
      },
      { capture: true },
    )
  }
} catch (_err) {
  // ignore
}

// biome-ignore lint/style/noNonNullAssertion: SolidJS entry point
mount(() => <StartClient />, document.getElementById('app')!)
