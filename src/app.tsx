import { Router, useLocation, usePreloadRoute } from '@solidjs/router'
import { FileRoutes } from '@solidjs/start/router'
import type { JSX } from 'solid-js'
import { createEffect, createMemo, ErrorBoundary, Show, Suspense } from 'solid-js'
import { Toaster } from 'solid-toast'
import { getAppErrorDetails } from '~/app-error-details'
import { DashboardKeepWarmBoundary } from '~/modules/process/ui/screens/dashboard/DashboardKeepWarmBoundary'
import { useTranslation } from '~/shared/localization/i18n'
import '~/app.css'

type AppErrorBoundaryFallbackProps = {
  readonly error: unknown
}

type AppRouterRootProps = {
  readonly children: JSX.Element
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

function AppRouterRoot(props: AppRouterRootProps): JSX.Element {
  const location = useLocation()
  const preloadRoute = usePreloadRoute()

  return (
    <div class="root">
      <DashboardKeepWarmBoundary pathname={() => location.pathname} preloadRoute={preloadRoute} />
      <ErrorBoundary fallback={(err) => <AppErrorBoundaryFallback error={err} />}>
        <Suspense>{props.children}</Suspense>
      </ErrorBoundary>
      <Toaster position="top-right" />
    </div>
  )
}

/** @public */
export default function App() {
  return (
    <Router root={(props) => <AppRouterRoot>{props.children}</AppRouterRoot>}>
      <FileRoutes />
    </Router>
  )
}
