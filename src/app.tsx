import { Router } from '@solidjs/router'
import { FileRoutes } from '@solidjs/start/router'
import type { JSX } from 'solid-js'
import { createEffect, createMemo, ErrorBoundary, Show, Suspense } from 'solid-js'
import { Toaster } from 'solid-toast'
import { getAppErrorDetails } from '~/app-error-details'
import { useTranslation } from '~/shared/localization/i18n'
import '~/app.css'

type AppErrorBoundaryFallbackProps = {
  readonly error: unknown
}

function AppErrorBoundaryFallback(props: AppErrorBoundaryFallbackProps): JSX.Element {
  const { t, keys } = useTranslation()
  const details = createMemo(() => getAppErrorDetails(props.error, import.meta.env?.DEV === true))

  createEffect(() => {
    try {
      console.error('Uncaught render error in App root:', props.error)
    } catch (_error) {}
  })

  return (
    <div style={{ padding: '24px' }}>
      <h1>Something went wrong.</h1>
      <p>{t(keys.app.unexpectedRenderError)}</p>
      <Show when={details()}>
        {(value) => (
          <pre style={{ 'margin-top': '12px', 'white-space': 'pre-wrap' }}>{value()}</pre>
        )}
      </Show>
    </div>
  )
}

/** @public */
export default function App() {
  return (
    <Router
      root={(props) => (
        // The `root` div with class "root" enables isolation for BaseUI Portals (see app.css)
        <div class="root">
          <ErrorBoundary fallback={(err) => <AppErrorBoundaryFallback error={err} />}>
            <Suspense>{props.children}</Suspense>
          </ErrorBoundary>
          <Toaster position="top-right" />
        </div>
      )}
    >
      <FileRoutes />
    </Router>
  )
}
