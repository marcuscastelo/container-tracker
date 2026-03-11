// @refresh reload
import '~/shared/localization/i18n'
import { mount, StartClient } from '@solidjs/start/client'
import { initializeTheme } from '~/lib/theme'
import { env } from '~/shared/config/env'

// Load env on the client bundle as well so the app has consistent config
void env

initializeTheme()

// TODO: Remove global error handlers once we have better visibility into client-side issues and confidence they won't fail silently. See
// Issue URL: https://github.com/marcuscastelo/container-tracker/issues/31
// Install global error handlers early so any silent failures are visible in the console
if (typeof window !== 'undefined') {
  window.addEventListener('error', (ev) => {
    try {
      // ev.error may be undefined for some browser errors

      console.error('global error captured in entry-client', ev.error ?? ev.message ?? ev)
    } catch (e) {
      // fallback noop

      console.error('failed to log global error', e)
    }
  })
  window.addEventListener('unhandledrejection', (ev) => {
    try {
      console.error('unhandledrejection captured in entry-client', ev.reason)
    } catch (e) {
      console.error('failed to log unhandledrejection', e)
    }
  })
}

try {
  const root = document.getElementById('app')
  if (root) {
    mount(() => <StartClient />, root)
  } else {
    console.error('entry-client: #app root element not found — mount aborted')
  }
} catch (err) {
  console.error('entry-client: mount failed', err)
}
